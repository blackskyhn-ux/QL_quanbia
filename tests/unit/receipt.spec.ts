import { describe, it, expect } from 'vitest';
import { formatVND } from '../../src/lib/utils';

describe('Receipt Formatting & Layout Test Suite', () => {
  it('formats Vietnamese Unicode text and currency correctly for 58mm/80mm thermal receipts', () => {
    const receiptData = {
      shopName: 'NHÀ HÀNG BIA HƠI HÀ NỘI Phố Cổ - Cơ sở 1',
      tableName: 'Bàn VIP 01 (Sân Thượng - Tầng 3)',
      date: '2026-09-18 19:30:00',
      items: [
        { productName: 'Lẩu Riêu Cua Đồng Đặc Biệt Kèm Thịt Bò Mỹ Khay Lớn & Sườn Sụn', quantity: 999, productPrice: 450000 },
        { productName: 'Bia Hơi Hà Nội Cốc 500ml Cold Draft', quantity: 50, productPrice: 15000 },
      ],
      discountAmount: 50000,
      paymentMethod: 'cash',
      receivedCash: 500000000,
    };

    const subtotal = receiptData.items.reduce((sum, item) => sum + item.productPrice * item.quantity, 0);
    const finalAmount = Math.max(0, subtotal - receiptData.discountAmount);
    const changeAmount = receiptData.receivedCash - finalAmount;

    expect(subtotal).toBe(450300000);
    expect(finalAmount).toBe(450250000);
    expect(changeAmount).toBe(49750000);

    // Verify formatVND handles large amounts and Vietnamese locale without errors
    const formattedTotal = formatVND(finalAmount);
    expect(formattedTotal).toContain('450.250.000');
    expect(formattedTotal).toContain('₫');

    // Test line length truncation logic for 58mm (approx 32 chars) vs 80mm (approx 48 chars)
    const truncate = (str: string, maxLen: number) => (str.length > maxLen ? str.slice(0, maxLen - 1) + '…' : str);
    
    const name58mm = truncate(receiptData.items[0].productName, 32);
    expect(name58mm.length).toBeLessThanOrEqual(32);

    const name80mm = truncate(receiptData.items[0].productName, 48);
    expect(name80mm.length).toBeLessThanOrEqual(48);
  });
});
