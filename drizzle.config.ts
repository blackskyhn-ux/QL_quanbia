import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';

if (!process.env.TURSO_DATABASE_URL) {
  dotenv.config({ path: '.env.local' });
}

const url = process.env.TURSO_DATABASE_URL || 'file:local.db';
const isLocal = url.startsWith('file:');

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: isLocal ? 'sqlite' : 'turso',
  dbCredentials: {
    url,
    authToken: process.env.TURSO_AUTH_TOKEN,
  },
});
