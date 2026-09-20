import { NextResponse } from 'next/server';
import { db } from '@/db';
import { orders, tables, orderItems, products, inventoryLogs } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';
import { recordAuditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser(request);
    const { id } = await params;
    const orderId = Number(id);
    const body = await request.json();
    const { paymentMethod, discountAmount, finalAmount } = body;

    let retries = 5;
    while (retries > 0) {
      try {
        await db.transaction(async (tx) => {
          // Fetch order
          const orderList = await tx.select().from(orders).where(eq(orders.id, orderId));
          if (orderList.length === 0) {
            throw new Error('Đơn hàng không tồn tại');
          }
          const order = orderList[0];

          if (order.paymentStatus === 'paid' || order.status === 'completed') {
            throw new Error('Đơn hàng đã được thanh toán');
          }

          // ATOMIC CLAIM: Update order status to completed atomically BEFORE side effects
          const updatedOrders = await tx
            .update(orders)
            .set({
              status: 'completed',
              paymentStatus: 'paid',
              paymentMethod: paymentMethod || 'cash',
              discountAmount: discountAmount !== undefined ? Number(discountAmount) : order.discountAmount,
              finalAmount: finalAmount !== undefined ? Number(finalAmount) : order.finalAmount,
              version: sql`${orders.version} + 1`,
              paidAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            })
            .where(and(eq(orders.id, orderId), eq(orders.paymentStatus, 'unpaid')))
            .returning();

          if (updatedOrders.length === 0) {
            throw new Error('Đơn hàng đã được thanh toán bởi một giao dịch khác');
          }

          // Record PAYMENT_COMPLETED audit log
          await recordAuditLog({
            tx,
            action: 'PAYMENT_COMPLETED',
            entityType: 'order',
            entityId: orderId,
            performedBy: user?.id,
            reason: `Thanh toán thành công đơn hàng #${order.orderNumber} qua ${paymentMethod || 'cash'}`,
            oldValue: {
              status: order.status,
              paymentStatus: order.paymentStatus,
              finalAmount: order.finalAmount,
            },
            newValue: {
              status: 'completed',
              paymentStatus: 'paid',
              paymentMethod: paymentMethod || 'cash',
              finalAmount: finalAmount !== undefined ? Number(finalAmount) : order.finalAmount,
            },
          });

          // Reset table status to available
          if (order.tableId) {
            await tx
              .update(tables)
              .set({
                status: 'available',
                currentOrderId: null,
                updatedAt: new Date().toISOString(),
              })
              .where(eq(tables.id, Number(order.tableId)));
          }

          // Deduct stock for each item in order
          const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId));
          for (const item of items) {
            const prodList = await tx.select().from(products).where(eq(products.id, item.productId));
            if (prodList.length > 0) {
              const prod = prodList[0];
              const currentStock = prod.stockQuantity || 0;
              const newStock = Math.max(0, currentStock - item.quantity);

              // Update product stock
              await tx
                .update(products)
                .set({ stockQuantity: newStock })
                .where(eq(products.id, prod.id));

              // Create inventory log
              await tx.insert(inventoryLogs).values({
                productId: prod.id,
                type: 'order_deduct',
                quantity: -item.quantity,
                previousStock: currentStock,
                newStock: newStock,
                note: `Trừ kho từ đơn hàng #${order.orderNumber}`,
                createdBy: user ? user.id : 1,
              });
            }
          }
          return true;
        });
        break; // Transaction succeeded
      } catch (err: any) {
        if (err.code === 'SQLITE_BUSY' || err.message?.includes('database is locked')) {
          retries--;
          if (retries === 0) throw err;
          await new Promise((resolve) => setTimeout(resolve, Math.floor(Math.random() * 100) + 50));
        } else {
          throw err;
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Thanh toán đơn hàng & cập nhật tồn kho thành công!',
    });
  } catch (error: any) {
    try {
      const fs = require('fs');
      fs.appendFileSync('tmp_test_log.txt', `\n>>> PAY API ERROR: ${error.message} <<<\n`);
    } catch (e) {}
    console.error('PAY API ROUTE CATCH ERROR:', error.message, error.stack);
    if (error.message === 'Đơn hàng không tồn tại') return NextResponse.json({ success: false, error: error.message }, { status: 404 });
    if (error.message?.includes('đã được thanh toán')) return NextResponse.json({ success: false, error: error.message }, { status: 409 });
    
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
