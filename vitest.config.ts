import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup/env.ts', './tests/setup/next-mock.ts'],
    fileParallelism: false, // Prevents SQLITE_BUSY by running suites sequentially
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
