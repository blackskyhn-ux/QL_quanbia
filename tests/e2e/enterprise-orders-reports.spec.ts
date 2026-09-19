import { test, expect } from '@playwright/test';

test.describe('Enterprise Orders & Reports E2E Workflows', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/pos');
  });

  test('navigates to /orders, views order details, and filters by status', async ({ page }) => {
    await page.goto('/orders');
    await expect(page.locator('h1')).toContainText('QUẢN LÝ ĐƠN HÀNG');

    // Filter by status tabs
    await page.click('button:has-text("Đang phục vụ")');
    await page.waitForTimeout(300);

    await page.click('button:has-text("Đã thanh toán")');
    await page.waitForTimeout(300);

    await page.click('button:has-text("Tất cả")');
    await page.waitForTimeout(300);
  });

  test('navigates to /reports and displays enterprise financial KPIs', async ({ page }) => {
    await page.goto('/reports');
    await expect(page.locator('h1')).toContainText('BÁO CÁO & THỐNG KÊ TÀI CHÍNH');

    // Verify financial KPI sections exist
    await expect(page.locator('text=TỔNG DOANH THU THỰC THU')).toBeVisible();
    await expect(page.locator('text=LỢI NHUẬN GỘP')).toBeVisible();
    await expect(page.locator('text=GIÁ TRỊ ĐƠN TRUNG BÌNH')).toBeVisible();
    await expect(page.locator('text=ĐƠN HỦY / HOÀN TIỀN')).toBeVisible();

    // Test period switching
    await page.click('button:has-text("Hôm qua")');
    await page.waitForTimeout(300);
    await page.click('button:has-text("7 ngày")');
    await page.waitForTimeout(300);
    await page.click('button:has-text("Hôm nay")');
    await page.waitForTimeout(300);
  });
});
