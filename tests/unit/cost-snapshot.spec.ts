import { describe, it, expect, beforeAll } from 'vitest';
import { POST as createOrder } from '../../src/app/api/orders/route';
import { db } from '../../src/db';
import { orderItems, products, tables } from '../../src/db/schema';
import { setup } from '../setup/db';
import { eq } from 'drizzle-orm';
import { signJWT } from '../../src/lib/auth';

beforeAll(async () => {
  await setup();
});

describe('Cost Snapshot Validation', () => {
  it('should snapshot product costPrice in orderItems and preserve it when product cost changes later', async () => {
    const token = await signJWT({ id: 1, username: 'admin', fullName: 'A', roleId: 1, roleName: 'admin' });

    // 1. Fetch table & product
    const [table] = await db.select().from(tables).limit(1);
    const [product] = await db.select().from(products).limit(1);

    // Set initial product cost
    const initialCost = 15000;
    await db.update(products).set({ costPrice: initialCost }).where(eq(products.id, product.id));

    // 2. Create order
    const req = new Request('http://localhost/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': `pos_token=${token}` },
      body: JSON.stringify({
        tableId: table.id,
        items: [{ productId: product.id, productName: product.name, productPrice: product.price, quantity: 2 }]
      }),
    });

    const res = await createOrder(req);
    const json = await res.json();
    expect(json.success).toBe(true);
    const orderId = json.data.orderId;

    // 3. Update product costPrice in DB later to a new value
    await db.update(products).set({ costPrice: 35000 }).where(eq(products.id, product.id));

    // 4. Verify order_items preserves the snapshotted unitCost of 15000
    const [item] = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
    expect(item.unitCost).toBe(initialCost);
  });
});
