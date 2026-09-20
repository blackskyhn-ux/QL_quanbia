import { NextResponse } from 'next/server';
import { db } from '@/db';
import { orders, orderItems, cashShifts } from '@/db/schema';
import { inArray, desc, gte, lte, and } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';
import { ensureDbInitialized } from '@/db/init';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    await ensureDbInitialized();
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Chưa đăng nhập' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'today';
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');

    // Calculate dates in UTC+7 (Asia/Ho_Chi_Minh)
    const now = new Date();
    const vnTimezoneOffset = 7 * 60; // minutes
    const utcDate = new Date(now.getTime() + now.getTimezoneOffset() * 60000);
    const vnDate = new Date(utcDate.getTime() + vnTimezoneOffset * 60000);

    const formatVnDate = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const todayStr = formatVnDate(vnDate);
    const yesterdayDate = new Date(vnDate.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayStr = formatVnDate(yesterdayDate);
    const sevenDaysAgoDate = new Date(vnDate.getTime() - 6 * 24 * 60 * 60 * 1000);
    const sevenDaysAgoStr = formatVnDate(sevenDaysAgoDate);
    const thirtyDaysAgoDate = new Date(vnDate.getTime() - 29 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgoStr = formatVnDate(thirtyDaysAgoDate);

    const monthStartStr = `${vnDate.getFullYear()}-${String(vnDate.getMonth() + 1).padStart(2, '0')}-01`;
    const lastMonthDate = new Date(vnDate.getFullYear(), vnDate.getMonth() - 1, 1);
    const lastMonthStartStr = formatVnDate(lastMonthDate);
    const lastMonthEndObj = new Date(vnDate.getFullYear(), vnDate.getMonth(), 0);
    const lastMonthEndStr = formatVnDate(lastMonthEndObj);
    const yearStartStr = `${vnDate.getFullYear()}-01-01`;

    let dateCondition;

    if (period === 'today') {
      dateCondition = and(gte(orders.createdAt, todayStr), lte(orders.createdAt, `${todayStr}T23:59:59`));
    } else if (period === 'yesterday') {
      dateCondition = and(gte(orders.createdAt, yesterdayStr), lte(orders.createdAt, `${yesterdayStr}T23:59:59`));
    } else if (period === '7days') {
      dateCondition = gte(orders.createdAt, sevenDaysAgoStr);
    } else if (period === '30days') {
      dateCondition = gte(orders.createdAt, thirtyDaysAgoStr);
    } else if (period === 'month') {
      dateCondition = gte(orders.createdAt, monthStartStr);
    } else if (period === 'last_month') {
      dateCondition = and(gte(orders.createdAt, lastMonthStartStr), lte(orders.createdAt, `${lastMonthEndStr}T23:59:59`));
    } else if (period === 'year') {
      dateCondition = gte(orders.createdAt, yearStartStr);
    } else if (period === 'custom' && startDateParam && endDateParam) {
      dateCondition = and(gte(orders.createdAt, startDateParam), lte(orders.createdAt, `${endDateParam}T23:59:59`));
    }

    const filteredOrders = await db
      .select()
      .from(orders)
      .where(dateCondition)
      .orderBy(desc(orders.createdAt));

    const completedOrders = filteredOrders.filter((o) => o.status === 'completed' && o.paymentStatus === 'paid');
    const cancelledOrders = filteredOrders.filter((o) => o.status === 'cancelled');
    const servingOrders = filteredOrders.filter((o) => o.status === 'serving');
    const completedOrderIds = completedOrders.map((o) => o.id);

    let itemsForCompleted: any[] = [];
    if (completedOrderIds.length > 0) {
      itemsForCompleted = await db
        .select()
        .from(orderItems)
        .where(inArray(orderItems.orderId, completedOrderIds));
    }

    // Pre-calculate Map for order -> COGS (O(N) instead of O(N*M))
    const orderCogsMap = new Map<number, number>();
    for (const item of itemsForCompleted) {
      const itemCost = (item.unitCost !== undefined && item.unitCost !== null ? Number(item.unitCost) : 0) * Number(item.quantity || 1);
      const current = orderCogsMap.get(item.orderId) || 0;
      orderCogsMap.set(item.orderId, current + itemCost);
    }

    const totalRevenue = completedOrders.reduce((sum, o) => sum + (o.finalAmount || 0), 0);
    const totalDiscount = completedOrders.reduce((sum, o) => sum + (o.discountAmount || 0), 0);
    const cogs = itemsForCompleted.reduce((sum, item) => {
      const itemCost = item.unitCost !== undefined && item.unitCost !== null ? Number(item.unitCost) : 0;
      return sum + itemCost * Number(item.quantity || 1);
    }, 0);

    const grossProfit = totalRevenue - cogs;
    const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
    const completedCount = completedOrders.length;
    const cancelledCount = cancelledOrders.length;
    const cancelledAmount = cancelledOrders.reduce(
      (sum, o) => sum + (o.refundAmount || o.finalAmount || 0),
      0
    );
    const averageOrderValue = completedCount > 0 ? totalRevenue / completedCount : 0;

    const paymentMethods = {
      cash: {
        count: completedOrders.filter((o) => o.paymentMethod === 'cash').length,
        total: completedOrders.filter((o) => o.paymentMethod === 'cash').reduce((s, o) => s + (o.finalAmount || 0), 0),
      },
      transfer: {
        count: completedOrders.filter((o) => o.paymentMethod === 'transfer').length,
        total: completedOrders.filter((o) => o.paymentMethod === 'transfer').reduce((s, o) => s + (o.finalAmount || 0), 0),
      },
      card: {
        count: completedOrders.filter((o) => o.paymentMethod === 'card').length,
        total: completedOrders.filter((o) => o.paymentMethod === 'card').reduce((s, o) => s + (o.finalAmount || 0), 0),
      },
    };

    const productMap = new Map<number, { name: string; quantity: number; revenue: number; cogs: number; profit: number }>();
    for (const item of itemsForCompleted) {
      const pid = item.productId;
      const qty = Number(item.quantity || 1);
      const rev = Number(item.amount || 0);
      const itemCost = (item.unitCost !== undefined && item.unitCost !== null ? Number(item.unitCost) : 0) * qty;
      const existing = productMap.get(pid) || { name: item.productName || 'Sản phẩm', quantity: 0, revenue: 0, cogs: 0, profit: 0 };
      existing.quantity += qty;
      existing.revenue += rev;
      existing.cogs += itemCost;
      existing.profit += rev - itemCost;
      productMap.set(pid, existing);
    }
    const topProducts = Array.from(productMap.values()).sort((a, b) => b.revenue - a.revenue);

    const trendMap = new Map<string, { label: string; revenue: number; profit: number; orderCount: number }>();
    for (const order of completedOrders) {
      if (!order.createdAt) continue;
      const dateKey = order.createdAt.substring(0, 10);
      const existing = trendMap.get(dateKey) || { label: dateKey, revenue: 0, profit: 0, orderCount: 0 };
      existing.revenue += order.finalAmount || 0;
      existing.orderCount += 1;
      const orderCogs = orderCogsMap.get(order.id) || 0;
      existing.profit += (order.finalAmount || 0) - orderCogs;
      trendMap.set(dateKey, existing);
    }
    const trend = Array.from(trendMap.values()).sort((a, b) => a.label.localeCompare(b.label));

    const shifts = await db.select().from(cashShifts).orderBy(desc(cashShifts.startTime)).limit(10);

    return NextResponse.json({
      success: true,
      data: {
        totalRevenue,
        totalCashSales: paymentMethods.cash.total,
        totalTransferSales: paymentMethods.transfer.total,
        completedCount,
        cancelledCount,
        servingCount: servingOrders.length,
        summary: {
          totalRevenue,
          cogs,
          grossProfit,
          grossMargin,
          totalDiscount,
          completedCount,
          cancelledCount,
          cancelledAmount,
          servingCount: servingOrders.length,
          averageOrderValue,
        },
        paymentMethods,
        topProducts,
        trend,
        shifts,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
