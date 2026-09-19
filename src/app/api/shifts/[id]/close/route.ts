import { NextResponse } from 'next/server';
import { db } from '@/db';
import { cashShifts, orders, cashTransactions } from '@/db/schema';
import { eq, and, gte, lte } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Chưa đăng nhập' }, { status: 401 });
    }

    const { id } = await params;
    const shiftId = Number(id);
    const body = await request.json();
    const { closingCash, notes } = body;

    if (closingCash === undefined || closingCash === null || isNaN(Number(closingCash))) {
      return NextResponse.json({ success: false, error: 'Số tiền thực tế trong két không hợp lệ' }, { status: 400 });
    }

    const shiftList = await db.select().from(cashShifts).where(eq(cashShifts.id, shiftId));
    if (shiftList.length === 0) {
      return NextResponse.json({ success: false, error: 'Ca làm việc không tồn tại' }, { status: 404 });
    }

    const shift = shiftList[0];
    if (shift.status === 'closed') {
      return NextResponse.json({ success: false, error: 'Ca làm việc này đã được chốt trước đó' }, { status: 400 });
    }

    const endTime = new Date().toISOString();
    const startTime = shift.startTime || new Date(0).toISOString();

    // Query completed orders within this shift timeframe
    const completedOrders = await db
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.status, 'completed'),
          eq(orders.paymentStatus, 'paid'),
          gte(orders.paidAt, startTime),
          lte(orders.paidAt, endTime)
        )
      );

    const totalCashSales = completedOrders
      .filter((o) => o.paymentMethod === 'cash')
      .reduce((sum, o) => sum + (o.finalAmount || 0), 0);

    const totalTransferSales = completedOrders
      .filter((o) => o.paymentMethod === 'transfer' || o.paymentMethod === 'card')
      .reduce((sum, o) => sum + (o.finalAmount || 0), 0);

    // Query expenses for this shift
    const transactions = await db.select().from(cashTransactions).where(eq(cashTransactions.shiftId, shiftId));
    const totalExpenses = transactions
      .filter((t) => t.type === 'out')
      .reduce((sum, t) => sum + (t.amount || 0), 0);

    const expectedCash = (shift.initialCash || 0) + totalCashSales - totalExpenses;
    const actualClosingCash = Number(closingCash);
    const differenceAmount = actualClosingCash - expectedCash;

    const updated = await db
      .update(cashShifts)
      .set({
        status: 'closed',
        endTime,
        closingCash: actualClosingCash,
        totalCashSales,
        totalTransferSales,
        totalExpenses,
        expectedCash,
        differenceAmount,
        notes: notes || shift.notes,
      })
      .where(eq(cashShifts.id, shiftId))
      .returning();

    return NextResponse.json({
      success: true,
      message: 'Chốt ca làm việc thành công!',
      data: updated[0],
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
