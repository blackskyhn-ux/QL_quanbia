import { describe, it, expect, beforeAll } from 'vitest';
import { POST as loginRoute } from '../../src/app/api/auth/login/route';
import { POST as logoutRoute } from '../../src/app/api/auth/logout/route';
import { GET as meRoute } from '../../src/app/api/auth/me/route';
import { GET as usersRoute } from '../../src/app/api/users/route';
import { db } from '../../src/db';
import { users } from '../../src/db/schema';
import { setup } from '../setup/db';
import { hashPassword } from '../../src/lib/auth';
import { eq } from 'drizzle-orm';

beforeAll(async () => {
  await setup();
  // Create an inactive user for test
  const passHash = await hashPassword('password123');
  await db.insert(users).values({
    username: 'disabled_user',
    passwordHash: passHash,
    fullName: 'Disabled Staff',
    roleId: 2,
    status: 'inactive',
  });
});

describe('Authentication Test Suite', () => {
  it('valid login returns 200 and user payload', async () => {
    const req = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'adminpassword' }),
    });

    const res = await loginRoute(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.user.username).toBe('admin');
  });

  it('invalid password returns 401', async () => {
    const req = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'wrongpassword' }),
    });

    const res = await loginRoute(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.success).toBe(false);
  });

  it('disabled account login returns 401 with inactive error', async () => {
    const req = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'disabled_user', password: 'password123' }),
    });

    const res = await loginRoute(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toContain('khóa');
  });

  it('protected route without token returns 401', async () => {
    const emptyReq = new Request('http://localhost/api/auth/me');
    const res = await meRoute(emptyReq);
    expect(res.status).toBe(401);
  });

  it('logout removes session', async () => {
    const res = await logoutRoute();
    expect(res.status).toBe(200);
  });

  it('invalid/malformed session cookie returns 403/401', async () => {
    const req = new Request('http://localhost/api/users', {
      headers: { 'Cookie': 'pos_token=invalid_malformed_jwt_token_xyz' },
    });
    const res = await usersRoute(req);
    expect([401, 403]).toContain(res.status);
  });
});
