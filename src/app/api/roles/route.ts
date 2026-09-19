import { NextResponse } from 'next/server';
import { db } from '@/db';
import { roles } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const adminUser = await getCurrentUser();
    if (!adminUser || adminUser.roleName !== 'admin') {
      return NextResponse.json({ success: false, error: 'Không có quyền truy cập' }, { status: 403 });
    }

    const list = await db.select().from(roles);
    return NextResponse.json({ success: true, data: list });
  } catch (error: unknown) {
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
