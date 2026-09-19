import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const LOG_FILE = path.join(process.cwd(), 'tmp_test_log.txt');
fs.writeFileSync(LOG_FILE, '=== TEST LOG START ===\n');

function log(msg: string) {
  fs.appendFileSync(LOG_FILE, msg + '\n');
  console.log(msg);
}

test.describe('Golden Path E2E Flow', () => {
  test('Complete restaurant POS lifecycle from login to reporting', async ({ page }) => {
    page.on('console', (msg) => log(`[BROWSER LOG] ${msg.type()}: ${msg.text()}`));
    page.on('pageerror', (err) => log(`[BROWSER UNCAUGHT EXCEPTION] ${err.message}`));

    const runStep = async (name: string, fn: () => Promise<void>) => {
      log(`---> START: ${name}`);
      try {
        await fn();
        log(`<--- PASS: ${name}`);
      } catch (err: any) {
        log(`X--- FAIL: ${name}: ${err.message}\n${err.stack}`);
        throw err;
      }
    };

    await runStep('Step 1: Open login page', async () => {
      await page.goto('/login');
      await expect(page).toHaveURL(/\/login/);
    });

    await runStep('Step 2: Login credentials', async () => {
      await page.fill('input[type="text"]', 'admin');
      await page.fill('input[type="password"]', 'admin123');
      await page.click('button[type="submit"]');
    });

    await runStep('Step 3: Confirm POS page', async () => {
      await expect(page).toHaveURL(/\/pos/);
    });

    await runStep('Step 4: Shift modal check', async () => {
      const shiftBtn = page.locator('button:has-text("Mở / Chốt Ca")').first();
      await shiftBtn.waitFor({ state: 'visible', timeout: 10000 });
      await page.waitForTimeout(1000);

      const modalVisible = await page.locator('.glass-card').first().isVisible().catch(() => false);
      if (!modalVisible) {
        await shiftBtn.click();
        await page.waitForSelector('.glass-card', { timeout: 5000 });
      }
      await page.waitForTimeout(1000);

      const isCloseShiftBtn = page.locator('button:has-text("XÁC NHẬN CHỐT CA")').first();
      const isOpenShiftBtn = page.locator('button:has-text("XÁC NHẬN MỞ CA")').first();

      const isShiftOpen = await isCloseShiftBtn.isVisible().catch(() => false);
      log(`Is shift open: ${isShiftOpen}`);

      if (isShiftOpen) {
        try {
          await page.locator('.glass-card button.absolute').first().click({ force: true });
        } catch (e: any) {
          await page.keyboard.press('Escape');
        }
        await page.waitForTimeout(800);
      } else {
        await page.fill('input[placeholder*="1000000"]', '1000000');
        await isOpenShiftBtn.click();
        await page.waitForTimeout(1500);
      }
    });

    await runStep('Step 5: Select Bàn 01 and ensure clean cart', async () => {
      await page.locator('button:has-text("Bàn 01")').first().click();
      await expect(page.locator('text=Bàn 01').first()).toBeVisible();
      await page.waitForTimeout(500);

      // Clear any leftover cart items from prior test runs if table was occupied
      const removeBtns = page.locator('button:has-text("Xóa")');
      while ((await removeBtns.count()) > 0) {
        await removeBtns.first().click({ force: true }).catch(() => {});
        await page.waitForTimeout(300);
      }
    });

    await runStep('Step 6: Add items', async () => {
      const biaItem = page.locator('text=Bia Hơi Hà Nội (Cốc)').first();
      await biaItem.waitFor({ state: 'visible', timeout: 5000 });
      await biaItem.click();
      await page.waitForTimeout(300);
      await biaItem.click();
      await page.waitForTimeout(300);

      const cocaItem = page.locator('text=Coca Cola (Lon)').first();
      await cocaItem.waitFor({ state: 'visible', timeout: 5000 });
      await cocaItem.click();
      await page.waitForTimeout(500);
    });

    await runStep('Step 6.1: Subtotal calculation check', async () => {
      await expect(page.getByText(/48\.000/).first()).toBeVisible({ timeout: 5000 });
    });

    await runStep('Step 7: Save order', async () => {
      const saveBtn = page.locator('button:has-text("LƯU ĐƠN / BẾP")').first();
      await saveBtn.click();
      await page.waitForTimeout(1500);
    });

    await runStep('Step 8: Page reload', async () => {
      await page.reload();
      await page.waitForLoadState('networkidle');
    });

    await runStep('Step 9: Re-select Bàn 01 and check persistence', async () => {
      await page.locator('button:has-text("Bàn 01")').first().click();
      await page.waitForTimeout(1000);
      await expect(page.locator('text=Bia Hơi Hà Nội (Cốc)').first()).toBeVisible();
      await expect(page.locator('text=Coca Cola (Lon)').first()).toBeVisible();
    });

    await runStep('Step 10: Add Trâu Xào Măng Trúc', async () => {
      const trauItem = page.locator('text=Trâu Xào Măng Trúc').first();
      await trauItem.click();
      await page.waitForTimeout(500);
    });

    await runStep('Step 10.1: Check updated total', async () => {
      await expect(page.getByText(/198\.000/).first()).toBeVisible({ timeout: 5000 });
    });

    await runStep('Step 10.2: Save updated order', async () => {
      const saveBtn = page.locator('button:has-text("LƯU ĐƠN / BẾP")').first();
      await saveBtn.click();
      await page.waitForTimeout(1500);
    });

    await runStep('Step 11: Click Thanh Toán', async () => {
      await page.locator('button:has-text("THANH TOÁN")').first().click();
      await page.waitForSelector('text=Thanh toán Bàn 01');
    });

    await runStep('Step 11.1: Payment details', async () => {
      await page.locator('button:has-text("Tiền mặt")').first().click();
      await page.locator('button:has-text("Đủ tiền")').first().click();
    });

    await runStep('Step 11.2: Complete payment', async () => {
      await page.locator('button:has-text("HOÀN TẤT THANH TOÁN")').first().click();
      await page.waitForTimeout(3000); // Give API pay time to complete
    });

    await runStep('Step 12: Invoice modal check', async () => {
      log('--- BODY TEXT AT STEP 12 ---');
      log(await page.locator('body').innerText());
      await expect(page.locator('text=HÓA ĐƠN TÍNH TIỀN').first()).toBeVisible({ timeout: 5000 });
      await expect(page.getByText(/198\.000/).first()).toBeVisible();
    });

    await runStep('Step 12.1: Close invoice modal', async () => {
      await page.locator('button:has-text("Đóng")').first().click();
      await page.waitForTimeout(500);
    });

    await runStep('Step 13: Check table returned to Trống', async () => {
      await page.locator('button:has-text("Sơ Đồ Bàn")').first().click();
      const tableCard = page.locator('button').filter({ hasText: 'Bàn 01' }).filter({ hasText: 'Trống' });
      await expect(tableCard.first()).toBeVisible();
    });

    await runStep('Step 14: Order history', async () => {
      await page.locator('a:has-text("Đơn Hàng")').first().click();
      await page.waitForURL(/\/orders/);
      await expect(page.locator('text=Bàn 01').first()).toBeVisible();
      await expect(page.getByText(/198\.000/).first()).toBeVisible();
    });

    await runStep('Step 14.1: Order detail modal', async () => {
      await page.locator('tr:has-text("Bàn 01") button').first().click();
      await expect(page.locator('text=Chi tiết đơn').first()).toBeVisible();
      await expect(page.locator('text=Trâu Xào Măng Trúc').first()).toBeVisible();
      await page.locator('button:has-text("Đóng")').first().click();
    });

    await runStep('Step 15: Reports dashboard', async () => {
      await page.locator('a:has-text("Báo Cáo")').first().click();
      await page.waitForURL(/\/reports/);
      await expect(page.locator('text=TỔNG DOANH THU').first()).toBeVisible();
    });

    log('🎉 GOLDEN PATH PASSED 100%!');
  });
});
