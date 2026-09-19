import { describe, it, expect } from 'vitest';

describe('Timezone Asia/Ho_Chi_Minh Boundary Tests', () => {
  it('correctly handles 23:59 and 00:00 date boundaries in UTC+7 (Asia/Ho_Chi_Minh)', () => {
    // 23:59:59 on Sep 17, 2026 in Asia/Ho_Chi_Minh is 16:59:59 UTC on Sep 17, 2026
    const dt2359 = new Date('2026-09-17T23:59:59+07:00');
    // 00:00:00 on Sep 18, 2026 in Asia/Ho_Chi_Minh is 17:00:00 UTC on Sep 17, 2026
    const dt0000 = new Date('2026-09-18T00:00:00+07:00');

    expect(dt0000.getTime() - dt2359.getTime()).toBe(1000); // Exactly 1 second apart

    const getVnDateStr = (date: Date) => {
      // Offset for UTC+7
      const vnTime = new Date(date.getTime() + 7 * 60 * 60 * 1000);
      return vnTime.toISOString().split('T')[0];
    };

    expect(getVnDateStr(dt2359)).toBe('2026-09-17');
    expect(getVnDateStr(dt0000)).toBe('2026-09-18');
  });
});
