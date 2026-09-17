import { NextResponse } from 'next/server';
import { db } from '@/db';
import { settings } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth';

export async function GET() {
  try {
    const allSettings = await db.select().from(settings);
    const settingsObject = allSettings.reduce((acc, curr) => {
      acc[curr.key] = curr.value || '';
      return acc;
    }, {} as Record<string, string>);

    return NextResponse.json({ success: true, settings: settingsObject });
  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json({ success: false, error: 'Lỗi khi tải cấu hình' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.roleName !== 'admin') {
      return NextResponse.json({ success: false, error: 'Chỉ Admin mới có quyền cập nhật cấu hình' }, { status: 403 });
    }

    const body = await req.json();
    
    // We expect a record of keys and values
    const entries = Object.entries(body).filter(([_, v]) => typeof v === 'string');
    
    for (const [key, value] of entries) {
      await db.insert(settings)
        .values({ key, value: value as string })
        .onConflictDoUpdate({
          target: settings.key,
          set: { value: value as string }
        });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating settings:', error);
    return NextResponse.json({ success: false, error: 'Lỗi khi lưu cấu hình' }, { status: 500 });
  }
}
