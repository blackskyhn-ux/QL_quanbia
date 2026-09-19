import { NextResponse } from 'next/server';
import { db } from '@/db';
import { orders, tables, orderItems, products, inventoryLogs } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Chưa đăng nhập' }, { status: 401 });
    }

    const { id } = await params;
    const orderId = Number(id);

    const result = await db.transaction(async (tx) => {
      const orderList = await tx.select().from(orders).where(eq(orders.id, orderId));
      if (orderList.length === 0) {
        throw new Error('Đơn hàng không tồn tại');
      }
      const order = orderList[0];

      if (order.status === 'cancelled') {
        throw new Error('Đơn hàng đã bị hủy trước đó');
      }

      // Update order status to cancelled
      await tx
        .update(orders)
        .set({
          status: 'cancelled',
          updatedAt: new Date().toISOString(),
        })
        .where(eq(orders.id, orderId));

      // Reset table status to available if occupied by this order
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

      // If order was already paid, restore inventory
      if (order.paymentStatus === 'paid') {
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
              note: `Hoàn kho từ đơn hàng bị hủy #${order.orderNumber}`,
              createdBy: user.id,
            });
          }
        }
      }

      return true;
    });

    return NextResponse.json({
      success: true,
      message: 'Hủy đơn hàng thành công!',
    });
  } catch (error: any) {
    if (error.message === 'Đơn hàng không tồn tại') return NextResponse.json({ success: false, error: error.message }, { status: 404 });
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
