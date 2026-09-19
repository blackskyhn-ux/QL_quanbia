import { describe, it, expect, beforeAll } from 'vitest';
import { POST as payOrder } from '../../src/app/api/orders/[id]/pay/route';
import { POST as createOrder } from '../../src/app/api/orders/route';
import { db } from '../../src/db';
import { inventoryLogs, tables, products, orders } from '../../src/db/schema';
import { setup } from '../setup/db';
import { signJWT } from '../../src/lib/auth';
import { eq } from 'drizzle-orm';

beforeAll(async () => {
  await setup();
});

describe('Double Payment Concurrency Verification', () => {
  it('should run double-payment concurrency test 10 times deterministically', async () => {
    const token = await signJWT({ id: 1, username: 'admin', fullName: 'A', roleId: 1, roleName: 'admin' });
    const [table] = await db.select().from(tables).where(eq(tables.name, 'B02'));
    const [product] = await db.select().from(products).limit(1);

    for (let i = 1; i <= 10; i++) {
      // 1. Create order
      const createReq = new Request('http://localhost/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': `pos_token=${token}` },
        body: JSON.stringify({
          tableId: table.id,
          items: [{ productId: product.id, productName: product.name, productPrice: product.price, quantity: 1 }]
        }),
      });

      const createRes = await createOrder(createReq);
      const createJson = await createRes.json();
      expect(createJson.success).toBe(true);
      const orderId = createJson.data.orderId;

      // Fetch initial inventory logs count for this product
      const initialLogs = await db.select().from(inventoryLogs).where(eq(inventoryLogs.productId, product.id));

      // 2. Fire 2 concurrent pay requests
      const payBody = JSON.stringify({ paymentMethod: 'cash' });
      const payReq1 = new Request(`http://localhost/api/orders/${orderId}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': `pos_token=${token}` },
        body: payBody,
      });
      const payReq2 = new Request(`http://localhost/api/orders/${orderId}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': `pos_token=${token}` },
        body: payBody,
      });

      const context = { params: Promise.resolve({ id: orderId.toString() }) };
      const [res1, res2] = await Promise.all([
        payOrder(payReq1, context),
        payOrder(payReq2, context)
      ]);

      const json1 = await res1.json();
      const json2 = await res2.json();

      // Check 1: EXACTLY 1 payment succeeded, 1 failed with 409 or error
      const successes = [json1.success, json2.success].filter((s) => s === true);
      expect(successes.length).toBe(1);

      // Check 2: Order status in DB MUST be completed and paid
      const [finalOrder] = await db.select().from(orders).where(eq(orders.id, orderId));
      expect(finalOrder.status).toBe('completed');
      expect(finalOrder.paymentStatus).toBe('paid');

      // Check 3: Inventory log length increased by EXACTLY 1
      const finalLogs = await db.select().from(inventoryLogs).where(eq(inventoryLogs.productId, product.id));
      expect(finalLogs.length).toBe(initialLogs.length + 1);
    }
  });
});
