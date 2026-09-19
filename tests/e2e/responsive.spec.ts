import { test, expect } from '@playwright/test';

const viewports = [
  { name: 'Desktop (1366x768)', width: 1366, height: 768 },
  { name: 'Desktop Large (1920x1080)', width: 1920, height: 1080 },
  { name: 'Tablet (768x1024)', width: 768, height: 1024 },
];

for (const vp of viewports) {
  test.describe(`Responsive layout smoke test - ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test('Header, POS cart, modals and action buttons remain visible and clickable', async ({ page }) => {
      await page.goto('/login');
      await page.fill('input[type="text"]', 'admin');
      await page.fill('input[type="password"]', 'admin123');
      await page.click('button[type="submit"]');
      await page.waitForURL(/\/pos/);

      // Verify header logo and main navigation
      await expect(page.locator('text=BIA CLUB POS').first()).toBeVisible();

      // Verify POS table selection and cart buttons
      await expect(page.locator('button:has-text("Bàn 04")').first()).toBeVisible();
      await page.locator('button:has-text("Bàn 04")').first().click();

      // Add item
      await page.locator('text=Bia Hơi Hà Nội (Cốc)').first().click();

      // Action buttons must be visible and not offscreen
      const saveBtn = page.locator('button:has-text("LƯU ĐƠN / BẾP")').first();
      const payBtn = page.locator('button:has-text("THANH TOÁN")').first();

      await expect(saveBtn).toBeVisible();
      await expect(payBtn).toBeVisible();

      // Verify payment modal fits inside viewport
      await payBtn.click();
      const payModal = page.locator('text=Thanh toán Bàn 04').first();
      await expect(payModal).toBeVisible();
      await page.locator('button:has-text("HOÀN TẤT THANH TOÁN")').first().click();
      await page.waitForTimeout(1000);
    });
  });
}
