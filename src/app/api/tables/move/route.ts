import { NextResponse } from 'next/server';
import { db } from '@/db';
import { orders, orderItems, tables } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Chưa đăng nhập' }, { status: 401 });
    }
    const body = await request.json();
    const { fromTableId, toTableId } = body;

    if (!fromTableId || !toTableId || fromTableId === toTableId) {
      return NextResponse.json({ success: false, error: 'Bàn nguồn và bàn đích không hợp lệ' }, { status: 400 });
    }

    // 1. Find active serving order on fromTable
    const fromOrders = await db
      .select()
      .from(orders)
      .where(and(eq(orders.tableId, Number(fromTableId)), eq(orders.status, 'serving')));

    if (fromOrders.length === 0) {
      return NextResponse.json({ success: false, error: 'Bàn nguồn không có đơn hàng đang phục vụ' }, { status: 400 });
    }

    const sourceOrder = fromOrders[0];

    // 2. Check toTable
    const toOrders = await db
      .select()
      .from(orders)
      .where(and(eq(orders.tableId, Number(toTableId)), eq(orders.status, 'serving')));

    if (toOrders.length === 0) {
      // 2A. Move table directly
      await db
        .update(orders)
        .set({
          tableId: Number(toTableId),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(orders.id, sourceOrder.id));

      // Clear fromTable
      await db
        .update(tables)
        .set({
          status: 'available',
          currentOrderId: null,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(tables.id, Number(fromTableId)));

      // Occupy toTable
      await db
        .update(tables)
        .set({
          status: 'occupied',
          currentOrderId: sourceOrder.id,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(tables.id, Number(toTableId)));

      return NextResponse.json({
        success: true,
        message: 'Đã chuyển bàn thành công!',
      });
    } else {
      // 2B. Merge tables: move order items from sourceOrder to targetOrder
      const targetOrder = toOrders[0];

      const sourceItems = await db.select().from(orderItems).where(eq(orderItems.orderId, sourceOrder.id));
      const targetItems = await db.select().from(orderItems).where(eq(orderItems.orderId, targetOrder.id));

      for (const item of sourceItems) {
        const existingTargetItem = targetItems.find((i) => i.productId === item.productId);
        if (existingTargetItem) {
          // Update quantity
          const newQty = existingTargetItem.quantity + item.quantity;
          await db
            .update(orderItems)
            .set({
              quantity: newQty,
              amount: newQty * existingTargetItem.productPrice,
            })
            .where(eq(orderItems.id, existingTargetItem.id));
        } else {
          // Move item to targetOrder
          await db
            .update(orderItems)
            .set({ orderId: targetOrder.id })
            .where(eq(orderItems.id, item.id));
        }
      }

      // Recalculate targetOrder totalAmount
      const updatedTargetItems = await db.select().from(orderItems).where(eq(orderItems.orderId, targetOrder.id));
      let newTotal = 0;
      updatedTargetItems.forEach((i) => {
        newTotal += i.amount;
      });

      let discount = targetOrder.discountAmount || 0;
      if (targetOrder.discountPercent && targetOrder.discountPercent > 0) {
        discount = (newTotal * targetOrder.discountPercent) / 100;
      }
      const newFinal = Math.max(0, newTotal - discount);

      await db
        .update(orders)
        .set({
          totalAmount: newTotal,
          discountAmount: discount,
          finalAmount: newFinal,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(orders.id, targetOrder.id));

      // Delete sourceOrder
      await db.delete(orders).where(eq(orders.id, sourceOrder.id));

      // Clear fromTable
      await db
        .update(tables)
        .set({
          status: 'available',
          currentOrderId: null,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(tables.id, Number(fromTableId)));

      return NextResponse.json({
        success: true,
        message: 'Đã gộp đơn hàng và gộp bàn thành công!',
      });
    }
  } catch (error: unknown) {
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
