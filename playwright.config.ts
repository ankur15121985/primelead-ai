import { defineConfig, devices } from '@playwright/test';

const API_PORT = 4000;
const CLIENT_PORT = 5173;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'list',
  timeout: 60000,
  use: {
    baseURL: `http://localhost:${CLIENT_PORT}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: process.platform === 'win32'
        ? `cd server && set PORT=${API_PORT} && npx tsx src/index.ts`
        : `cd server && PORT=${API_PORT} npx tsx src/index.ts`,
      port: API_PORT,
      reuseExistingServer: true,
      timeout: 30000,
    },
    {
      command: 'cd client && npm run dev',
      port: CLIENT_PORT,
      reuseExistingServer: true,
      timeout: 30000,
    },
  ],
});
