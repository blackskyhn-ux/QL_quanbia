import { test, expect } from '@playwright/test';

test.describe('Concurrent Order Optimistic Locking E2E Test', () => {
  test('Triggers conflict warning when two browsers attempt conflicting order updates', async ({ browser }) => {
    // Context 1
    const context1 = await browser.newContext();
    const page1 = await context1.newPage();
    await page1.goto('/login');
    await page1.fill('input[type="text"]', 'admin');
    await page1.fill('input[type="password"]', 'admin123');
    await page1.click('button[type="submit"]');
    await page1.waitForURL(/\/pos/);

    // Context 2
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    await page2.goto('/login');
    await page2.fill('input[type="text"]', 'thungan1');
    await page2.fill('input[type="password"]', 'cashier123');
    await page2.click('button[type="submit"]');
    await page2.waitForURL(/\/pos/);

    // Create initial order on Bàn 03 via Page 1
    await page1.locator('button:has-text("Bàn 03")').first().click();
    await page1.locator('text=Bia Hơi Hà Nội (Cốc)').first().click();
    await page1.locator('button:has-text("LƯU ĐƠN / BẾP")').first().click();
    await page1.waitForTimeout(1000);

    // Page 2 selects Bàn 03 (loading current version)
    await page2.locator('button:has-text("Bàn 03")').first().click();
    await page2.waitForTimeout(500);

    // Page 1 adds Coca Cola and saves (bumping version in DB)
    await page1.locator('text=Coca Cola (Lon)').first().click();
    await page1.locator('button:has-text("LƯU ĐƠN / BẾP")').first().click();
    await page1.waitForTimeout(1000);

    // Page 2 (with stale version) adds Trâu Xào Măng Trúc and tries to save
    await page2.locator('text=Trâu Xào Măng Trúc').first().click();
    await page2.locator('button:has-text("LƯU ĐƠN / BẾP")').first().click();
    await page2.waitForTimeout(1500);

    // Page 2 should receive a conflict warning toast or message
    const conflictToast = page2.locator('text=thay đổi').or(page2.locator('text=409')).or(page2.locator('text=xung đột')).or(page2.locator('text=Vui lòng làm mới')).or(page2.locator('text=Đơn hàng đã')).first();
    await expect(conflictToast).toBeVisible();

    await context1.close();
    await context2.close();
  });
});
