import { describe, it, expect } from 'vitest';
import { setup } from '../setup/db';
import { db } from '../../src/db';
import { users, roles, categories, products, tables } from '../../src/db/schema';

describe('Fresh Database Migration & Seeding Test Suite', () => {
  it('successfully migrates and seeds a completely clean test database', async () => {
    // Run full setup (push schema, wipe, seed)
    await setup();

    const roleList = await db.select().from(roles);
    const userList = await db.select().from(users);
    const categoryList = await db.select().from(categories);
    const productList = await db.select().from(products);
    const tableList = await db.select().from(tables);

    expect(roleList.length).toBeGreaterThan(0);
    expect(userList.length).toBeGreaterThan(0);
    expect(categoryList.length).toBeGreaterThan(0);
    expect(productList.length).toBeGreaterThan(0);
    expect(tableList.length).toBeGreaterThan(0);

    // Verify default admin user exists
    const admin = userList.find((u) => u.username === 'admin');
    expect(admin).toBeDefined();
    expect(admin?.status).toBe('active');
  });
});
