import { NextResponse } from 'next/server';
import { loginUser } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json({ success: false, error: 'Vui lòng nhập tên đăng nhập và mật khẩu' }, { status: 400 });
    }

    const result = await loginUser(username, password);

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 401 });
    }

    return NextResponse.json({ success: true, user: result.user });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Lỗi hệ thống khi đăng nhập' }, { status: 500 });
  }
}
