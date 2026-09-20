import { describe, it, expect, beforeAll } from 'vitest';
import { GET as getAuditLogs } from '../../src/app/api/audit-logs/route';
import { POST as createOrder } from '../../src/app/api/orders/route';
import { POST as payOrder } from '../../src/app/api/orders/[id]/pay/route';
import { recordAuditLog } from '../../src/lib/audit';
import { db } from '../../src/db';
import { auditLogs, tables, products } from '../../src/db/schema';
import { setup } from '../setup/db';
import { signJWT } from '../../src/lib/auth';
import { eq, desc } from 'drizzle-orm';

beforeAll(async () => {
  await setup();
});

describe('Audit & Activity Logs Test Suite', () => {
  it('records audit log entries correctly using recordAuditLog helper', async () => {
    await recordAuditLog({
      action: 'TEST_ACTION',
      entityType: 'test',
      entityId: 999,
      performedBy: 1,
      reason: 'Đơn vị kiểm thử tự động',
      oldValue: { status: 'old' },
      newValue: { status: 'new' },
    });

    const logs = await db.select().from(auditLogs).where(eq(auditLogs.action, 'TEST_ACTION'));
    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0].entityType).toBe('test');
    expect(logs[0].reason).toBe('Đơn vị kiểm thử tự động');
    expect(JSON.parse(logs[0].oldValue!)).toEqual({ status: 'old' });
  });

  it('rejects staff role from accessing /api/audit-logs with 403 Forbidden', async () => {
    const staffToken = await signJWT({ id: 2, username: 'staff1', fullName: 'Nhân viên 1', roleId: 4, roleName: 'staff' });

    const req = new Request('http://localhost/api/audit-logs', {
      headers: { Cookie: `pos_token=${staffToken}` },
    });

    const res = await getAuditLogs(req);
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error).toContain('Chỉ Admin hoặc Quản lý');
  });

  it('allows admin role to query audit logs with pagination and stats', async () => {
    const adminToken = await signJWT({ id: 1, username: 'admin', fullName: 'Quản trị viên', roleId: 1, roleName: 'admin' });

    const req = new Request('http://localhost/api/audit-logs?page=1&limit=10', {
      headers: { Cookie: `pos_token=${adminToken}` },
    });

    const res = await getAuditLogs(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(Array.isArray(json.data)).toBe(true);
    expect(json.pagination).toBeDefined();
    expect(json.stats).toBeDefined();
  });

  it('filters audit logs by category financial correctly', async () => {
    const adminToken = await signJWT({ id: 1, username: 'admin', fullName: 'Quản trị viên', roleId: 1, roleName: 'admin' });

    await recordAuditLog({
      action: 'PAYMENT_COMPLETED',
      entityType: 'order',
      entityId: 888,
      performedBy: 1,
      reason: 'Thanh toán kiểm thử',
      newValue: { finalAmount: 500000 },
    });

    const req = new Request('http://localhost/api/audit-logs?category=financial', {
      headers: { Cookie: `pos_token=${adminToken}` },
    });

    const res = await getAuditLogs(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    const hasPaymentLog = json.data.some((l: any) => l.action === 'PAYMENT_COMPLETED');
    expect(hasPaymentLog).toBe(true);
  });

  it('records PAYMENT_COMPLETED audit log automatically when paying an order', async () => {
    const adminToken = await signJWT({ id: 1, username: 'admin', fullName: 'Quản trị viên', roleId: 1, roleName: 'admin' });

    // Find table and product
    const [table] = await db.select().from(tables).limit(1);
    const [product] = await db.select().from(products).limit(1);

    // Create order via API
    const createReq = new Request('http://localhost/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `pos_token=${adminToken}` },
      body: JSON.stringify({
        tableId: table.id,
        items: [{ productId: product.id, productName: product.name, productPrice: product.price, quantity: 2 }],
      }),
    });
    const createRes = await createOrder(createReq);
    const createJson = await createRes.json();
    expect(createJson.success).toBe(true);
    const orderId = createJson.data.orderId;

    // Pay order via API
    const payReq = new Request(`http://localhost/api/orders/${orderId}/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `pos_token=${adminToken}` },
      body: JSON.stringify({ paymentMethod: 'cash' }),
    });

    const payRes = await payOrder(payReq, { params: Promise.resolve({ id: orderId.toString() }) });
    const payJson = await payRes.json();
    expect(payJson.success).toBe(true);

    // Verify audit log recorded
    const logs = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.entityId, orderId))
      .orderBy(desc(auditLogs.id));

    const paymentLog = logs.find((l) => l.action === 'PAYMENT_COMPLETED');
    expect(paymentLog).toBeDefined();
    expect(paymentLog?.performedBy).toBe(1);
    expect(paymentLog?.reason).toContain('Thanh toán thành công');
  });
});
