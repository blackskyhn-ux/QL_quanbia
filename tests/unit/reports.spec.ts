import { describe, it, expect, beforeAll } from 'vitest';
import { GET as getReports } from '../../src/app/api/reports/route';
import { POST as createOrder } from '../../src/app/api/orders/route';
import { POST as payOrder } from '../../src/app/api/orders/[id]/pay/route';
import { POST as cancelOrder } from '../../src/app/api/orders/[id]/cancel/route';
import { db } from '../../src/db';
import { tables, products, orders } from '../../src/db/schema';
import { setup } from '../setup/db';
import { signJWT } from '../../src/lib/auth';
import { eq } from 'drizzle-orm';

beforeAll(async () => {
  await setup();
});

describe('Reports & Revenue Accuracy Test Suite', () => {
  it('correctly calculates expected revenue (600K) ignoring 500K cancelled order', async () => {
    const token = await signJWT({ id: 1, username: 'admin', fullName: 'A', roleId: 1, roleName: 'admin' });
    const [table] = await db.select().from(tables).limit(1);
    const [product] = await db.select().from(products).limit(1);

    const makePaidOrder = async (amount: number) => {
      const cReq = new Request('http://localhost/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': `pos_token=${token}` },
        body: JSON.stringify({
          tableId: table.id,
          items: [{ productId: product.id, productName: product.name, productPrice: amount, quantity: 1 }]
        }),
      });
      const cRes = await createOrder(cReq);
      const cJson = await cRes.json();
      const oId = cJson.data.orderId;

      const pReq = new Request(`http://localhost/api/orders/${oId}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': `pos_token=${token}` },
        body: JSON.stringify({ paymentMethod: 'cash', finalAmount: amount }),
      });
      await payOrder(pReq, { params: Promise.resolve({ id: oId.toString() }) });
      return oId;
    };

    // 1. Create 100K paid, 200K paid, 300K paid
    await makePaidOrder(100000);
    await makePaidOrder(200000);
    await makePaidOrder(300000);

    // 2. Create 500K order then cancel it
    const cancelReq = new Request('http://localhost/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': `pos_token=${token}` },
      body: JSON.stringify({
        tableId: table.id,
        items: [{ productId: product.id, productName: product.name, productPrice: 500000, quantity: 1 }]
      }),
    });
    const cancelRes = await createOrder(cancelReq);
    const cancelJson = await cancelRes.json();
    const orderToCancelId = cancelJson.data.orderId;

    const doCancelReq = new Request(`http://localhost/api/orders/${orderToCancelId}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': `pos_token=${token}` },
    });
    await cancelOrder(doCancelReq, { params: Promise.resolve({ id: orderToCancelId.toString() }) });

    // 3. Fetch report
    const reportReq = new Request('http://localhost/api/reports?period=today', {
      headers: { 'Cookie': `pos_token=${token}` },
    });
    const reportRes = await getReports(reportReq);
    expect(reportRes.status).toBe(200);
    const reportJson = await reportRes.json();

    // EXPECTED REVENUE MUST BE 100K + 200K + 300K = 600K (500K cancelled order excluded)
    expect(reportJson.data.totalRevenue).toBe(600000);
    expect(reportJson.data.completedCount).toBe(3);
    expect(reportJson.data.cancelledCount).toBe(1);
  });

  it('supports period filters: today, yesterday, 7days, month, custom range', async () => {
    const token = await signJWT({ id: 1, username: 'admin', fullName: 'A', roleId: 1, roleName: 'admin' });

    for (const period of ['today', 'yesterday', '7days', 'month']) {
      const req = new Request(`http://localhost/api/reports?period=${period}`, {
        headers: { 'Cookie': `pos_token=${token}` },
      });
      const res = await getReports(req);
      expect(res.status).toBe(200);
    }

    const customReq = new Request('http://localhost/api/reports?period=custom&startDate=2026-09-01&endDate=2026-09-30', {
      headers: { 'Cookie': `pos_token=${token}` },
    });
    const customRes = await getReports(customReq);
    expect(customRes.status).toBe(200);
  });
});
