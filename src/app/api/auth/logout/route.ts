import { NextResponse } from 'next/server';
import { removeAuthCookie, getCurrentUser } from '@/lib/auth';

export async function POST() {
  await removeAuthCookie();
  return NextResponse.json({ success: true, message: 'Đã đăng xuất thành công' });
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ success: false, error: 'Chưa đăng nhập' }, { status: 401 });
  }
  return NextResponse.json({ success: true, user });
}
