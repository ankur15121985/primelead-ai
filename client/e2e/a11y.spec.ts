/**
 * Accessibility (axe) — scans key pages for serious/critical WCAG violations.
 * Runs against the production build via the shared webServer config.
 *
 * The marketing/home page and auth pages are fully public; the dashboard
 * scan logs in with the seeded demo account first.
 */
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const pages: Array<{ path: string; name: string }> = [
  { path: '/', name: 'home' },
  { path: '/login', name: 'login' },
  { path: '/signup', name: 'signup' },
  { path: '/pricing', name: 'pricing' },
  { path: '/tools/qr-generator', name: 'qr-generator' },
];

for (const p of pages) {
  test(`axe: ${p.name} has no serious/critical violations`, async ({ page }) => {
    await page.goto(p.path);
    await page.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page }).analyze();
    const serious = results.violations.filter((v) => ['serious', 'critical'].includes(v.impact || ''));
    expect(
      serious.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} node(s)`),
      `a11y violations on /${p.name}`
    ).toEqual([]);
  });
}

test('axe: dashboard (authenticated) has no serious/critical violations', async ({ page }) => {
  // Seed account from prisma/seed.ts.
  await page.goto('/login');
  await page.fill('#email', 'owner@primelead.demo');
  await page.fill('#password', 'Demo@1234');
  // Enter submits the form — `button:has-text("Log in")` can match the
  // navbar link instead of the submit button, so submit via the field.
  await page.locator('#password').press('Enter');
  await expect(page).toHaveURL(/\/app\/(dashboard|onboarding)/, { timeout: 20_000 });
  await page.goto('/app/dashboard');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000); // let charts render

  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter((v) => ['serious', 'critical'].includes(v.impact || ''));
  expect(
    serious.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} node(s)`),
    'a11y violations on /app/dashboard'
  ).toEqual([]);
});
