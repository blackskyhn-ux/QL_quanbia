import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema';
import { ensureDbInitialized } from './init';

const url = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL || 'file:local.db';
const authToken = process.env.TURSO_AUTH_TOKEN || process.env.DATABASE_AUTH_TOKEN;

export const client = createClient({
  url,
  authToken,
});

export const db = drizzle(client, { schema });

// Trigger DB initialization asynchronously on server boot
ensureDbInitialized().catch((err) => console.error('DB init failed:', err));
