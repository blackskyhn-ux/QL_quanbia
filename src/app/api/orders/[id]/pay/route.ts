import { NextResponse } from 'next/server';
import { db } from '@/db';
import { orders, tables, orderItems, products, inventoryLogs } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    const { id } = await params;
    const orderId = Number(id);
    const body = await request.json();
    const { paymentMethod, discountAmount, finalAmount } = body;

    // Fetch order
    const orderList = await db.select().from(orders).where(eq(orders.id, orderId));
    if (orderList.length === 0) {
      return NextResponse.json({ success: false, error: 'Đơn hàng không tồn tại' }, { status: 404 });
    }

    const order = orderList[0];

    // Update order status to completed
    await db
      .update(orders)
      .set({
        status: 'completed',
        paymentStatus: 'paid',
        paymentMethod: paymentMethod || 'cash',
        discountAmount: discountAmount !== undefined ? Number(discountAmount) : order.discountAmount,
        finalAmount: finalAmount !== undefined ? Number(finalAmount) : order.finalAmount,
        paidAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(orders.id, orderId));

    // Reset table status to available
    if (order.tableId) {
      await db
        .update(tables)
        .set({
          status: 'available',
          currentOrderId: null,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(tables.id, Number(order.tableId)));
    }

    // Deduct stock for each item in order
    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
    for (const item of items) {
      const prodList = await db.select().from(products).where(eq(products.id, item.productId));
      if (prodList.length > 0) {
        const prod = prodList[0];
        const currentStock = prod.stockQuantity || 0;
        const newStock = Math.max(0, currentStock - item.quantity);

        // Update product stock
        await db
          .update(products)
          .set({ stockQuantity: newStock })
          .where(eq(products.id, prod.id));

        // Create inventory log
        await db.insert(inventoryLogs).values({
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

    return NextResponse.json({
      success: true,
      message: 'Thanh toán đơn hàng & cập nhật tồn kho thành công!',
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
