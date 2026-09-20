import { NextResponse } from 'next/server';
import { removeAuthCookie, getCurrentUser } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (user) {
      const { recordAuditLog } = await import('@/lib/audit');
      await recordAuditLog({
        action: 'USER_LOGOUT',
        entityType: 'auth',
        entityId: user.id,
        performedBy: user.id,
        reason: `Người dùng ${user.fullName} (${user.username}) đăng xuất khỏi hệ thống`,
      });
    }
  } catch {}

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
