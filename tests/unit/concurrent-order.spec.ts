import { describe, it, expect, beforeAll } from 'vitest';
import { POST as modifyOrder } from '../../src/app/api/orders/route';
import { db } from '../../src/db';
import { orders, orderItems, tables, products } from '../../src/db/schema';
import { setup } from '../setup/db';
import { signJWT } from '../../src/lib/auth';
import { eq } from 'drizzle-orm';

beforeAll(async () => {
  await setup();
});

describe('Concurrent Order Optimistic Locking (Version column)', () => {
  it('should reject stale updates with 409 Conflict using atomic version condition', async () => {
    const token = await signJWT({ id: 1, username: 'admin', fullName: 'A', roleId: 1, roleName: 'admin' });
    const [table] = await db.select().from(tables).where(eq(tables.name, 'Bàn 01'));
    const [pho] = await db.select().from(products).where(eq(products.name, 'Phở Bò Đặc Biệt'));
    const [coca] = await db.select().from(products).where(eq(products.name, 'Coca Cola Chai Glass'));

    // Step 1: Waiter A initializes order
    const initReq = new Request('http://localhost/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': `pos_token=${token}` },
      body: JSON.stringify({
        tableId: table.id,
        items: [{ productId: pho.id, productName: pho.name, productPrice: pho.price, quantity: 1 }]
      }),
    });
    const initRes = await modifyOrder(initReq);
    const { data: { orderId } } = await initRes.json();

    // Fetch initial order version from DB
    const initialOrders = await db.select().from(orders).where(eq(orders.id, orderId));
    const initialVersion = initialOrders[0].version;
    expect(initialVersion).toBe(1);

    // Waiter A and Waiter B attempt concurrent modifications passing initial version (1)
    const reqA = new Request('http://localhost/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': `pos_token=${token}` },
      body: JSON.stringify({
        tableId: table.id,
        items: [{ productId: pho.id, productName: pho.name, productPrice: pho.price, quantity: 2 }],
        version: initialVersion,
      }),
    });
    
    const reqB = new Request('http://localhost/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': `pos_token=${token}` },
      body: JSON.stringify({
        tableId: table.id,
        items: [
          { productId: pho.id, productName: pho.name, productPrice: pho.price, quantity: 1 },
          { productId: coca.id, productName: coca.name, productPrice: coca.price, quantity: 1 }
        ],
        version: initialVersion,
      }),
    });

    const [resA, resB] = await Promise.all([modifyOrder(reqA), modifyOrder(reqB)]);

    const statusA = resA.status;
    const statusB = resB.status;

    // ONE MUST SUCCEED (200) AND ONE MUST FAIL (409 Conflict)
    const statuses = [statusA, statusB].sort();
    expect(statuses).toEqual([200, 409]);

    // Check version increment in DB
    const updatedOrders = await db.select().from(orders).where(eq(orders.id, orderId));
    expect(updatedOrders[0].version).toBe(2);
  });

  it('should return 400 Bad Request when missing version on existing order update', async () => {
    const token = await signJWT({ id: 1, username: 'admin', fullName: 'A', roleId: 1, roleName: 'admin' });
    const [table] = await db.select().from(tables).where(eq(tables.name, 'Bàn 02'));
    const [pho] = await db.select().from(products).where(eq(products.name, 'Phở Bò Đặc Biệt'));

    // Step 1: Initialize order on B02
    const initReq = new Request('http://localhost/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': `pos_token=${token}` },
      body: JSON.stringify({
        tableId: table.id,
        items: [{ productId: pho.id, productName: pho.name, productPrice: pho.price, quantity: 1 }]
      }),
    });
    const initRes = await modifyOrder(initReq);
    expect(initRes.status).toBe(200);

    // Step 2: Update existing order WITHOUT version -> Expect 400
    const updateReqNoVersion = new Request('http://localhost/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': `pos_token=${token}` },
      body: JSON.stringify({
        tableId: table.id,
        items: [{ productId: pho.id, productName: pho.name, productPrice: pho.price, quantity: 3 }]
      }),
    });
    const noVersionRes = await modifyOrder(updateReqNoVersion);
    expect(noVersionRes.status).toBe(400);
    const bodyNoVersion = await noVersionRes.json();
    expect(bodyNoVersion.error).toContain('version');
  });
});
