import { NextResponse } from 'next/server';
import { db } from '@/db';
import { products } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';
import { recordAuditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function PUT(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Chưa đăng nhập' }, { status: 401 });
    }

    const body = await request.json();
    const { productId, minStockLevel, costPrice } = body;

    if (!productId) {
      return NextResponse.json({ success: false, error: 'Thiếu productId' }, { status: 400 });
    }

    const targetProductId = Number(productId);
    const existingProducts = await db.select().from(products).where(eq(products.id, targetProductId));
    if (existingProducts.length === 0) {
      return NextResponse.json({ success: false, error: 'Sản phẩm không tồn tại' }, { status: 404 });
    }

    const product = existingProducts[0];
    const updateData: any = {};

    if (minStockLevel !== undefined && Number(minStockLevel) >= 0) {
      updateData.minStockLevel = Math.floor(Number(minStockLevel));
    }

    if (costPrice !== undefined && Number(costPrice) >= 0) {
      updateData.costPrice = Number(costPrice);
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ success: false, error: 'Không có dữ liệu thay đổi' }, { status: 400 });
    }

    await db.update(products).set(updateData).where(eq(products.id, targetProductId));

    await recordAuditLog({
      action: 'INVENTORY_PRODUCT_SETTINGS_UPDATED',
      entityType: 'product',
      entityId: targetProductId,
      performedBy: user.id,
      reason: 'Cập nhật giá vốn hoặc ngưỡng cảnh báo tồn kho',
      oldValue: { minStockLevel: product.minStockLevel, costPrice: product.costPrice },
      newValue: updateData,
    });

    return NextResponse.json({
      success: true,
      message: `Đã cập nhật cấu hình cho "${product.name}"`,
    });
  } catch (error: any) {
    console.error('Error updating inventory product settings:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
