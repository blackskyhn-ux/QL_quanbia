import { describe, it, expect, beforeAll } from 'vitest';
import { POST as createOrder } from '../../src/app/api/orders/route';
import { POST as payOrder } from '../../src/app/api/orders/[id]/pay/route';
import { db } from '../../src/db';
import { tables, products } from '../../src/db/schema';
import { setup } from '../setup/db';
import { signJWT } from '../../src/lib/auth';
import { eq } from 'drizzle-orm';

beforeAll(async () => {
  await setup();
});

describe('Table State Lifecycle Test Suite', () => {
  it('transitions table state: available -> occupied -> paid -> available', async () => {
    const token = await signJWT({ id: 1, username: 'admin', fullName: 'A', roleId: 1, roleName: 'admin' });
    const [table] = await db.select().from(tables).where(eq(tables.name, 'B03'));
    const [product] = await db.select().from(products).limit(1);

    // Initial state MUST be available
    expect(table.status).toBe('available');

    // 1. Create order -> table transitions to occupied
    const createReq = new Request('http://localhost/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': `pos_token=${token}` },
      body: JSON.stringify({
        tableId: table.id,
        items: [{ productId: product.id, productName: product.name, productPrice: product.price, quantity: 2 }]
      }),
    });

    const createRes = await createOrder(createReq);
    const createJson = await createRes.json();
    expect(createJson.success).toBe(true);
    const orderId = createJson.data.orderId;

    const [tableOccupied] = await db.select().from(tables).where(eq(tables.id, table.id));
    expect(tableOccupied.status).toBe('occupied');
    expect(tableOccupied.currentOrderId).toBe(orderId);

    // 2. Pay order -> table transitions to available
    const payReq = new Request(`http://localhost/api/orders/${orderId}/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': `pos_token=${token}` },
      body: JSON.stringify({ paymentMethod: 'cash' }),
    });
    const context = { params: Promise.resolve({ id: orderId.toString() }) };
    const payRes = await payOrder(payReq, context);
    expect(payRes.status).toBe(200);

    const [tableAvailable] = await db.select().from(tables).where(eq(tables.id, table.id));
    expect(tableAvailable.status).toBe('available');
    expect(tableAvailable.currentOrderId).toBeNull();
  });
});
