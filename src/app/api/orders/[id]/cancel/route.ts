import { NextResponse } from 'next/server';
import { db } from '@/db';
import { orders, tables, orderItems, products, inventoryLogs, auditLogs } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Chưa đăng nhập' }, { status: 401 });
    }

    // RBAC: Only admin or manager can cancel orders
    const role = (user.roleName || '').toLowerCase().trim();
    const isManagement = ['admin', 'manager', 'quanly', 'quản lý', 'quản trị'].includes(role);
    if (!isManagement) {
      return NextResponse.json(
        { success: false, error: 'Chỉ Admin hoặc Quản lý mới có quyền hủy đơn hàng' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const orderId = Number(id);
    if (!orderId || isNaN(orderId)) {
      return NextResponse.json({ success: false, error: 'Mã đơn hàng không hợp lệ' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const reason = (body.reason || 'Hủy đơn hàng').trim();
    if (!reason) {
      return NextResponse.json({ success: false, error: 'Vui lòng cung cấp lý do hủy' }, { status: 400 });
    }

    let retries = 5;
    while (retries > 0) {
      try {
        await db.transaction(async (tx) => {
          const orderList = await tx.select().from(orders).where(eq(orders.id, orderId));
          if (orderList.length === 0) {
            throw new Error('Đơn hàng không tồn tại');
          }
          const order = orderList[0];

          if (order.status === 'cancelled') {
            throw new Error('Đơn hàng đã bị hủy trước đó');
          }

          const isPaid = order.paymentStatus === 'paid';
          const nowIso = new Date().toISOString();

          // ATOMIC CONDITIONAL CLAIM
          const updatedOrders = await tx
            .update(orders)
            .set({
              status: 'cancelled',
              paymentStatus: isPaid ? 'refunded' : 'unpaid',
              cancelledAt: nowIso,
              cancelledBy: user.id,
              cancelReason: reason,
              refundedAt: isPaid ? nowIso : null,
              refundedBy: isPaid ? user.id : null,
              refundReason: isPaid ? reason : null,
              refundAmount: isPaid ? order.finalAmount : 0,
              version: sql`${orders.version} + 1`,
              updatedAt: nowIso,
            })
            .where(and(eq(orders.id, orderId), eq(orders.status, order.status)))
            .returning();

          if (updatedOrders.length === 0) {
            throw new Error('Đơn hàng đã bị thay đổi bởi một thao tác khác');
          }

          // Reset table status if assigned
          if (order.tableId) {
            await tx
              .update(tables)
              .set({
                status: 'available',
                currentOrderId: null,
                updatedAt: nowIso,
              })
              .where(eq(tables.id, Number(order.tableId)));
          }

          // Restore inventory if order was paid
          if (isPaid) {
            const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId));
            for (const item of items) {
              const prodList = await tx.select().from(products).where(eq(products.id, item.productId));
              if (prodList.length > 0) {
                const prod = prodList[0];
                const currentStock = prod.stockQuantity || 0;
                const newStock = currentStock + item.quantity;

                await tx
                  .update(products)
                  .set({ stockQuantity: newStock })
                  .where(eq(products.id, prod.id));

                await tx.insert(inventoryLogs).values({
                  productId: prod.id,
                  type: 'import',
                  quantity: item.quantity,
                  previousStock: currentStock,
                  newStock: newStock,
                  note: `Hoàn kho do hủy đơn hàng #${order.orderNumber}: ${reason}`,
                  createdBy: user.id,
                });
              }
            }
          }

          // Write audit log
          await tx.insert(auditLogs).values({
            action: isPaid ? 'ORDER_CANCELLED_WITH_REFUND' : 'ORDER_CANCELLED',
            entityType: 'order',
            entityId: orderId,
            performedBy: user.id,
            reason: reason,
            oldValue: JSON.stringify({
              status: order.status,
              paymentStatus: order.paymentStatus,
              finalAmount: order.finalAmount,
            }),
            newValue: JSON.stringify({
              status: 'cancelled',
              paymentStatus: isPaid ? 'refunded' : 'unpaid',
              refundAmount: isPaid ? order.finalAmount : 0,
            }),
          });
        });
        break; // Success
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
      message: 'Hủy đơn hàng thành công!',
    });
  } catch (error: any) {
    if (error.message === 'Đơn hàng không tồn tại') return NextResponse.json({ success: false, error: error.message }, { status: 404 });
    if (error.message?.includes('đã bị hủy') || error.message?.includes('thay đổi')) {
      return NextResponse.json({ success: false, error: error.message }, { status: 409 });
    }
    return NextResponse.json({ success: false, error: error.message || 'Lỗi server' }, { status: 500 });
  }
}
