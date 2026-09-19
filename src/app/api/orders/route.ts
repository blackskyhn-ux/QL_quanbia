import { NextResponse } from 'next/server';
import { db } from '@/db';
import { orders, orderItems, tables, products } from '@/db/schema';
import { eq, desc, and, inArray, sql } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

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
  } catch (error: unknown) {
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser(request);
    const body = await request.json();
    const { tableId, items, customerCount, notes, discountPercent, discountAmount, updatedAt } = body;

    if (!tableId || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, error: 'Bàn hoặc danh sách món ăn không hợp lệ' }, { status: 400 });
    }

    const productIds = items.map((i: any) => Number(i.productId));
    const dbProducts = await db.select().from(products).where(inArray(products.id, productIds));
    const productMap = new Map();
    dbProducts.forEach(p => productMap.set(p.id, p));

    // Calculate totals using DB prices
    let totalAmount = 0;
    for (const item of items) {
      const quantity = Number(item.quantity);
      if (isNaN(quantity) || quantity <= 0) {
        return NextResponse.json({ success: false, error: 'Số lượng sản phẩm không hợp lệ' }, { status: 400 });
      }
    }

    const validatedItems = items.map((item: any) => {
      const dbProduct = productMap.get(Number(item.productId));
      const actualPrice = dbProduct ? Number(dbProduct.price) : Number(item.productPrice);
      const actualCost = dbProduct ? Number(dbProduct.costPrice || 0) : Number(item.unitCost || 0);
      const actualName = dbProduct ? dbProduct.name : item.productName;
      const quantity = Number(item.quantity);
      
      totalAmount += actualPrice * quantity;
      
      return {
        productId: Number(item.productId),
        productName: actualName,
        productPrice: actualPrice,
        unitCost: actualCost,
        quantity: quantity,
        amount: actualPrice * quantity,
        note: item.note || '',
        status: item.status || 'served',
      };
    });

    let calculatedDiscount = Number(discountAmount || 0);
    if (discountPercent && Number(discountPercent) > 0) {
      calculatedDiscount = (totalAmount * Number(discountPercent)) / 100;
    }

    const finalAmount = Math.max(0, totalAmount - calculatedDiscount);

    let transactionResult;
    let retries = 5;
    while (retries > 0) {
      try {
        transactionResult = await db.transaction(async (tx) => {
          // Check if table already has an active order using and() inside tx
          const activeOrders = await tx
            .select()
            .from(orders)
            .where(and(eq(orders.tableId, Number(tableId)), eq(orders.status, 'serving')));

          let orderId: number;
          let orderNumber: string;
          let updatedRecord: any = null;

          if (activeOrders.length > 0) {
            // Update existing order
            orderId = activeOrders[0].id;
            orderNumber = activeOrders[0].orderNumber;
            
            // ATOMIC OPTIMISTIC LOCKING VIA DATABASE WHERE CONDITION
            const clientVersion = body.version !== undefined && body.version !== null ? Number(body.version) : undefined;
            if (clientVersion === undefined || isNaN(clientVersion)) {
              throw new Error('MISSING_VERSION');
            }

            const updatedOrders = await tx
              .update(orders)
              .set({
                totalAmount,
                discountAmount: calculatedDiscount,
                discountPercent: Number(discountPercent || 0),
                finalAmount,
                customerCount: Number(customerCount || activeOrders[0].customerCount || 1),
                notes: notes !== undefined ? notes : activeOrders[0].notes,
                version: sql`${orders.version} + 1`,
                updatedAt: new Date().toISOString(),
              })
              .where(
                and(
                  eq(orders.id, orderId),
                  eq(orders.version, clientVersion)
                )
              )
              .returning();

            if (updatedOrders.length === 0) {
              throw new Error('CONCURRENCY_CONFLICT');
            }

            updatedRecord = updatedOrders[0];

            // Clear previous items and rewrite
            await tx.delete(orderItems).where(eq(orderItems.orderId, orderId));
          } else {
            // Create new order
            orderNumber = `HD-${Date.now().toString().slice(-8)}`;
            const insertedOrder = await tx
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
                version: 1,
                updatedAt: new Date().toISOString(),
              })
              .returning();

            orderId = insertedOrder[0].id;
            updatedRecord = insertedOrder[0];

            // Update table status to occupied
            await tx
              .update(tables)
              .set({
                status: 'occupied',
                currentOrderId: orderId,
                updatedAt: new Date().toISOString(),
              })
              .where(eq(tables.id, Number(tableId)));
          }

          // Insert order items
          const itemValues = validatedItems.map((item: any) => ({
            orderId,
            productId: item.productId,
            productName: item.productName,
            productPrice: item.productPrice,
            unitCost: item.unitCost,
            quantity: item.quantity,
            amount: item.amount,
            note: item.note,
            status: item.status,
          }));

          await tx.insert(orderItems).values(itemValues);

          return { orderId, orderNumber, finalAmount, version: updatedRecord?.version, updatedAt: updatedRecord?.updatedAt };
        });
        break; // Success, exit retry loop
      } catch (error: any) {
        if (error.message === 'CONCURRENCY_CONFLICT' || error.message === 'MISSING_VERSION') {
          throw error; // Don't retry conflicts or validation errors
        }
        if (error.code === 'SQLITE_BUSY' || error.message?.includes('database is locked')) {
          retries--;
          if (retries === 0) throw error;
          await new Promise((resolve) => setTimeout(resolve, Math.floor(Math.random() * 100) + 50));
        } else {
          throw error;
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Đã lưu đơn hàng thành công',
      data: transactionResult,
    });
  } catch (error: any) {
    try {
      const fs = require('fs');
      fs.appendFileSync('tmp_test_log.txt', `\n>>> POST /api/orders ERROR: ${error.message} <<<\n`);
    } catch (e) {}
    if (error.message === 'MISSING_VERSION') {
      return NextResponse.json({ success: false, error: 'Thiếu thông tin phiên bản (version) đơn hàng' }, { status: 400 });
    }
    if (error.message === 'CONCURRENCY_CONFLICT') {
      return NextResponse.json({ success: false, error: 'Đơn hàng đã bị thay đổi bởi người khác, vui lòng tải lại!' }, { status: 409 });
    }
    console.error('API Orders POST Error:', error);
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
