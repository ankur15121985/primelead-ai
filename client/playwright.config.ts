import { defineConfig, devices } from '@playwright/test';

/**
 * Browser E2E against the PRODUCTION build — the API serves the built
 * client (guarded static mount), so one server covers both.
 *
 * Prereqs (run from repo root):
 *   npm run build
 *   npm run test:e2e
 *
 * The webServer boots the compiled server against a scratch e2e.db and
 * applies migrations, so every run starts from a clean slate.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4055',
    ...devices['Desktop Chrome'],
  },
  webServer: {
    command: 'npx prisma migrate deploy && npx tsx prisma/seed.ts && node dist/index.js',
    cwd: '../server',
    port: 4055,
    reuseExistingServer: false,
    timeout: 90_000,
    env: {
      NODE_ENV: 'production',
      PORT: '4055',
      DATABASE_URL: 'file:./e2e.db',
      JWT_SECRET: 'e2e-secret-must-be-long',
      CLIENT_ORIGIN: 'http://localhost:4055',
      SUPER_ADMIN_EMAILS: '',
      COOKIE_SECURE: 'false',
      SMTP_HOST: '',
      APP_URL: 'http://localhost:4055',
    },
  },
});
