import { test, expect } from '@playwright/test';

test.describe('Concurrent Payment E2E Test', () => {
  test('Prevents double-payment when two browser contexts attempt to pay the same order simultaneously', async ({ browser }) => {
    // 1. Context 1 creates order on Bàn 02
    const context1 = await browser.newContext();
    const page1 = await context1.newPage();
    await page1.goto('/login');
    await page1.fill('input[type="text"]', 'admin');
    await page1.fill('input[type="password"]', 'admin123');
    await page1.click('button[type="submit"]');
    await page1.waitForURL(/\/pos/);

    // Ensure active shift
    await page1.locator('button:has-text("Mở / Chốt Ca")').first().click();
    await page1.waitForTimeout(500);

    if (await page1.locator('button:has-text("XÁC NHẬN MỞ CA")').first().isVisible()) {
      await page1.fill('input[placeholder*="Ca sáng"]', 'Ca Test Concurrent');
      await page1.fill('input[placeholder*="1000000"]', '1000000');
      await page1.locator('button:has-text("XÁC NHẬN MỞ CA")').first().click();
      await page1.waitForTimeout(1000);
    } else {
      await page1.keyboard.press('Escape');
      await page1.waitForTimeout(300);
    }

    await page1.locator('button:has-text("Bàn 02")').first().click();
    await page1.locator('text=Bia Hơi Hà Nội (Cốc)').first().click();
    await page1.locator('button:has-text("LƯU ĐƠN / BẾP")').first().click();
    await page1.waitForTimeout(1000);

    // 2. Context 2 opens Bàn 02
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    await page2.goto('/login');
    await page2.fill('input[type="text"]', 'thungan1');
    await page2.fill('input[type="password"]', 'cashier123');
    await page2.click('button[type="submit"]');
    await page2.waitForURL(/\/pos/);

    await page2.locator('button:has-text("Bàn 02")').first().click();
    await page2.waitForTimeout(500);

    // 3. Open payment modal on both contexts
    await page1.locator('button:has-text("THANH TOÁN")').first().click();
    await page2.locator('button:has-text("THANH TOÁN")').first().click();

    await page1.waitForSelector('text=HOÀN TẤT THANH TOÁN');
    await page2.waitForSelector('text=HOÀN TẤT THANH TOÁN');

    // Select cash & enter cash on both
    await page1.locator('button:has-text("Tiền mặt")').first().click();
    await page1.locator('button:has-text("Đủ tiền")').first().click();

    await page2.locator('button:has-text("Tiền mặt")').first().click();
    await page2.locator('button:has-text("Đủ tiền")').first().click();

    // 4. Concurrently click HOÀN TẤT THANH TOÁN
    await Promise.allSettled([
      page1.locator('button:has-text("HOÀN TẤT THANH TOÁN")').first().click(),
      page2.locator('button:has-text("HOÀN TẤT THANH TOÁN")').first().click(),
    ]);

    // Wait for at least one page to process completion
    await Promise.race([
      page1.waitForSelector('text=HÓA ĐƠN TÍNH TIỀN', { timeout: 10000 }).catch(() => {}),
      page2.waitForSelector('text=HÓA ĐƠN TÍNH TIỀN', { timeout: 10000 }).catch(() => {}),
    ]);

    await page1.waitForTimeout(1000);
    await page2.waitForTimeout(1000);

    const page1Success = await page1.locator('text=HÓA ĐƠN TÍNH TIỀN').first().isVisible();
    const page2Success = await page2.locator('text=HÓA ĐƠN TÍNH TIỀN').first().isVisible();

    expect(Number(page1Success) + Number(page2Success)).toBe(1);

    await context1.close();
    await context2.close();
  });
});
