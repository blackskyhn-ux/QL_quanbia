import { NextResponse } from 'next/server';
import { db } from '@/db';
import { orders, tables, orderItems, products, inventoryLogs, auditLogs } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Chưa đăng nhập' }, { status: 401 });
    }

    // RBAC: Admin or Manager only
    const role = (user.roleName || '').toLowerCase().trim();
    const isManagement = ['admin', 'manager', 'quanly', 'quản lý', 'quản trị'].includes(role);
    if (!isManagement) {
      return NextResponse.json(
        { success: false, error: 'Chỉ Admin hoặc Quản lý mới có quyền hoàn tiền đơn hàng' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const orderId = Number(id);
    if (!orderId || isNaN(orderId)) {
      return NextResponse.json({ success: false, error: 'Mã đơn hàng không hợp lệ' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const reason = body.reason?.trim();
    if (!reason || reason.length < 3) {
      return NextResponse.json(
        { success: false, error: 'Vui lòng nhập lý do hoàn tiền (tối thiểu 3 ký tự)' },
        { status: 400 }
      );
    }

    let retries = 5;
    while (retries > 0) {
      try {
        await db.transaction(async (tx) => {
          const orderList = await tx.select().from(orders).where(eq(orders.id, orderId));
          if (orderList.length === 0) {
            throw new Error('Đơn hàng không tồn tại');
          }
          const order = orderList[0];

          if (order.paymentStatus === 'refunded') {
            throw new Error('Đơn hàng đã được hoàn tiền trước đó');
          }

          if (order.paymentStatus !== 'paid') {
            throw new Error('Chỉ có thể hoàn tiền đơn hàng đã thanh toán');
          }

          const nowIso = new Date().toISOString();
          const refundAmount = body.refundAmount !== undefined ? Number(body.refundAmount) : order.finalAmount;

          if (refundAmount <= 0 || refundAmount > order.finalAmount) {
            throw new Error('Số tiền hoàn trả không hợp lệ');
          }

          // ATOMIC CONDITIONAL CLAIM
          const updatedOrders = await tx
            .update(orders)
            .set({
              status: 'cancelled',
              paymentStatus: 'refunded',
              refundedAt: nowIso,
              refundedBy: user.id,
              refundReason: reason,
              refundAmount: refundAmount,
              version: sql`${orders.version} + 1`,
              updatedAt: nowIso,
            })
            .where(and(eq(orders.id, orderId), eq(orders.paymentStatus, 'paid')))
            .returning();

          if (updatedOrders.length === 0) {
            throw new Error('Đơn hàng đã được hoàn tiền bởi một giao dịch khác');
          }

          // Reset table status if assigned
          if (order.tableId) {
            await tx
              .update(tables)
              .set({
                status: 'available',
                currentOrderId: null,
                updatedAt: nowIso,
              })
              .where(eq(tables.id, Number(order.tableId)));
          }

          // Restore inventory
          const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId));
          for (const item of items) {
            const prodList = await tx.select().from(products).where(eq(products.id, item.productId));
            if (prodList.length > 0) {
              const prod = prodList[0];
              const currentStock = prod.stockQuantity || 0;
              const newStock = currentStock + item.quantity;

              await tx
                .update(products)
                .set({ stockQuantity: newStock })
                .where(eq(products.id, prod.id));

              await tx.insert(inventoryLogs).values({
                productId: prod.id,
                type: 'import',
                quantity: item.quantity,
                previousStock: currentStock,
                newStock: newStock,
                note: `Hoàn kho từ đơn hoàn tiền #${order.orderNumber}: ${reason}`,
                createdBy: user.id,
              });
            }
          }

          // Write audit log
          await tx.insert(auditLogs).values({
            action: 'ORDER_REFUNDED',
            entityType: 'order',
            entityId: orderId,
            performedBy: user.id,
            reason: reason,
            oldValue: JSON.stringify({
              paymentStatus: order.paymentStatus,
              finalAmount: order.finalAmount,
            }),
            newValue: JSON.stringify({
              paymentStatus: 'refunded',
              refundAmount: refundAmount,
            }),
          });
        });
        break; // Success
      } catch (err: any) {
        if (err.code === 'SQLITE_BUSY' || err.message?.includes('database is locked')) {
          retries--;
          if (retries === 0) throw err;
          await new Promise((resolve) => setTimeout(resolve, Math.floor(Math.random() * 100) + 50));
        } else {
          throw err;
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Hoàn tiền đơn hàng thành công!',
    });
  } catch (error: any) {
    if (error.message === 'Đơn hàng không tồn tại') return NextResponse.json({ success: false, error: error.message }, { status: 404 });
    if (error.message?.includes('hoàn tiền') || error.message?.includes('thay đổi')) {
      return NextResponse.json({ success: false, error: error.message }, { status: 409 });
    }
    if (error.message?.includes('không hợp lệ') || error.message?.includes('thanh toán')) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: error.message || 'Lỗi server' }, { status: 500 });
  }
}
