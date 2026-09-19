import { describe, it, expect, beforeAll } from 'vitest';
import { POST as createOrder } from '../../src/app/api/orders/route';
import { POST as payOrder } from '../../src/app/api/orders/[id]/pay/route';
import { POST as cancelOrder } from '../../src/app/api/orders/[id]/cancel/route';
import { db } from '../../src/db';
import { tables, products, inventoryLogs } from '../../src/db/schema';
import { setup } from '../setup/db';
import { signJWT } from '../../src/lib/auth';
import { eq } from 'drizzle-orm';

beforeAll(async () => {
  await setup();
});

describe('Inventory Management Test Suite', () => {
  it('deducts inventory on payment and restores inventory on order cancellation', async () => {
    const token = await signJWT({ id: 1, username: 'admin', fullName: 'A', roleId: 1, roleName: 'admin' });
    const [table] = await db.select().from(tables).limit(1);
    const [product] = await db.select().from(products).limit(1);

    const initialStock = product.stockQuantity || 100;

    // 1. Create order for 5 items
    const createReq = new Request('http://localhost/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': `pos_token=${token}` },
      body: JSON.stringify({
        tableId: table.id,
        items: [{ productId: product.id, productName: product.name, productPrice: product.price, quantity: 5 }]
      }),
    });
    const createRes = await createOrder(createReq);
    const createJson = await createRes.json();
    const orderId = createJson.data.orderId;

    // Before payment, stock MUST NOT be deducted yet
    const [prodBeforePay] = await db.select().from(products).where(eq(products.id, product.id));
    expect(prodBeforePay.stockQuantity).toBe(initialStock);

    // 2. Pay order -> Stock deducted by 5
    const payReq = new Request(`http://localhost/api/orders/${orderId}/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': `pos_token=${token}` },
      body: JSON.stringify({ paymentMethod: 'cash' }),
    });
    await payOrder(payReq, { params: Promise.resolve({ id: orderId.toString() }) });

    const [prodAfterPay] = await db.select().from(products).where(eq(products.id, product.id));
    expect(prodAfterPay.stockQuantity).toBe(initialStock - 5);

    // Verify inventory log entry created
    const logs = await db.select().from(inventoryLogs).where(eq(inventoryLogs.productId, product.id));
    expect(logs.length).toBeGreaterThan(0);
    const lastDeductLog = logs.find((l) => l.type === 'order_deduct');
    expect(lastDeductLog).toBeDefined();
    expect(lastDeductLog?.quantity).toBe(-5);

    // 3. Cancel order -> Stock restored by 5
    const cancelReq = new Request(`http://localhost/api/orders/${orderId}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': `pos_token=${token}` },
    });
    await cancelOrder(cancelReq, { params: Promise.resolve({ id: orderId.toString() }) });

    const [prodAfterCancel] = await db.select().from(products).where(eq(products.id, product.id));
    expect(prodAfterCancel.stockQuantity).toBe(initialStock);
  });
});
