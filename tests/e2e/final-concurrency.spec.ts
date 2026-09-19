import { test, expect, Page } from '@playwright/test';
import { db } from '../../src/db';
import { orders, orderItems, tables, products, inventoryLogs, cashShifts, users } from '../../src/db/schema';
import { eq, and } from 'drizzle-orm';

async function waitForHydrationAndSelectTable(page: Page, tableName: string) {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForSelector(`text=${tableName}`, { timeout: 10000 });
  await page.waitForTimeout(500);

  const tableBtn = page.locator('button').filter({ hasText: tableName }).first();
  await tableBtn.click();
  await page.waitForTimeout(500);

  const menuTabBtn = page.locator('button:has-text("THỰC ĐƠN & BIA")').first();
  if (await menuTabBtn.isVisible().catch(() => false)) {
    await menuTabBtn.click().catch(() => {});
    await page.waitForTimeout(300);
  }
}

test.describe('FINAL Browser Concurrency Test Suite', () => {
  test.setTimeout(60000);

  let consoleErrorsA: string[] = [];
  let consoleErrorsB: string[] = [];

  test.beforeAll(async () => {
    // Ensure an open cash shift exists so POS page never opens the shift modal
    const openShifts = await db.select().from(cashShifts).where(eq(cashShifts.status, 'open'));
    if (openShifts.length === 0) {
      const [admin] = await db.select().from(users).where(eq(users.username, 'admin'));
      await db.insert(cashShifts).values({
        userId: admin ? admin.id : 1,
        shiftName: 'Ca Test Concurrent',
        initialCash: 1000000,
        status: 'open',
        startTime: new Date().toISOString(),
      });
    }
  });

  test.beforeEach(() => {
    consoleErrorsA = [];
    consoleErrorsB = [];
  });

  // =========================================================================
  // TEST 1 — Concurrent Order Update (5 Iterations)
  // =========================================================================
  for (let i = 1; i <= 5; i++) {
    test(`TEST 1 — Concurrent Order Update (Iteration ${i}/5)`, async ({ browser }) => {
      // Pre-ensure Bàn 01 has an active serving order in DB
      const [table01Before] = await db.select().from(tables).where(eq(tables.name, 'Bàn 01'));
      let orderId: number;
      if (!table01Before.currentOrderId) {
        const [phoProd] = await db.select().from(products).where(eq(products.name, 'Phở Bò Đặc Biệt'));
        const orderNumber = `HD-E2E1-${Date.now()}-${i}`;
        const [newOrder] = await db
          .insert(orders)
          .values({
            orderNumber,
            tableId: table01Before.id,
            userId: 1,
            status: 'serving',
            totalAmount: phoProd.price,
            discountAmount: 0,
            discountPercent: 0,
            finalAmount: phoProd.price,
            paymentStatus: 'unpaid',
            customerCount: 1,
            version: 1,
            updatedAt: new Date().toISOString(),
          })
          .returning();

        await db.insert(orderItems).values({
          orderId: newOrder.id,
          productId: phoProd.id,
          productName: phoProd.name,
          productPrice: phoProd.price,
          quantity: 1,
          amount: phoProd.price,
          status: 'served',
        });

        await db.update(tables).set({ status: 'occupied', currentOrderId: newOrder.id }).where(eq(tables.id, table01Before.id));
        orderId = newOrder.id;
      } else {
        orderId = table01Before.currentOrderId;
      }

      const [initialOrder] = await db.select().from(orders).where(eq(orders.id, orderId));
      const versionN = initialOrder.version;

      const contextA = await browser.newContext();
      const contextB = await browser.newContext();

      const pageA = await contextA.newPage();
      const pageB = await contextB.newPage();

      pageA.on('pageerror', (err) => consoleErrorsA.push(err.message));
      pageB.on('pageerror', (err) => consoleErrorsB.push(err.message));

      // 1. Login Session A
      await pageA.goto('/login');
      await pageA.fill('input[type="text"]', 'admin');
      await pageA.fill('input[type="password"]', 'admin123');
      await pageA.click('button[type="submit"]');
      await pageA.waitForURL(/\/pos/);

      // 2. Login Session B (Use staff1 / staffpassword from seed.ts)
      await pageB.goto('/login');
      await pageB.fill('input[type="text"]', 'staff1');
      await pageB.fill('input[type="password"]', 'staffpassword');
      await pageB.click('button[type="submit"]');
      await pageB.waitForURL(/\/pos/);

      // 3. Page A and Page B both open Bàn 01 (holding version N)
      await waitForHydrationAndSelectTable(pageA, 'Bàn 01');
      await waitForHydrationAndSelectTable(pageB, 'Bàn 01');

      // 4. Browser A adds Coca Cola and clicks LƯU ĐƠN
      const responsePromiseA = pageA.waitForResponse((r) => r.url().includes('/api/orders') && r.request().method() === 'POST');
      const cocaItemA = pageA.locator('text=Coca Cola (Lon)').first();
      await cocaItemA.waitFor({ state: 'visible', timeout: 5000 });
      await cocaItemA.click();
      await pageA.locator('button:has-text("LƯU ĐƠN / BẾP")').first().click();
      const responseA = await responsePromiseA;
      expect(responseA.status()).toBe(200);

      // DB check after A's update: version must be N+1
      const [orderAfterA] = await db.select().from(orders).where(eq(orders.id, orderId));
      expect(orderAfterA.version).toBe(versionN + 1);

      // 5. Browser B (WITHOUT RELOADING, holding stale version N) adds Trâu Xào Măng Trúc and clicks LƯU ĐƠN
      const responsePromiseB = pageB.waitForResponse((r) => r.url().includes('/api/orders') && r.request().method() === 'POST');
      const trauItemB = pageB.locator('text=Trâu Xào Măng Trúc').first();
      await trauItemB.waitFor({ state: 'visible', timeout: 5000 });
      await trauItemB.click();
      await pageB.locator('button:has-text("LƯU ĐƠN / BẾP")').first().click();
      const responseB = await responsePromiseB;

      // Assert Response B is HTTP 409 Conflict
      expect(responseB.status()).toBe(409);
      const resBBody = await responseB.json();
      expect(resBBody.error).toBe('Đơn hàng đã bị thay đổi bởi người khác, vui lòng tải lại!');

      // Assert Browser B UI handling
      // - No fake success toast
      const successToastB = await pageB.locator('text=Đã lưu đơn thành công').isVisible().catch(() => false);
      expect(successToastB).toBe(false);

      // - Conflict warning toast is shown
      const warningToastB = pageB.locator('text=thay đổi').or(pageB.locator('text=người khác')).first();
      await expect(warningToastB).toBeVisible({ timeout: 5000 });

      // 6. Database Verification
      const [finalOrder] = await db.select().from(orders).where(eq(orders.id, orderId));
      expect(finalOrder.version).toBe(versionN + 1); // Version did NOT increment to N+2

      const itemsInDb = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
      const itemNames = itemsInDb.map((i) => i.productName);
      expect(itemNames).toContain('Phở Bò Đặc Biệt');
      expect(itemNames).toContain('Coca Cola (Lon)');
      expect(itemNames).not.toContain('Trâu Xào Măng Trúc'); // Request B did NOT overwrite or add

      // 7. Refresh / Reload Browser B & Verify Browser B sees Browser A's items
      await pageB.reload();
      await pageB.waitForURL(/\/pos/);
      await waitForHydrationAndSelectTable(pageB, 'Bàn 01');

      await expect(pageB.locator('text=Phở Bò Đặc Biệt').first()).toBeVisible();
      await expect(pageB.locator('text=Coca Cola (Lon)').first()).toBeVisible();

      expect(consoleErrorsA.length).toBe(0);
      expect(consoleErrorsB.length).toBe(0);

      await contextA.close();
      await contextB.close();
    });
  }

  // =========================================================================
  // TEST 2 — Concurrent Payment (5 Iterations)
  // =========================================================================
  for (let i = 1; i <= 5; i++) {
    test(`TEST 2 — Concurrent Payment (Iteration ${i}/5)`, async ({ browser }) => {
      // Pre-ensure Bàn 02 has an active serving order in DB
      const [table02Before] = await db.select().from(tables).where(eq(tables.name, 'Bàn 02'));
      let orderId: number;
      if (!table02Before.currentOrderId) {
        const [phoProd] = await db.select().from(products).where(eq(products.name, 'Phở Bò Đặc Biệt'));
        const orderNumber = `HD-E2E2-${Date.now()}-${i}`;
        const [newOrder] = await db
          .insert(orders)
          .values({
            orderNumber,
            tableId: table02Before.id,
            userId: 1,
            status: 'serving',
            totalAmount: phoProd.price,
            discountAmount: 0,
            discountPercent: 0,
            finalAmount: phoProd.price,
            paymentStatus: 'unpaid',
            customerCount: 2,
            version: 1,
            updatedAt: new Date().toISOString(),
          })
          .returning();

        await db.insert(orderItems).values({
          orderId: newOrder.id,
          productId: phoProd.id,
          productName: phoProd.name,
          productPrice: phoProd.price,
          quantity: 1,
          amount: phoProd.price,
          status: 'served',
        });

        await db.update(tables).set({ status: 'occupied', currentOrderId: newOrder.id }).where(eq(tables.id, table02Before.id));
        orderId = newOrder.id;
      } else {
        orderId = table02Before.currentOrderId;
      }

      // Get product initial stock
      const [phoProdInitial] = await db.select().from(products).where(eq(products.name, 'Phở Bò Đặc Biệt'));
      const initialStock = phoProdInitial.stockQuantity || 0;

      const contextA = await browser.newContext();
      const contextB = await browser.newContext();

      const pageA = await contextA.newPage();
      const pageB = await contextB.newPage();

      pageA.on('pageerror', (err) => consoleErrorsA.push(err.message));
      pageB.on('pageerror', (err) => consoleErrorsB.push(err.message));

      // 1. Login Session A & B
      await pageA.goto('/login');
      await pageA.fill('input[type="text"]', 'admin');
      await pageA.fill('input[type="password"]', 'admin123');
      await pageA.click('button[type="submit"]');
      await pageA.waitForURL(/\/pos/);

      await pageB.goto('/login');
      await pageB.fill('input[type="text"]', 'staff1');
      await pageB.fill('input[type="password"]', 'staffpassword');
      await pageB.click('button[type="submit"]');
      await pageB.waitForURL(/\/pos/);

      // 2. Open Bàn 02 on both browsers & open Payment UI
      await waitForHydrationAndSelectTable(pageA, 'Bàn 02');
      await waitForHydrationAndSelectTable(pageB, 'Bàn 02');

      await pageA.locator('button:has-text("THANH TOÁN")').first().click();
      await pageB.locator('button:has-text("THANH TOÁN")').first().click();

      await pageA.waitForSelector('text=HOÀN TẤT THANH TOÁN', { timeout: 5000 });
      await pageB.waitForSelector('text=HOÀN TẤT THANH TOÁN', { timeout: 5000 });

      await pageA.locator('button:has-text("Tiền mặt")').first().click();
      await pageA.locator('button:has-text("Đủ tiền")').first().click();

      await pageB.locator('button:has-text("Tiền mặt")').first().click();
      await pageB.locator('button:has-text("Đủ tiền")').first().click();

      // 3. Trigger concurrent payment submit
      const payPromiseA = pageA.waitForResponse((r) => r.url().includes('/api/orders') && r.request().method() === 'POST');
      const payPromiseB = pageB.waitForResponse((r) => r.url().includes('/api/orders') && r.request().method() === 'POST');

      await Promise.allSettled([
        pageA.locator('button:has-text("HOÀN TẤT THANH TOÁN")').first().click(),
        pageB.locator('button:has-text("HOÀN TẤT THANH TOÁN")').first().click(),
      ]);

      const [resPayA, resPayB] = await Promise.all([payPromiseA, payPromiseB]);

      const statusA = resPayA.status();
      const statusB = resPayB.status();

      // Assert EXACTLY ONE 200 SUCCESS AND EXACTLY ONE 409 CONFLICT
      const statuses = [statusA, statusB].sort();
      expect(statuses).toEqual([200, 409]);

      // Determine winning and losing page
      const winningPage = statusA === 200 ? pageA : pageB;
      const losingPage = statusA === 200 ? pageB : pageA;

      // 4. Verify UI handling
      // Winner sees Invoice Modal
      await expect(winningPage.locator('text=HÓA ĐƠN TÍNH TIỀN').first()).toBeVisible({ timeout: 5000 });

      // Loser does NOT see Invoice Modal & sees error toast
      const loserInvoiceVisible = await losingPage.locator('text=HÓA ĐƠN TÍNH TIỀN').first().isVisible().catch(() => false);
      expect(loserInvoiceVisible).toBe(false);

      const loserErrorToast = losingPage.locator('text=409').or(losingPage.locator('text=thay đổi')).or(losingPage.locator('text=thanh toán')).first();
      await expect(loserErrorToast).toBeVisible({ timeout: 5000 });

      // 5. Database Verification
      // - Order status: completed, paymentStatus: paid
      const [paidOrder] = await db.select().from(orders).where(eq(orders.id, orderId));
      expect(paidOrder.status).toBe('completed');
      expect(paidOrder.paymentStatus).toBe('paid');

      // - Table status: available, currentOrderId: null
      const [updatedTable02] = await db.select().from(tables).where(eq(tables.name, 'Bàn 02'));
      expect(updatedTable02.status).toBe('available');
      expect(updatedTable02.currentOrderId).toBeNull();

      // - Inventory log: exactly 1 order_deduct entry for this order
      const logs = await db.select().from(inventoryLogs).where(and(eq(inventoryLogs.productId, phoProdInitial.id), eq(inventoryLogs.note, `Trừ kho từ đơn hàng #${paidOrder.orderNumber}`)));
      expect(logs.length).toBe(1);

      // - Stock quantity: reduced by exactly 1
      const [phoProdFinal] = await db.select().from(products).where(eq(products.name, 'Phở Bò Đặc Biệt'));
      expect(phoProdFinal.stockQuantity).toBe(initialStock - 1);

      expect(consoleErrorsA.length).toBe(0);
      expect(consoleErrorsB.length).toBe(0);

      await contextA.close();
      await contextB.close();
    });
  }
});
