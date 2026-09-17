import { NextResponse } from 'next/server';
import { db } from '@/db';
import { orders, orderItems, tables, products } from '@/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tableId = searchParams.get('tableId');
    const status = searchParams.get('status');

    const orderList = await db.select().from(orders).orderBy(desc(orders.createdAt));

    let filtered = orderList;

    if (tableId) {
      filtered = filtered.filter((o) => o.tableId === Number(tableId));
    }

    if (status) {
      filtered = filtered.filter((o) => o.status === status);
    }

    // Attach items and table info
    const allItems = await db.select().from(orderItems);
    const allTables = await db.select().from(tables);

    const result = filtered.map((order) => {
      const items = allItems.filter((i) => i.orderId === order.id);
      const table = allTables.find((t) => t.id === order.tableId);
      return {
        ...order,
        table,
        items,
      };
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    const body = await request.json();
    const { tableId, items, customerCount, notes, discountPercent, discountAmount } = body;

    if (!tableId || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, error: 'Bàn hoặc danh sách món ăn không hợp lệ' }, { status: 400 });
    }

    // Check if table already has an active order using and()
    const activeOrders = await db
      .select()
      .from(orders)
      .where(and(eq(orders.tableId, Number(tableId)), eq(orders.status, 'serving')));

    let orderId: number;
    let orderNumber: string;

    // Calculate totals
    let totalAmount = 0;
    items.forEach((item: any) => {
      totalAmount += Number(item.productPrice) * Number(item.quantity);
    });

    let calculatedDiscount = Number(discountAmount || 0);
    if (discountPercent && Number(discountPercent) > 0) {
      calculatedDiscount = (totalAmount * Number(discountPercent)) / 100;
    }

    const finalAmount = Math.max(0, totalAmount - calculatedDiscount);

    if (activeOrders.length > 0) {
      // Update existing order
      orderId = activeOrders[0].id;
      orderNumber = activeOrders[0].orderNumber;

      await db
        .update(orders)
        .set({
          totalAmount,
          discountAmount: calculatedDiscount,
          discountPercent: Number(discountPercent || 0),
          finalAmount,
          customerCount: Number(customerCount || activeOrders[0].customerCount || 1),
          notes: notes || activeOrders[0].notes,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(orders.id, orderId));

      // Clear previous items and rewrite
      await db.delete(orderItems).where(eq(orderItems.orderId, orderId));
    } else {
      // Create new order
      orderNumber = `HD-${Date.now().toString().slice(-8)}`;
      const insertedOrder = await db
        .insert(orders)
        .values({
          orderNumber,
          tableId: Number(tableId),
          userId: user ? user.id : 1,
          status: 'serving',
          totalAmount,
          discountAmount: calculatedDiscount,
          discountPercent: Number(discountPercent || 0),
          finalAmount,
          paymentStatus: 'unpaid',
          customerCount: Number(customerCount || 1),
          notes: notes || '',
        })
        .returning();

      orderId = insertedOrder[0].id;

      // Update table status to occupied
      await db
        .update(tables)
        .set({
          status: 'occupied',
          currentOrderId: orderId,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(tables.id, Number(tableId)));
    }

    // Insert order items
    const itemValues = items.map((item: any) => ({
      orderId,
      productId: Number(item.productId),
      productName: item.productName,
      productPrice: Number(item.productPrice),
      quantity: Number(item.quantity),
      amount: Number(item.productPrice) * Number(item.quantity),
      note: item.note || '',
      status: 'served',
    }));

    await db.insert(orderItems).values(itemValues);

    return NextResponse.json({
      success: true,
      message: 'Đã lưu đơn hàng thành công',
      data: { orderId, orderNumber, finalAmount },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
