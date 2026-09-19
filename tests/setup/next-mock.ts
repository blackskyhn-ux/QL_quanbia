import { vi } from 'vitest';

vi.mock('@/lib/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth')>();
  return {
    ...actual,
    getCurrentUser: vi.fn(async (req?: Request) => {
      // 1. Try to verify actual JWT from request headers
      if (req) {
        const user = await actual.getCurrentUser(req);
        if (user) return user;
        // If request has cookie header but it was invalid, or has no cookie header
        const cookieHeader = (typeof req.headers?.get === 'function' ? (req.headers.get('cookie') || req.headers.get('Cookie')) : null) || (req.headers as any)['cookie'] || (req.headers as any)['Cookie'];
        if (!cookieHeader || !cookieHeader.includes('pos_token')) {
          return null;
        }
        if (cookieHeader.includes('pos_token=invalid')) {
          return null;
        }
      }
      
      // 2. Default mock fallback for general tests without custom auth headers
      return { id: 1, username: 'admin', fullName: 'Admin System', roleId: 1, roleName: 'admin' };
    }),
  };
});
