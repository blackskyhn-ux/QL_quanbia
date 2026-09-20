import { NextResponse } from 'next/server';
import { db } from '@/db';
import { users, roles } from '@/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { getCurrentUser } from '@/lib/auth';
import { recordAuditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function GET(request?: Request) {
  try {
    const adminUser = await getCurrentUser(request);
    if (!adminUser || adminUser.roleName !== 'admin') {
      return NextResponse.json({ success: false, error: 'Không có quyền truy cập' }, { status: 403 });
    }

    const list = await db.select({
      id: users.id,
      username: users.username,
      fullName: users.fullName,
      phone: users.phone,
      status: users.status,
      roleId: users.roleId,
      roleName: roles.name,
      createdAt: users.createdAt,
    })
    .from(users)
    .leftJoin(roles, eq(users.roleId, roles.id));

    return NextResponse.json({ success: true, data: list });
  } catch (error: unknown) {
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const adminUser = await getCurrentUser(request);
    if (!adminUser || adminUser.roleName !== 'admin') {
       return NextResponse.json({ success: false, error: 'Chỉ Admin mới có quyền tạo tài khoản' }, { status: 403 });
    }

    const { username, password, fullName, phone, roleId } = await request.json();
    if (!username || !password || !fullName) {
      return NextResponse.json({ success: false, error: 'Thiếu thông tin bắt buộc' }, { status: 400 });
    }

    // Check if user exists
    const existing = await db.select().from(users).where(eq(users.username, username)).limit(1);
    if (existing.length > 0) {
      return NextResponse.json({ success: false, error: 'Tên đăng nhập đã tồn tại' }, { status: 400 });
    }

    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(password, salt);

    const inserted = await db.insert(users).values({
      username,
      passwordHash,
      fullName,
      phone,
      roleId: Number(roleId)
    }).returning({ id: users.id, username: users.username, fullName: users.fullName });

    await recordAuditLog({
      action: 'USER_CREATED',
      entityType: 'user',
      entityId: inserted[0].id,
      performedBy: adminUser.id,
      reason: `Tạo tài khoản người dùng mới: ${fullName} (${username})`,
      newValue: { username, fullName, roleId: Number(roleId), phone },
    });

    return NextResponse.json({ success: true, data: inserted[0] });
  } catch (error: unknown) {
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const adminUser = await getCurrentUser(request);
    if (!adminUser || adminUser.roleName !== 'admin') {
       return NextResponse.json({ success: false, error: 'Không có quyền' }, { status: 403 });
    }

    const { id, fullName, phone, roleId, status, password } = await request.json();
    if (!id) return NextResponse.json({ success: false, error: 'Thiếu ID' }, { status: 400 });

    const oldUserList = await db.select().from(users).where(eq(users.id, Number(id)));
    const oldUser = oldUserList[0];

    const updateData: Record<string, string | number> = {};
    if (fullName) updateData.fullName = fullName;
    if (phone !== undefined) updateData.phone = phone;
    if (roleId) updateData.roleId = Number(roleId);
    if (status) updateData.status = status;
    if (password && password.trim() !== '') {
       const salt = bcrypt.genSaltSync(10);
       updateData.passwordHash = bcrypt.hashSync(password, salt);
    }
    updateData.updatedAt = new Date().toISOString();

    const updated = await db.update(users).set(updateData).where(eq(users.id, Number(id))).returning({ id: users.id });

    await recordAuditLog({
      action: 'USER_UPDATED',
      entityType: 'user',
      entityId: Number(id),
      performedBy: adminUser.id,
      reason: `Cập nhật tài khoản người dùng #${id} (${oldUser?.username})`,
      oldValue: { fullName: oldUser?.fullName, roleId: oldUser?.roleId, status: oldUser?.status },
      newValue: { fullName, roleId, status, passwordChanged: Boolean(password) },
    });

    return NextResponse.json({ success: true, data: updated[0] });
  } catch (error: unknown) {
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
