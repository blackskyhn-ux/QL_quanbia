import { describe, it, expect, beforeAll, vi } from 'vitest';
import { POST as createUser } from '../../src/app/api/users/route';
import { setup } from '../setup/db';
import { getCurrentUser } from '../../src/lib/auth';

beforeAll(async () => {
  await setup();
});

describe('Permissions Testing', () => {
  it('should block non-admins from creating users', async () => {
    // Override the global mock to simulate a staff user
    vi.mocked(getCurrentUser).mockResolvedValueOnce({ id: 2, username: 'staff1', fullName: 'S', roleId: 3, roleName: 'staff' } as any);
    
    const req = new Request('http://localhost/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': `pos_token=dummy_token` },
      body: JSON.stringify({ username: 'hacker', password: '123', fullName: 'H', roleId: 1 })
    });
    
    const res = await createUser(req);
    // Next.js NextResponse returned from our API
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.success).toBe(false);
  });
});
