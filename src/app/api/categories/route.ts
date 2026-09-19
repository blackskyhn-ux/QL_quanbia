import { NextResponse } from 'next/server';
import { db } from '@/db';
import { categories } from '@/db/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const list = await db.select().from(categories).where(eq(categories.isActive, true)).orderBy(categories.sortOrder);
    return NextResponse.json({ success: true, data: list });
  } catch (error: unknown) {
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { name, icon, sortOrder } = await request.json();
    if (!name) return NextResponse.json({ success: false, error: 'Tên danh mục không được trống' }, { status: 400 });

    const inserted = await db.insert(categories).values({
      name,
      icon: icon || 'Beer',
      sortOrder: sortOrder || 0
    }).returning();

    return NextResponse.json({ success: true, data: inserted[0] });
  } catch (error: unknown) {
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { id, name, icon, sortOrder, isActive } = await request.json();
    if (!id) return NextResponse.json({ success: false, error: 'Thiếu ID danh mục' }, { status: 400 });

    const updated = await db.update(categories).set({
      name,
      icon,
      sortOrder: sortOrder !== undefined ? Number(sortOrder) : undefined,
      isActive: isActive !== undefined ? Boolean(isActive) : undefined,
    }).where(eq(categories.id, Number(id))).returning();

    return NextResponse.json({ success: true, data: updated[0] });
  } catch (error: unknown) {
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ success: false, error: 'Thiếu ID danh mục' }, { status: 400 });

    // Soft delete category
    const updated = await db.update(categories).set({ isActive: false }).where(eq(categories.id, Number(id))).returning();
    return NextResponse.json({ success: true, data: updated[0] });
  } catch (error: unknown) {
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
