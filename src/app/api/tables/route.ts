import { NextResponse } from 'next/server';
import { db } from '@/db';
import { tables } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(request: Request) {
  try {
    const { areaId, name, seats } = await request.json();
    if (!areaId || !name) return NextResponse.json({ success: false, error: 'Thiếu tên bàn hoặc khu vực' }, { status: 400 });

    const inserted = await db.insert(tables).values({ 
      areaId: Number(areaId),
      name, 
      seats: seats ? Number(seats) : 4 
    }).returning();
    
    return NextResponse.json({ success: true, data: inserted[0] });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { id, name, seats, status, areaId } = await request.json();
    if (!id) return NextResponse.json({ success: false, error: 'Thiếu ID' }, { status: 400 });

    const updated = await db.update(tables).set({
      name,
      seats: seats !== undefined ? Number(seats) : undefined,
      status: status || undefined,
      areaId: areaId ? Number(areaId) : undefined,
      updatedAt: new Date().toISOString()
    }).where(eq(tables.id, Number(id))).returning();

    return NextResponse.json({ success: true, data: updated[0] });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ success: false, error: 'Thiếu ID' }, { status: 400 });

    // Try hard delete or change status to maintenance/inactive
    // For tables, we can delete if it has no orders. Let's do a hard delete for simplicity. In SQLite with Drizzle we just delete.
    // However, if there's a constraint violation it'll throw an error, which is caught and returned.
    const deleted = await db.delete(tables).where(eq(tables.id, Number(id))).returning();
    return NextResponse.json({ success: true, data: deleted[0] });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: 'Không thể xoá bàn này (Có thể đang dính đơn hàng cũ).' }, { status: 500 });
  }
}
