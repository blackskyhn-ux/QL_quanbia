import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request?: Request) {
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ success: false, error: 'Chưa đăng nhập' }, { status: 401 });
  }
  return NextResponse.json({ success: true, user });
}
