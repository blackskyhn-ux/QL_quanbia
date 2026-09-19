import { NextResponse } from 'next/server';
import { db } from '@/db';
import { cashShifts, orders, cashTransactions } from '@/db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Chưa đăng nhập' }, { status: 401 });
    }

    const activeShifts = await db
      .select()
      .from(cashShifts)
      .where(eq(cashShifts.status, 'open'))
      .orderBy(desc(cashShifts.startTime))
      .limit(1);

    const allShifts = await db
      .select()
      .from(cashShifts)
      .orderBy(desc(cashShifts.id))
      .limit(20);

    return NextResponse.json({
      success: true,
      activeShift: activeShifts[0] || null,
      shifts: allShifts,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Chưa đăng nhập' }, { status: 401 });
    }

    const body = await request.json();
    const { shiftName, initialCash, notes } = body;

    if (!shiftName) {
      return NextResponse.json({ success: false, error: 'Tên ca làm việc không được để trống' }, { status: 400 });
    }

    const activeShifts = await db
      .select()
      .from(cashShifts)
      .where(eq(cashShifts.status, 'open'));

    if (activeShifts.length > 0) {
      return NextResponse.json({
        success: false,
        error: 'Đã có ca làm việc đang mở. Vui lòng chốt ca hiện tại trước khi mở ca mới!',
      }, { status: 409 });
    }

    const inserted = await db
      .insert(cashShifts)
      .values({
        userId: user.id,
        shiftName: shiftName || 'Ca làm việc',
        initialCash: Number(initialCash || 0),
        status: 'open',
        notes: notes || '',
        startTime: new Date().toISOString(),
      })
      .returning();

    return NextResponse.json({
      success: true,
      message: 'Mở ca làm việc thành công!',
      data: inserted[0],
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
