import { describe, it, expect, beforeAll } from 'vitest';
import { POST as loginRoute } from '../../src/app/api/auth/login/route';
import { POST as openShift } from '../../src/app/api/shifts/route';
import { POST as createOrder, GET as getOrders } from '../../src/app/api/orders/route';
import { POST as payOrder } from '../../src/app/api/orders/[id]/pay/route';
import { GET as getReports } from '../../src/app/api/reports/route';
import { db } from '../../src/db';
import { tables, products, orders } from '../../src/db/schema';
import { setup } from '../setup/db';
import { signJWT } from '../../src/lib/auth';
import { eq } from 'drizzle-orm';

beforeAll(async () => {
  await setup();
});

describe('Golden Path End-to-End Simulation Suite', () => {
  it('executes full Golden Path workflow seamlessly from Login to Report', async () => {
    // 1. LOGIN
    const loginReq = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'adminpassword' }),
    });
    const loginRes = await loginRoute(loginReq);
    expect(loginRes.status).toBe(200);

    const token = await signJWT({ id: 1, username: 'admin', fullName: 'Admin', roleId: 1, roleName: 'admin' });

    // 2. OPEN SHIFT
    const shiftReq = new Request('http://localhost/api/shifts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': `pos_token=${token}` },
      body: JSON.stringify({ shiftName: 'Ca Sáng', initialCash: 500000 }),
    });
    const shiftRes = await openShift(shiftReq);
    expect(shiftRes.status).toBe(200);

    // 3. OPEN B01 & ADD PRODUCTS & SAVE
    const [b01] = await db.select().from(tables).where(eq(tables.name, 'B01'));
    const [pho] = await db.select().from(products).where(eq(products.name, 'Phở Bò Đặc Biệt'));
    const [coca] = await db.select().from(products).where(eq(products.name, 'Coca Cola Chai Glass'));

    const createReq = new Request('http://localhost/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': `pos_token=${token}` },
      body: JSON.stringify({
        tableId: b01.id,
        items: [{ productId: pho.id, productName: pho.name, productPrice: pho.price, quantity: 2 }]
      }),
    });
    const createRes = await createOrder(createReq);
    expect(createRes.status).toBe(200);
    const createJson = await createRes.json();
    const orderId = createJson.data.orderId;

    // 4. VERIFY PERSISTENCE (Reload / Get orders)
    const getReq = new Request(`http://localhost/api/orders?tableId=${b01.id}&status=serving`, {
      headers: { 'Cookie': `pos_token=${token}` },
    });
    const getRes = await getOrders(getReq);
    const getJson = await getRes.json();
    expect(getJson.data.length).toBe(1);
    expect(getJson.data[0].id).toBe(orderId);
    expect(getJson.data[0].items.length).toBe(1);

    // 5. ADD MORE PRODUCTS TO ORDER
    const updateReq = new Request('http://localhost/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': `pos_token=${token}` },
      body: JSON.stringify({
        tableId: b01.id,
        items: [
          { productId: pho.id, productName: pho.name, productPrice: pho.price, quantity: 2 },
          { productId: coca.id, productName: coca.name, productPrice: coca.price, quantity: 3 }
        ]
      }),
    });
    const updateRes = await createOrder(updateReq);
    expect(updateRes.status).toBe(200);

    // 6. PAY ORDER
    const payReq = new Request(`http://localhost/api/orders/${orderId}/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': `pos_token=${token}` },
      body: JSON.stringify({ paymentMethod: 'cash' }),
    });
    const payRes = await payOrder(payReq, { params: Promise.resolve({ id: orderId.toString() }) });
    expect(payRes.status).toBe(200);

    // 7. VERIFY PAID & B01 AVAILABLE
    const [tableAfter] = await db.select().from(tables).where(eq(tables.id, b01.id));
    expect(tableAfter.status).toBe('available');
    expect(tableAfter.currentOrderId).toBeNull();

    const [orderAfter] = await db.select().from(orders).where(eq(orders.id, orderId));
    expect(orderAfter.status).toBe('completed');
    expect(orderAfter.paymentStatus).toBe('paid');

    // 8. DASHBOARD / REPORT REVENUE CHECK
    const reportReq = new Request('http://localhost/api/reports?period=today', {
      headers: { 'Cookie': `pos_token=${token}` },
    });
    const reportRes = await getReports(reportReq);
    const reportJson = await reportRes.json();
    expect(reportJson.data.totalRevenue).toBe(orderAfter.finalAmount);
    expect(reportJson.data.completedCount).toBe(1);
  });
});
