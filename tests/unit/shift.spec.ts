import { describe, it, expect, beforeAll } from 'vitest';
import { POST as openShift, GET as getShifts } from '../../src/app/api/shifts/route';
import { POST as closeShift } from '../../src/app/api/shifts/[id]/close/route';
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

describe('Shift Management Test Suite', () => {
  it('handles shift lifecycle: open -> calculate -> close with difference', async () => {
    const token = await signJWT({ id: 1, username: 'admin', fullName: 'A', roleId: 1, roleName: 'admin' });

    // 1. Open shift
    const reqOpen = new Request('http://localhost/api/shifts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': `pos_token=${token}` },
      body: JSON.stringify({ shiftName: 'Ca Sáng', initialCash: 100000 }),
    });
    const resOpen = await openShift(reqOpen);
    expect(resOpen.status).toBe(200);
    const jsonOpen = await resOpen.json();
    expect(jsonOpen.success).toBe(true);
    const shiftId = jsonOpen.data.id;

    // 2. Prevent duplicate active shift
    const reqDup = new Request('http://localhost/api/shifts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': `pos_token=${token}` },
      body: JSON.stringify({ shiftName: 'Ca Trưa', initialCash: 200000 }),
    });
    const resDup = await openShift(reqDup);
    expect(resDup.status).toBe(409); // Conflict

    // 3. Perform a cash order
    const [table] = await db.select().from(tables).limit(1);
    const [product] = await db.select().from(products).limit(1);

    const createReq = new Request('http://localhost/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': `pos_token=${token}` },
      body: JSON.stringify({
        tableId: table.id,
        items: [{ productId: product.id, productName: product.name, productPrice: 150000, quantity: 2 }]
      }),
    });
    const createRes = await createOrder(createReq);
    const createJson = await createRes.json();
    const orderId = createJson.data.orderId;

    const payReq = new Request(`http://localhost/api/orders/${orderId}/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': `pos_token=${token}` },
      body: JSON.stringify({ paymentMethod: 'cash', finalAmount: 300000 }),
    });
    const context = { params: Promise.resolve({ id: orderId.toString() }) };
    await payOrder(payReq, context);

    // 4. Close shift with actual cash 390000 (expected: 100K + 300K = 400K -> difference -10K)
    const closeReq = new Request(`http://localhost/api/shifts/${shiftId}/close`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': `pos_token=${token}` },
      body: JSON.stringify({ closingCash: 390000 }),
    });
    const closeContext = { params: Promise.resolve({ id: shiftId.toString() }) };
    const closeRes = await closeShift(closeReq, closeContext);
    expect(closeRes.status).toBe(200);
    const closeJson = await closeRes.json();
    
    expect(closeJson.data.expectedCash).toBe(400000);
    expect(closeJson.data.differenceAmount).toBe(-10000);
    expect(closeJson.data.status).toBe('closed');
  });
});
