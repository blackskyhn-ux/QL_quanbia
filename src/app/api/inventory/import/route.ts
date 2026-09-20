import { NextResponse } from 'next/server';
import { db } from '@/db';
import { products, inventoryLogs } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';
import { recordAuditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Chưa đăng nhập' }, { status: 401 });
    }

    const body = await request.json();
    const { productId, quantity, costPrice, note } = body;

    if (!productId || !quantity || Number(quantity) <= 0) {
      return NextResponse.json(
        { success: false, error: 'Vui lòng chọn sản phẩm và nhập số lượng hợp lệ (> 0)' },
        { status: 400 }
      );
    }

    const targetProductId = Number(productId);
    const importQty = Math.floor(Number(quantity));

    // Fetch product
    const existingProducts = await db.select().from(products).where(eq(products.id, targetProductId));
    if (existingProducts.length === 0) {
      return NextResponse.json({ success: false, error: 'Sản phẩm không tồn tại' }, { status: 404 });
    }

    const product = existingProducts[0];
    const previousStock = product.stockQuantity ?? 0;
    const newStock = previousStock + importQty;
    const newCostPrice = costPrice !== undefined && Number(costPrice) >= 0 ? Number(costPrice) : product.costPrice;

    // Update product stock and optionally cost price
    await db
      .update(products)
      .set({
        stockQuantity: newStock,
        costPrice: newCostPrice,
      })
      .where(eq(products.id, targetProductId));

    // Record inventory log
    await db.insert(inventoryLogs).values({
      productId: targetProductId,
      type: 'import',
      quantity: importQty,
      previousStock,
      newStock,
      note: note ? note.trim() : `Nhập kho +${importQty} ${product.unit}`,
      createdBy: user.id,
      createdAt: new Date().toISOString(),
    });

    // Record audit log
    await recordAuditLog({
      action: 'INVENTORY_IMPORT',
      entityType: 'product',
      entityId: targetProductId,
      performedBy: user.id,
      reason: note || `Nhập thêm ${importQty} ${product.unit} vào kho`,
      oldValue: { stockQuantity: previousStock, costPrice: product.costPrice },
      newValue: { stockQuantity: newStock, costPrice: newCostPrice },
    });

    return NextResponse.json({
      success: true,
      message: `Đã nhập kho thành công +${importQty} ${product.unit} cho mặt hàng "${product.name}"`,
      data: {
        productId: targetProductId,
        previousStock,
        newStock,
        costPrice: newCostPrice,
      },
    });
  } catch (error: any) {
    console.error('Error importing inventory:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
