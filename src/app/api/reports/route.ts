import { NextResponse } from 'next/server';
import { db } from '@/db';
import { orders } from '@/db/schema';
import { eq, and, gte, lte, desc } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Chưa đăng nhập' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'all'; // 'today', 'yesterday', '7days', 'month', 'custom'
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');

    const allOrders = await db.select().from(orders).orderBy(desc(orders.createdAt));

    // Get current date in Asia/Ho_Chi_Minh timezone
    const now = new Date();
    // Offset for Asia/Ho_Chi_Minh (UTC+7)
    const vnTimezoneOffset = 7 * 60; // minutes
    const utcDate = new Date(now.getTime() + now.getTimezoneOffset() * 60000);
    const vnDate = new Date(utcDate.getTime() + vnTimezoneOffset * 60000);

    const getVnDateString = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const todayStr = getVnDateString(vnDate);

    const yesterdayDate = new Date(vnDate.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayStr = getVnDateString(yesterdayDate);

    const sevenDaysAgoDate = new Date(vnDate.getTime() - 7 * 24 * 60 * 60 * 1000);
    const sevenDaysAgoStr = getVnDateString(sevenDaysAgoDate);

    const monthStartStr = `${vnDate.getFullYear()}-${String(vnDate.getMonth() + 1).padStart(2, '0')}-01`;

    let filteredOrders = allOrders;

    if (period === 'today') {
      filteredOrders = allOrders.filter((o) => o.createdAt && o.createdAt.startsWith(todayStr));
    } else if (period === 'yesterday') {
      filteredOrders = allOrders.filter((o) => o.createdAt && o.createdAt.startsWith(yesterdayStr));
    } else if (period === '7days') {
      filteredOrders = allOrders.filter((o) => o.createdAt && o.createdAt >= sevenDaysAgoStr);
    } else if (period === 'month') {
      filteredOrders = allOrders.filter((o) => o.createdAt && o.createdAt >= monthStartStr);
    } else if (period === 'custom' && startDateParam && endDateParam) {
      filteredOrders = allOrders.filter(
        (o) => o.createdAt && o.createdAt >= startDateParam && o.createdAt <= `${endDateParam}T23:59:59`
      );
    }

    // Revenue MUST ONLY sum completed/paid orders! Cancelled and serving orders are ignored for total revenue.
    const completedOrders = filteredOrders.filter((o) => o.status === 'completed' && o.paymentStatus === 'paid');
    const cancelledOrders = filteredOrders.filter((o) => o.status === 'cancelled');
    const servingOrders = filteredOrders.filter((o) => o.status === 'serving');

    const totalRevenue = completedOrders.reduce((sum, o) => sum + (o.finalAmount || 0), 0);
    const totalCashSales = completedOrders
      .filter((o) => o.paymentMethod === 'cash')
      .reduce((sum, o) => sum + (o.finalAmount || 0), 0);
    const totalTransferSales = completedOrders
      .filter((o) => o.paymentMethod === 'transfer' || o.paymentMethod === 'card')
      .reduce((sum, o) => sum + (o.finalAmount || 0), 0);

    return NextResponse.json({
      success: true,
      data: {
        totalRevenue,
        totalCashSales,
        totalTransferSales,
        completedCount: completedOrders.length,
        cancelledCount: cancelledOrders.length,
        servingCount: servingOrders.length,
        orders: filteredOrders,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
