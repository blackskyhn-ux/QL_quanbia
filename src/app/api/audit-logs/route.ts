import { NextResponse } from 'next/server';
import { db } from '@/db';
import { auditLogs, users } from '@/db/schema';
import { eq, desc, and, gte, lte, like, or, sql, count } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ success: false, error: 'Chưa đăng nhập' }, { status: 401 });
    }

    // RBAC: Admin or Manager only
    const role = (currentUser.roleName || '').toLowerCase().trim();
    const isManagement = ['admin', 'manager', 'quanly', 'quản lý', 'quản trị'].includes(role);
    if (!isManagement) {
      return NextResponse.json(
        { success: false, error: 'Chỉ Admin hoặc Quản lý mới có quyền truy cập nhật ký hoạt động' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 20));
    const offset = (page - 1) * limit;

    const category = searchParams.get('category') || 'all';
    const actionParam = searchParams.get('action');
    const search = (searchParams.get('search') || '').trim();
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const performedBy = searchParams.get('performedBy');

    const conditions: any[] = [];

    // Category filter mapping
    if (category === 'financial') {
      conditions.push(
        or(
          eq(auditLogs.action, 'PAYMENT_COMPLETED'),
          eq(auditLogs.action, 'ORDER_CANCELLED'),
          eq(auditLogs.action, 'ORDER_CANCELLED_WITH_REFUND'),
          eq(auditLogs.action, 'ORDER_REFUNDED'),
          eq(auditLogs.action, 'DISCOUNT_APPLIED')
        )
      );
    } else if (category === 'orders') {
      conditions.push(
        or(
          eq(auditLogs.action, 'ORDER_CREATED'),
          eq(auditLogs.action, 'ORDER_UPDATED'),
          eq(auditLogs.action, 'ITEM_CANCELLED'),
          eq(auditLogs.action, 'TABLE_MOVED'),
          eq(auditLogs.action, 'TABLE_MERGED')
        )
      );
    } else if (category === 'inventory') {
      conditions.push(
        or(
          eq(auditLogs.action, 'PRODUCT_CREATED'),
          eq(auditLogs.action, 'PRODUCT_UPDATED'),
          eq(auditLogs.action, 'PRODUCT_DELETED'),
          eq(auditLogs.action, 'CATEGORY_CREATED'),
          eq(auditLogs.action, 'CATEGORY_UPDATED'),
          eq(auditLogs.action, 'CATEGORY_DELETED'),
          eq(auditLogs.action, 'INVENTORY_ADJUSTED')
        )
      );
    } else if (category === 'security') {
      conditions.push(
        or(
          eq(auditLogs.action, 'USER_LOGIN'),
          eq(auditLogs.action, 'USER_LOGOUT'),
          eq(auditLogs.action, 'USER_CREATED'),
          eq(auditLogs.action, 'USER_UPDATED'),
          eq(auditLogs.action, 'USER_DELETED'),
          eq(auditLogs.action, 'SETTING_UPDATED')
        )
      );
    }

    if (actionParam) {
      conditions.push(eq(auditLogs.action, actionParam.toUpperCase()));
    }

    if (performedBy) {
      conditions.push(eq(auditLogs.performedBy, Number(performedBy)));
    }

    if (startDate) {
      const startIso = startDate.includes('T') ? startDate : `${startDate}T00:00:00.000Z`;
      conditions.push(gte(auditLogs.createdAt, startIso));
    }

    if (endDate) {
      const endIso = endDate.includes('T') ? endDate : `${endDate}T23:59:59.999Z`;
      conditions.push(lte(auditLogs.createdAt, endIso));
    }

    if (search) {
      const pattern = `%${search}%`;
      conditions.push(
        or(
          like(auditLogs.action, pattern),
          like(auditLogs.reason, pattern),
          like(auditLogs.entityType, pattern),
          like(auditLogs.oldValue, pattern),
          like(auditLogs.newValue, pattern),
          like(users.fullName, pattern),
          like(users.username, pattern)
        )
      );
    }

    const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const totalResult = await db
      .select({ count: count() })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.performedBy, users.id))
      .where(whereCondition);

    const total = totalResult[0]?.count || 0;

    // Fetch paginated log entries joined with performer user details
    const logs = await db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        entityType: auditLogs.entityType,
        entityId: auditLogs.entityId,
        performedBy: auditLogs.performedBy,
        reason: auditLogs.reason,
        oldValue: auditLogs.oldValue,
        newValue: auditLogs.newValue,
        createdAt: auditLogs.createdAt,
        performerName: users.fullName,
        performerUsername: users.username,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.performedBy, users.id))
      .where(whereCondition)
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset(offset);

    // Calculate executive summary stats for dashboard
    const allLogsForStats = await db.select().from(auditLogs);
    
    let sensitiveCount = 0;
    let financialRefundTotal = 0;
    let tableMoveCount = 0;

    allLogsForStats.forEach((log) => {
      if (['ORDER_CANCELLED', 'ORDER_CANCELLED_WITH_REFUND', 'ORDER_REFUNDED', 'ITEM_CANCELLED'].includes(log.action)) {
        sensitiveCount++;
      }
      if (['TABLE_MOVED', 'TABLE_MERGED'].includes(log.action)) {
        tableMoveCount++;
      }
      if (log.action === 'ORDER_REFUNDED' || log.action === 'ORDER_CANCELLED_WITH_REFUND') {
        try {
          const val = JSON.parse(log.newValue || '{}');
          if (val.refundAmount) {
            financialRefundTotal += Number(val.refundAmount) || 0;
          }
        } catch {}
      }
    });

    return NextResponse.json({
      success: true,
      data: logs,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
      stats: {
        totalLogs: allLogsForStats.length,
        sensitiveCount,
        financialRefundTotal,
        tableMoveCount,
      },
    });
  } catch (error: any) {
    console.error('API Audit Logs GET Error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Lỗi server' }, { status: 500 });
  }
}
