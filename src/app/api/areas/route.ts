import { NextResponse } from 'next/server';
import { db } from '@/db';
import { areas, tables, orders, orderItems } from '@/db/schema';
import { inArray, eq } from 'drizzle-orm';
import { ensureDbInitialized } from '@/db/init';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await ensureDbInitialized();
    const areaList = await db.select().from(areas).where(eq(areas.isActive, true)).orderBy(areas.sortOrder);
    const tableList = await db.select().from(tables);
    const activeOrders = await db.select().from(orders).where(eq(orders.status, 'serving'));

    const activeOrderIds = activeOrders.map((o) => o.id);
    let allOrderItems: any[] = [];
    if (activeOrderIds.length > 0) {
      allOrderItems = await db.select().from(orderItems).where(inArray(orderItems.orderId, activeOrderIds));
    }

    // Attach active orders with items to tables inside areas
    const result = areaList.map((area) => {
      const areaTables = tableList
        .filter((t) => t.areaId === area.id)
        .map((t) => {
          const currentOrder = activeOrders.find((o) => o.tableId === t.id);
          let orderWithItems = null;

          if (currentOrder) {
            const items = allOrderItems.filter((i) => i.orderId === currentOrder.id);
            orderWithItems = {
              ...currentOrder,
              items,
            };
          }

          return {
            ...t,
            currentOrder: orderWithItems,
          };
        });

      return {
        ...area,
        tables: areaTables,
      };
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error: unknown) {
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { name, sortOrder } = await request.json();
    if (!name) return NextResponse.json({ success: false, error: 'Tên khu vực không được trống' }, { status: 400 });

    const inserted = await db.insert(areas).values({ 
      name, 
      sortOrder: sortOrder || 0 
    }).returning();
    
    return NextResponse.json({ success: true, data: inserted[0] });
  } catch (error: unknown) {
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { id, name, sortOrder, isActive } = await request.json();
    if (!id) return NextResponse.json({ success: false, error: 'Thiếu ID' }, { status: 400 });

    const updated = await db.update(areas).set({
      name,
      sortOrder: sortOrder !== undefined ? Number(sortOrder) : undefined,
      isActive: isActive !== undefined ? Boolean(isActive) : undefined,
    }).where(eq(areas.id, Number(id))).returning();

    return NextResponse.json({ success: true, data: updated[0] });
  } catch (error: unknown) {
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ success: false, error: 'Thiếu ID' }, { status: 400 });

    // Try to soft delete
    const updated = await db.update(areas).set({ isActive: false }).where(eq(areas.id, Number(id))).returning();
    return NextResponse.json({ success: true, data: updated[0] });
  } catch (error: unknown) {
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
