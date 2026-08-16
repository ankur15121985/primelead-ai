import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    testTimeout: 30000,
    // beforeAll seeds the schema (prisma db push) and imports the whole app —
    // that cold start can exceed vitest's 10s hook default on Windows.
    hookTimeout: 60000,
  },
});
