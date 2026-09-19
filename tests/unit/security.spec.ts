import { describe, it, expect, beforeAll } from 'vitest';
import { POST as createOrder } from '../../src/app/api/orders/route';
import { POST as createUser, GET as getUsers } from '../../src/app/api/users/route';
import { db } from '../../src/db';
import { tables, products, orders } from '../../src/db/schema';
import { setup } from '../setup/db';
import { signJWT } from '../../src/lib/auth';
import { eq } from 'drizzle-orm';

beforeAll(async () => {
  await setup();
});

describe('Security Audit & Input Validation Test Suite', () => {
  it('prevents price manipulation by trusting server DB price', async () => {
    const token = await signJWT({ id: 1, username: 'staff1', fullName: 'Staff', roleId: 4, roleName: 'staff' });
    const [table] = await db.select().from(tables).limit(1);
    const [product] = await db.select().from(products).where(eq(products.name, 'Phở Bò Đặc Biệt'));

    // Attacker tries to set price to 1 VND in payload
    const req = new Request('http://localhost/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': `pos_token=${token}` },
      body: JSON.stringify({
        tableId: table.id,
        items: [{ productId: product.id, productName: product.name, productPrice: 1, quantity: 2 }]
      }),
    });

    const res = await createOrder(req);
    const json = await res.json();
    expect(res.status).toBe(200);

    const [createdOrder] = await db.select().from(orders).where(eq(orders.id, json.data.orderId));
    // Amount MUST be 2 * actual DB price (e.g. 55000 * 2 = 110000), NOT 2 * 1 = 2 VND!
    expect(createdOrder.totalAmount).toBe(product.price * 2);
  });

  it('rejects negative quantity payloads with 400 Bad Request', async () => {
    const token = await signJWT({ id: 1, username: 'staff1', fullName: 'Staff', roleId: 4, roleName: 'staff' });
    const [table] = await db.select().from(tables).limit(1);
    const [product] = await db.select().from(products).limit(1);

    const req = new Request('http://localhost/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': `pos_token=${token}` },
      body: JSON.stringify({
        tableId: table.id,
        items: [{ productId: product.id, productName: product.name, productPrice: product.price, quantity: -5 }]
      }),
    });

    const res = await createOrder(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('không hợp lệ');
  });

  it('prevents IDOR & unauthorized user creation by staff role', async () => {
    const staffToken = await signJWT({ id: 2, username: 'staff', fullName: 'Staff', roleId: 4, roleName: 'staff' });

    const req = new Request('http://localhost/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': `pos_token=${staffToken}` },
      body: JSON.stringify({ username: 'hacker', password: '123', fullName: 'Hacker', roleId: 1 }),
    });

    const res = await createUser(req);
    expect(res.status).toBe(403); // Forbidden
  });

  it('does not expose password hashes in API GET responses', async () => {
    const adminToken = await signJWT({ id: 1, username: 'admin', fullName: 'Admin', roleId: 1, roleName: 'admin' });

    const req = new Request('http://localhost/api/users', {
      headers: { 'Cookie': `pos_token=${adminToken}` },
    });

    const res = await getUsers(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data.length).toBeGreaterThan(0);

    for (const u of json.data) {
      expect(u.passwordHash).toBeUndefined();
    }
  });

  it('handles malformed JSON payload with 400 or 500 without crashing node process', async () => {
    const token = await signJWT({ id: 1, username: 'admin', fullName: 'Admin', roleId: 1, roleName: 'admin' });

    const req = new Request('http://localhost/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': `pos_token=${token}` },
      body: 'INVALID_JSON_PAYLOAD{{{',
    });

    const res = await createOrder(req);
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});
