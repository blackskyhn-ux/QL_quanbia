import { NextResponse } from 'next/server';
import { db } from '@/db';
import { orders, orderItems, products, categories, cashShifts } from '@/db/schema';
import { eq, inArray, desc } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Chưa đăng nhập' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'today'; // 'today', 'yesterday', '7days', '30days', 'month', 'last_month', 'year', 'custom'
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');

    const allOrders = await db.select().from(orders).orderBy(desc(orders.createdAt));

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

    let filteredOrders = allOrders;

    if (period === 'today') {
      filteredOrders = allOrders.filter((o) => o.createdAt && o.createdAt.startsWith(todayStr));
    } else if (period === 'yesterday') {
      filteredOrders = allOrders.filter((o) => o.createdAt && o.createdAt.startsWith(yesterdayStr));
    } else if (period === '7days') {
      filteredOrders = allOrders.filter((o) => o.createdAt && o.createdAt >= sevenDaysAgoStr);
    } else if (period === '30days') {
      filteredOrders = allOrders.filter((o) => o.createdAt && o.createdAt >= thirtyDaysAgoStr);
    } else if (period === 'month') {
      filteredOrders = allOrders.filter((o) => o.createdAt && o.createdAt >= monthStartStr);
    } else if (period === 'last_month') {
      filteredOrders = allOrders.filter(
        (o) => o.createdAt && o.createdAt >= lastMonthStartStr && o.createdAt <= `${lastMonthEndStr}T23:59:59`
      );
    } else if (period === 'year') {
      filteredOrders = allOrders.filter((o) => o.createdAt && o.createdAt >= yearStartStr);
    } else if (period === 'custom' && startDateParam && endDateParam) {
      filteredOrders = allOrders.filter(
        (o) => o.createdAt && o.createdAt >= startDateParam && o.createdAt <= `${endDateParam}T23:59:59`
      );
    }

    // Classify orders
    const completedOrders = filteredOrders.filter((o) => o.status === 'completed' && o.paymentStatus === 'paid');
    const cancelledOrders = filteredOrders.filter((o) => o.status === 'cancelled');
    const servingOrders = filteredOrders.filter((o) => o.status === 'serving');

    const completedOrderIds = completedOrders.map((o) => o.id);

    // Fetch order items for COGS and Product/Category breakdown
    let itemsForCompleted: any[] = [];
    if (completedOrderIds.length > 0) {
      itemsForCompleted = await db
        .select()
        .from(orderItems)
        .where(inArray(orderItems.orderId, completedOrderIds));
    }

    // Financial KPIs
    const totalRevenue = completedOrders.reduce((sum, o) => sum + (o.finalAmount || 0), 0);
    const totalDiscount = completedOrders.reduce((sum, o) => sum + (o.discountAmount || 0), 0);
    
    // COGS = sum of (unitCost * quantity) for all completed order items
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

    // Payment methods breakdown
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

    // Product performance breakdown
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

    // Time trend calculation (Group by date or hour)
    const trendMap = new Map<string, { label: string; revenue: number; profit: number; orderCount: number }>();
    for (const order of completedOrders) {
      if (!order.createdAt) continue;
      // Extract date label YYYY-MM-DD
      const dateKey = order.createdAt.substring(0, 10);
      const existing = trendMap.get(dateKey) || { label: dateKey, revenue: 0, profit: 0, orderCount: 0 };
      existing.revenue += order.finalAmount || 0;
      existing.orderCount += 1;

      // Estimate order profit by item proportion
      const orderItemsList = itemsForCompleted.filter((i) => i.orderId === order.id);
      const orderCogs = orderItemsList.reduce(
        (sum, i) => sum + (Number(i.unitCost || 0) * Number(i.quantity || 1)),
        0
      );
      existing.profit += (order.finalAmount || 0) - orderCogs;

      trendMap.set(dateKey, existing);
    }
    const trend = Array.from(trendMap.values()).sort((a, b) => a.label.localeCompare(b.label));

    // Shift summary for period
    const shifts = await db.select().from(cashShifts).orderBy(desc(cashShifts.startTime));

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
        shifts: shifts.slice(0, 10),
        orders: filteredOrders,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
