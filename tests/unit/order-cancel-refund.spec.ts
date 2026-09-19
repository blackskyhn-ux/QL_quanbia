import { describe, it, expect, beforeAll } from 'vitest';
import { POST as cancelOrder } from '../../src/app/api/orders/[id]/cancel/route';
import { POST as refundOrder } from '../../src/app/api/orders/[id]/refund/route';
import { POST as createOrder } from '../../src/app/api/orders/route';
import { POST as payOrder } from '../../src/app/api/orders/[id]/pay/route';
import { db } from '../../src/db';
import { orders, orderItems, products, tables, inventoryLogs, auditLogs } from '../../src/db/schema';
import { setup } from '../setup/db';
import { eq } from 'drizzle-orm';
import { signJWT } from '../../src/lib/auth';

beforeAll(async () => {
  await setup();
});

describe('Order Cancel & Refund Workflows', () => {
  it('should enforce RBAC for cancellation (staff fails with 403, admin succeeds)', async () => {
    const adminToken = await signJWT({ id: 1, username: 'admin', fullName: 'Admin', roleId: 1, roleName: 'admin' });
    const staffToken = await signJWT({ id: 2, username: 'staff', fullName: 'Staff', roleId: 2, roleName: 'staff' });

    const [table] = await db.select().from(tables).limit(1);
    const [product] = await db.select().from(products).limit(1);

    // Create order
    const createReq = new Request('http://localhost/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': `pos_token=${adminToken}` },
      body: JSON.stringify({
        tableId: table.id,
        items: [{ productId: product.id, productName: product.name, productPrice: product.price, quantity: 1 }]
      }),
    });
    const createRes = await createOrder(createReq);
    const { data: { orderId } } = await createRes.json();

    // Staff attempts to cancel -> 403
    const staffCancelReq = new Request(`http://localhost/api/orders/${orderId}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': `pos_token=${staffToken}` },
      body: JSON.stringify({ reason: 'Khách đổi ý' }),
    });
    const staffRes = await cancelOrder(staffCancelReq, { params: Promise.resolve({ id: orderId.toString() }) });
    expect(staffRes.status).toBe(403);

    // Admin attempts to cancel without reason -> 400
    const noReasonReq = new Request(`http://localhost/api/orders/${orderId}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': `pos_token=${adminToken}` },
      body: JSON.stringify({ reason: '' }),
    });
    const noReasonRes = await cancelOrder(noReasonReq, { params: Promise.resolve({ id: orderId.toString() }) });
    expect(noReasonRes.status).toBe(400);

    // Admin attempts to cancel with valid reason -> 200
    const validCancelReq = new Request(`http://localhost/api/orders/${orderId}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': `pos_token=${adminToken}` },
      body: JSON.stringify({ reason: 'Khách hủy bàn' }),
    });
    const validRes = await cancelOrder(validCancelReq, { params: Promise.resolve({ id: orderId.toString() }) });
    expect(validRes.status).toBe(200);

    // Duplicate cancel -> 409 Conflict
    const dupCancelReq = new Request(`http://localhost/api/orders/${orderId}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': `pos_token=${adminToken}` },
      body: JSON.stringify({ reason: 'Khách hủy bàn lần 2' }),
    });
    const dupRes = await cancelOrder(dupCancelReq, { params: Promise.resolve({ id: orderId.toString() }) });
    expect(dupRes.status).toBe(409);
  });

  it('should cancel unpaid order without altering inventory', async () => {
    const token = await signJWT({ id: 1, username: 'admin', fullName: 'Admin', roleId: 1, roleName: 'admin' });
    const [table] = await db.select().from(tables).limit(1);
    const [product] = await db.select().from(products).limit(1);
    const initialStock = product.stockQuantity || 0;

    const createReq = new Request('http://localhost/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': `pos_token=${token}` },
      body: JSON.stringify({
        tableId: table.id,
        items: [{ productId: product.id, productName: product.name, productPrice: product.price, quantity: 5 }]
      }),
    });
    const { data: { orderId } } = await (await createOrder(createReq)).json();

    // Cancel unpaid order
    const cancelReq = new Request(`http://localhost/api/orders/${orderId}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': `pos_token=${token}` },
      body: JSON.stringify({ reason: 'Khách không đợi được' }),
    });
    const res = await cancelOrder(cancelReq, { params: Promise.resolve({ id: orderId.toString() }) });
    expect(res.status).toBe(200);

    // Check product stock remains unchanged
    const [freshProd] = await db.select().from(products).where(eq(products.id, product.id));
    expect(freshProd.stockQuantity).toBe(initialStock);

    // Check table freed
    const [freshTable] = await db.select().from(tables).where(eq(tables.id, table.id));
    expect(freshTable.status).toBe('available');
    expect(freshTable.currentOrderId).toBeNull();
  });

  it('should cancel paid order and restore inventory atomically', async () => {
    const token = await signJWT({ id: 1, username: 'admin', fullName: 'Admin', roleId: 1, roleName: 'admin' });
    const [table] = await db.select().from(tables).limit(1);
    const [product] = await db.select().from(products).limit(1);
    const initialStock = product.stockQuantity || 0;
    const qty = 3;

    // Create & Pay order
    const createReq = new Request('http://localhost/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': `pos_token=${token}` },
      body: JSON.stringify({
        tableId: table.id,
        items: [{ productId: product.id, productName: product.name, productPrice: product.price, quantity: qty }]
      }),
    });
    const { data: { orderId } } = await (await createOrder(createReq)).json();

    const payReq = new Request(`http://localhost/api/orders/${orderId}/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': `pos_token=${token}` },
      body: JSON.stringify({ paymentMethod: 'cash' }),
    });
    await payOrder(payReq, { params: Promise.resolve({ id: orderId.toString() }) });

    // Stock should be deducted
    const [afterPayProd] = await db.select().from(products).where(eq(products.id, product.id));
    expect(afterPayProd.stockQuantity).toBe(initialStock - qty);

    // Cancel paid order with refund
    const cancelReq = new Request(`http://localhost/api/orders/${orderId}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': `pos_token=${token}` },
      body: JSON.stringify({ reason: 'Trả hàng do lỗi bếp' }),
    });
    const cancelRes = await cancelOrder(cancelReq, { params: Promise.resolve({ id: orderId.toString() }) });
    expect(cancelRes.status).toBe(200);

    // Stock MUST be restored
    const [afterCancelProd] = await db.select().from(products).where(eq(products.id, product.id));
    expect(afterCancelProd.stockQuantity).toBe(initialStock);

    // Check order status is cancelled & refunded
    const [canceledOrder] = await db.select().from(orders).where(eq(orders.id, orderId));
    expect(canceledOrder.status).toBe('cancelled');
    expect(canceledOrder.paymentStatus).toBe('refunded');

    // Audit log recorded
    const logs = await db.select().from(auditLogs).where(eq(auditLogs.entityId, orderId));
    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0].action).toBe('ORDER_CANCELLED_WITH_REFUND');
  });
});
