import { describe, it, expect, beforeAll } from 'vitest';
import { GET as getReports } from '../../src/app/api/reports/route';
import { POST as createOrder } from '../../src/app/api/orders/route';
import { POST as payOrder } from '../../src/app/api/orders/[id]/pay/route';
import { db } from '../../src/db';
import { tables, products } from '../../src/db/schema';
import { setup } from '../setup/db';
import { signJWT } from '../../src/lib/auth';

beforeAll(async () => {
  await setup();
});

describe('Enterprise Reporting Engine', () => {
  it('should calculate revenue, COGS, gross profit and gross margin correctly', async () => {
    const adminToken = await signJWT({ id: 1, username: 'admin', fullName: 'Admin System', roleId: 1, roleName: 'admin' });

    const [table] = await db.select().from(tables).limit(1);
    const [product] = await db.select().from(products).limit(1);

    // Create & Pay order
    const createReq = new Request('http://localhost/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': `pos_token=${adminToken}` },
      body: JSON.stringify({
        tableId: table.id,
        items: [{ productId: product.id, productName: product.name, productPrice: product.price, quantity: 2 }]
      }),
    });
    const createRes = await createOrder(createReq);
    const { data: { orderId } } = await createRes.json();

    const payReq = new Request(`http://localhost/api/orders/${orderId}/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': `pos_token=${adminToken}` },
      body: JSON.stringify({ paymentMethod: 'cash' }),
    });
    await payOrder(payReq, { params: Promise.resolve({ id: orderId.toString() }) });

    // Query report for today
    const reportReq = new Request('http://localhost/api/reports?period=today', {
      method: 'GET',
      headers: { 'Cookie': `pos_token=${adminToken}` },
    });
    const reportRes = await getReports(reportReq);
    expect(reportRes.status).toBe(200);

    const { data: { summary, topProducts, paymentMethods } } = await reportRes.json();
    expect(summary.completedCount).toBeGreaterThanOrEqual(1);
    expect(summary.totalRevenue).toBeGreaterThan(0);
    expect(summary.cogs).toBeGreaterThanOrEqual(0);
    expect(summary.grossProfit).toBe(summary.totalRevenue - summary.cogs);
    expect(summary.grossMargin).toBeGreaterThanOrEqual(0);
    expect(paymentMethods.cash.total).toBeGreaterThan(0);
    expect(topProducts.length).toBeGreaterThan(0);
  });
});
