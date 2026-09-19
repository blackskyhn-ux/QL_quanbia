import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import { db } from '@/db';
import { users, roles } from '@/db/schema';
import { eq } from 'drizzle-orm';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'quan-bia-pos-secret-key-super-secure-2026-billiards-beer'
);

export interface UserPayload {
  id: number;
  username: string;
  fullName: string;
  roleId: number;
  roleName: string;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function signJWT(payload: UserPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(JWT_SECRET);
}

export async function verifyJWT(token: string): Promise<UserPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as UserPayload;
  } catch {
    return null;
  }
}

export async function setAuthCookie(token: string) {
  try {
    const cookieStore = await cookies();
    cookieStore.set('pos_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24, // 24 hours
      path: '/',
    });
  } catch {
    // Graceful fallback for unit testing outside Next.js request context
  }
}

export async function removeAuthCookie() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete('pos_token');
  } catch {
    // Graceful fallback for unit testing
  }
}

export async function getCurrentUser(req?: Request): Promise<UserPayload | null> {
  let token: string | undefined;
  if (req) {
    const cookieHeader = req.headers.get('cookie') || '';
    const match = cookieHeader.match(/pos_token=([^;]+)/);
    if (match) token = match[1];
  }
  if (!token) {
    try {
      const cookieStore = await cookies();
      token = cookieStore.get('pos_token')?.value;
    } catch {
      // Fallback outside Next.js request context
    }
  }
  if (!token) return null;
  return verifyJWT(token);
}

export async function loginUser(username: string, password: string): Promise<{ success: boolean; error?: string; user?: UserPayload }> {
  const userList = await db
    .select({
      id: users.id,
      username: users.username,
      passwordHash: users.passwordHash,
      fullName: users.fullName,
      roleId: users.roleId,
      status: users.status,
      roleName: roles.name,
    })
    .from(users)
    .leftJoin(roles, eq(users.roleId, roles.id))
    .where(eq(users.username, username.trim()))
    .limit(1);

  if (userList.length === 0) {
    return { success: false, error: 'Tên đăng nhập hoặc mật khẩu không chính xác' };
  }

  const user = userList[0];

  if (user.status !== 'active') {
    return { success: false, error: 'Tài khoản đã bị khóa hoặc tạm ngưng' };
  }

  const isValid = await comparePassword(password, user.passwordHash);
  if (!isValid) {
    return { success: false, error: 'Tên đăng nhập hoặc mật khẩu không chính xác' };
  }

  const payload: UserPayload = {
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    roleId: user.roleId || 0,
    roleName: user.roleName || 'staff',
  };

  const token = await signJWT(payload);
  await setAuthCookie(token);

  return { success: true, user: payload };
}
