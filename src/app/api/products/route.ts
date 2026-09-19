import { NextResponse } from 'next/server';
import { db } from '@/db';
import { products, categories } from '@/db/schema';
import { eq, like, or, and, sql } from 'drizzle-orm';
import { ensureDbInitialized } from '@/db/init';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    await ensureDbInitialized();
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get('categoryId');
    const search = searchParams.get('search');

    const conditions = [eq(products.isAvailable, true)];

    if (categoryId && categoryId !== 'all') {
      conditions.push(eq(products.categoryId, Number(categoryId)));
    }

    if (search && search.trim() !== '') {
      const s = `%${search.trim().toLowerCase()}%`;
      conditions.push(or(like(sql`LOWER(${products.name})`, s), like(sql`LOWER(${products.code})`, s)) as any);
    }

    const productList = await db
      .select({
        id: products.id,
        categoryId: products.categoryId,
        name: products.name,
        code: products.code,
        price: products.price,
        costPrice: products.costPrice,
        unit: products.unit,
        stockQuantity: products.stockQuantity,
        minStockLevel: products.minStockLevel,
        isAvailable: products.isAvailable,
        imageUrl: products.imageUrl,
        description: products.description,
        categoryName: categories.name,
      })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .where(and(...conditions));

    return NextResponse.json({ success: true, data: productList });
  } catch (error: unknown) {
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { categoryId, name, code, price, costPrice, unit, stockQuantity, imageUrl, description } = body;

    if (!categoryId || !name || price === undefined) {
      return NextResponse.json({ success: false, error: 'Thiếu thông tin bắt buộc (Danh mục, Tên, Giá bán)' }, { status: 400 });
    }

    const inserted = await db
      .insert(products)
      .values({
        categoryId: Number(categoryId),
        name,
        code: code || `SP-${Date.now()}`,
        price: Number(price),
        costPrice: Number(costPrice || 0),
        unit: unit || 'Đĩa',
        stockQuantity: Number(stockQuantity || 100),
        imageUrl: imageUrl || 'https://images.unsplash.com/photo-1544025162-d76694265947?w=400',
        description,
      })
      .returning();

    return NextResponse.json({ success: true, data: inserted[0] });
  } catch (error: unknown) {
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, categoryId, name, price, costPrice, unit, stockQuantity, isAvailable, imageUrl } = body;
    if (!id) return NextResponse.json({ success: false, error: 'Thiếu ID sản phẩm' }, { status: 400 });

    const updated = await db
      .update(products)
      .set({
        categoryId: categoryId ? Number(categoryId) : undefined,
        name,
        price: price !== undefined ? Number(price) : undefined,
        costPrice: costPrice !== undefined ? Number(costPrice) : undefined,
        unit,
        stockQuantity: stockQuantity !== undefined ? Number(stockQuantity) : undefined,
        isAvailable: isAvailable !== undefined ? Boolean(isAvailable) : undefined,
        imageUrl: imageUrl !== undefined ? imageUrl : undefined,
      })
      .where(eq(products.id, Number(id)))
      .returning();

    return NextResponse.json({ success: true, data: updated[0] });
  } catch (error: unknown) {
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Thiếu ID sản phẩm' }, { status: 400 });
    }

    const updated = await db
      .update(products)
      .set({ isAvailable: false })
      .where(eq(products.id, Number(id)))
      .returning();

    return NextResponse.json({ success: true, data: updated[0] });
  } catch (error: unknown) {
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
