import { NextResponse } from 'next/server';
import { db } from '@/db';
import { products, categories, inventoryLogs, users } from '@/db/schema';
import { eq, desc, and, inArray, like, or } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Chưa đăng nhập' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const categoryId = searchParams.get('categoryId');
    const logsLimit = searchParams.get('logsLimit') ? Number(searchParams.get('logsLimit')) : 100;
    const productId = searchParams.get('productId');

    // 1. Fetch products with categories
    const allProducts = await db
      .select({
        id: products.id,
        name: products.name,
        code: products.code,
        price: products.price,
        costPrice: products.costPrice,
        unit: products.unit,
        stockQuantity: products.stockQuantity,
        minStockLevel: products.minStockLevel,
        isAvailable: products.isAvailable,
        categoryId: products.categoryId,
        categoryName: categories.name,
      })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .orderBy(products.name);

    // Filter products if requested
    const filteredProducts = allProducts.filter((p) => {
      const matchesCategory = !categoryId || p.categoryId === Number(categoryId);
      const matchesSearch =
        !search ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.code && p.code.toLowerCase().includes(search.toLowerCase()));
      return matchesCategory && matchesSearch;
    });

    // Calculate Summary Stats
    const totalItems = allProducts.length;
    const lowStockCount = allProducts.filter((p) => (p.stockQuantity ?? 0) <= (p.minStockLevel ?? 10) && (p.stockQuantity ?? 0) > 0).length;
    const outOfStockCount = allProducts.filter((p) => (p.stockQuantity ?? 0) <= 0).length;
    const totalInventoryValue = allProducts.reduce(
      (sum, p) => sum + (p.stockQuantity ?? 0) * (p.costPrice || p.price || 0),
      0
    );

    // 2. Fetch inventory logs
    const logConditions = [];
    if (productId) {
      logConditions.push(eq(inventoryLogs.productId, Number(productId)));
    }

    const rawLogs = await db
      .select({
        id: inventoryLogs.id,
        productId: inventoryLogs.productId,
        productName: products.name,
        productCode: products.code,
        unit: products.unit,
        type: inventoryLogs.type,
        quantity: inventoryLogs.quantity,
        previousStock: inventoryLogs.previousStock,
        newStock: inventoryLogs.newStock,
        note: inventoryLogs.note,
        createdBy: inventoryLogs.createdBy,
        createdAt: inventoryLogs.createdAt,
        userFullName: users.fullName,
      })
      .from(inventoryLogs)
      .leftJoin(products, eq(inventoryLogs.productId, products.id))
      .leftJoin(users, eq(inventoryLogs.createdBy, users.id))
      .where(logConditions.length > 0 ? and(...logConditions) : undefined)
      .orderBy(desc(inventoryLogs.createdAt))
      .limit(logsLimit);

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalItems,
          lowStockCount,
          outOfStockCount,
          totalInventoryValue,
        },
        products: filteredProducts,
        logs: rawLogs,
      },
    });
  } catch (error: any) {
    console.error('Error fetching inventory data:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
