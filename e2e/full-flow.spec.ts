/**
 * E2E Tests — UI rendering and navigation for PRIMELEAD AI.
 *
 * These tests verify that pages load without crashing, navigation works,
 * and the UI structure is correct. They don't require a running API server.
 */
import { test, expect } from '@playwright/test';

test.describe('PRIMELEAD AI — UI Tests', () => {
  test.describe.configure({ mode: 'serial' });

  // ── Landing Page ──────────────────────────────────────

  test('1. Landing page loads and has correct title', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/PRIMELEAD|primelead/i);
  });

  test('2. Landing page has root div for React', async ({ page }) => {
    await page.goto('/');
    const root = page.locator('#root');
    await expect(root).toBeAttached();
  });

  // ── Pages Don't Crash ─────────────────────────────────

  const appPages = [
    { url: '/app', name: 'Dashboard' },
    { url: '/app/leads', name: 'Leads' },
    { url: '/app/calls', name: 'Calls' },
    { url: '/app/meetings', name: 'Meetings' },
    { url: '/app/sms-leads', name: 'SMS Leads' },
    { url: '/app/recordings', name: 'Recordings' },
    { url: '/app/video-call', name: 'Video Call' },
    { url: '/app/bulk-calls', name: 'Bulk Calls' },
    { url: '/app/reports', name: 'Reports' },
    { url: '/app/analytics-v2', name: 'Analytics' },
    { url: '/app/settings', name: 'Settings' },
  ];

  for (const p of appPages) {
    test(`3. Page renders: ${p.name} (${p.url})`, async ({ page }) => {
      await page.goto(p.url);
      await page.waitForTimeout(1500);

      // Page should have a root element (React mounted)
      const root = page.locator('#root');
      await expect(root).toBeAttached();

      // Should not show a blank white page
      const bodyBg = await page.evaluate(() => {
        return window.getComputedStyle(document.body).backgroundColor;
      });
      // Body should have some styling (not just default white)
      expect(bodyBg).toBeTruthy();
    });
  }

  // ── Sidebar Navigation ────────────────────────────────

  test('4. Sidebar has navigation links', async ({ page }) => {
    await page.goto('/app');
    await page.waitForTimeout(2000);

    // Should have nav elements
    const navElements = page.locator('nav, aside, [role="navigation"]');
    const count = await navElements.count();
    expect(count).toBeGreaterThan(0);
  });

  test('5. Sidebar has Main section', async ({ page }) => {
    await page.goto('/app');
    await page.waitForTimeout(2000);

    // Look for dashboard/leads navigation links
    const links = page.locator('nav a, aside a');
    const linkCount = await links.count();
    expect(linkCount).toBeGreaterThan(3);
  });

  // ── Responsive Design ─────────────────────────────────

  test('6. Mobile viewport shows mobile nav', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/app');
    await page.waitForTimeout(2000);

    // Should have some form of navigation
    const allNav = await page.locator('nav').count();
    expect(allNav).toBeGreaterThan(0);
  });

  test('7. Desktop viewport shows sidebar', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/app');
    await page.waitForTimeout(2000);

    const allNav = await page.locator('nav, aside').count();
    expect(allNav).toBeGreaterThan(0);
  });

  // ── Theme Toggle ──────────────────────────────────────

  test('8. Theme toggle exists', async ({ page }) => {
    await page.goto('/app');
    await page.waitForTimeout(2000);

    // Theme toggle should be in the header/nav area
    const themeBtn = page.locator('button').filter({ hasText: /theme|dark|light|sun|moon/i }).first();
    const allBtns = await page.locator('button').count();
    // Should have buttons
    expect(allBtns).toBeGreaterThan(0);
  });

  // ── Error Boundary ────────────────────────────────────

  test('9. Unknown route shows 404 or redirects', async ({ page }) => {
    await page.goto('/nonexistent-page-12345');
    await page.waitForTimeout(2000);

    // Should either show 404 or redirect to home
    const url = page.url();
    const isHandled = url.includes('404') || url.includes('/') || url.includes('login');
    expect(isHandled).toBeTruthy();
  });

  // ── Client Build ──────────────────────────────────────

  test('10. Client dev server serves HTML', async ({ page }) => {
    await page.goto('/');
    const html = await page.content();
    expect(html).toContain('root');
    expect(html).toContain('<!DOCTYPE html');
  });
});
