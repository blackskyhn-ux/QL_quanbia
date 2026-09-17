import { NextResponse } from 'next/server';
import { db } from '@/db';
import { products, categories } from '@/db/schema';
import { eq, like, or } from 'drizzle-orm';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get('categoryId');
    const search = searchParams.get('search');

    let query = db
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
      .leftJoin(categories, eq(products.categoryId, categories.id));

    const productList = await query;

    let filtered = productList;

    if (categoryId && categoryId !== 'all') {
      const catIdNum = parseInt(categoryId, 10);
      filtered = filtered.filter((p) => p.categoryId === catIdNum);
    }

    if (search && search.trim() !== '') {
      const s = search.toLowerCase().trim();
      filtered = filtered.filter(
        (p) => p.name.toLowerCase().includes(s) || (p.code && p.code.toLowerCase().includes(s))
      );
    }

    return NextResponse.json({ success: true, data: filtered });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
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
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
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
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ success: false, error: 'Thiếu ID sản phẩm' }, { status: 400 });
    }

    // Luôn ưu tiên Soft Delete
    const updated = await db
      .update(products)
      .set({ isAvailable: false })
      .where(eq(products.id, Number(id)))
      .returning();

    return NextResponse.json({ success: true, data: updated[0] });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
