import { execSync } from 'child_process';
import dotenv from 'dotenv';
import path from 'path';

// Setup env variables for test BEFORE drizzle/db is imported
dotenv.config({ path: path.resolve(__dirname, '../../.env.test') });

// Make sure that tests don't connect to production!
if (!process.env.TURSO_DATABASE_URL?.includes('test.db')) {
  throw new Error('Test environment MUST use a test.db URL to prevent data loss!');
}

import { db } from '../../src/db';
import { sql } from 'drizzle-orm';
import { seedTestDatabase } from './seed';

export async function setup() {
  console.log('1. Pushing schema to test.db...');
  
  // Use explicit env variables to override .env.local fallback in drizzle.config.ts
  try {
    execSync('npx drizzle-kit push --force', {
      env: { ...process.env, TURSO_DATABASE_URL: 'file:test.db' },
      stdio: 'inherit',
    });
  } catch (e) {
    // If --force is not supported by drizzle version, fallback to standard push
    execSync('npx drizzle-kit push', {
      env: { ...process.env, TURSO_DATABASE_URL: 'file:test.db' },
      stdio: 'inherit',
    });
  }

  console.log('2. Wiping existing tables to ensure deterministic status...');
  // Note: Drizzle push doesn't truncate data, so we manually clean up tables
  await db.run(sql`DELETE FROM cash_transactions;`);
  await db.run(sql`DELETE FROM cash_shifts;`);
  await db.run(sql`DELETE FROM audit_logs;`);
  await db.run(sql`DELETE FROM inventory_logs;`);
  await db.run(sql`DELETE FROM order_items;`);
  await db.run(sql`DELETE FROM orders;`);
  await db.run(sql`DELETE FROM products;`);
  await db.run(sql`DELETE FROM categories;`);
  await db.run(sql`DELETE FROM tables;`);
  await db.run(sql`DELETE FROM areas;`);
  await db.run(sql`DELETE FROM users;`);
  await db.run(sql`DELETE FROM roles;`);
  await db.run(sql`DELETE FROM sqlite_sequence;`);
  
  console.log('3. Seeding test data (Admin, Tables, Products)...');
  await seedTestDatabase();
  console.log('Test database ready!');
}
