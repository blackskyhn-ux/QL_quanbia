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
    const { productId, newStockQuantity, reason } = body;

    if (!productId || newStockQuantity === undefined || Number(newStockQuantity) < 0) {
      return NextResponse.json(
        { success: false, error: 'Vui lòng chọn sản phẩm và nhập số lượng tồn thực tế hợp lệ (>= 0)' },
        { status: 400 }
      );
    }

    if (!reason || !reason.trim()) {
      return NextResponse.json(
        { success: false, error: 'Vui lòng nhập lý do kiểm kê / điều chỉnh tồn kho' },
        { status: 400 }
      );
    }

    const targetProductId = Number(productId);
    const targetStock = Math.floor(Number(newStockQuantity));

    // Fetch product
    const existingProducts = await db.select().from(products).where(eq(products.id, targetProductId));
    if (existingProducts.length === 0) {
      return NextResponse.json({ success: false, error: 'Sản phẩm không tồn tại' }, { status: 404 });
    }

    const product = existingProducts[0];
    const previousStock = product.stockQuantity ?? 0;
    const diff = targetStock - previousStock;

    if (diff === 0) {
      return NextResponse.json({
        success: true,
        message: 'Số lượng không thay đổi',
      });
    }

    // Update product stock
    await db
      .update(products)
      .set({ stockQuantity: targetStock })
      .where(eq(products.id, targetProductId));

    // Log type: export if negative diff, adjustment if positive or count edit
    const logType = diff < 0 ? 'export' : 'adjustment';

    // Record inventory log
    await db.insert(inventoryLogs).values({
      productId: targetProductId,
      type: logType,
      quantity: diff,
      previousStock,
      newStock: targetStock,
      note: reason.trim(),
      createdBy: user.id,
      createdAt: new Date().toISOString(),
    });

    // Record audit log
    await recordAuditLog({
      action: 'INVENTORY_ADJUSTED',
      entityType: 'product',
      entityId: targetProductId,
      performedBy: user.id,
      reason: reason.trim(),
      oldValue: { stockQuantity: previousStock },
      newValue: { stockQuantity: targetStock, diff },
    });

    return NextResponse.json({
      success: true,
      message: `Đã điều chỉnh kho mặt hàng "${product.name}": ${previousStock} ➔ ${targetStock} ${product.unit} (Lệch: ${diff > 0 ? '+' : ''}${diff})`,
      data: {
        productId: targetProductId,
        previousStock,
        newStock: targetStock,
        diff,
      },
    });
  } catch (error: any) {
    console.error('Error adjusting inventory:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
