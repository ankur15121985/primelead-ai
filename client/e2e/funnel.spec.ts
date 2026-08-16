/**
 * Core funnel (browser E2E) — the signup-to-follow-up promise, exercised
 * through the real production build: a fresh org signs up, creates a lead
 * in the UI, and schedules a follow-up. Quotation/invoice/payment flows are
 * covered by the API suite (142 tests); this proves the browser ↔ API wiring.
 */
import { test, expect } from '@playwright/test';

test('signs up, creates a lead and schedules a follow-up', async ({ page }) => {
  const stamp = Date.now();
  const email = `e2e-${stamp}@test.com`;

  // ── Signup ──────────────────────────────────────────────────────────
  await page.goto('/signup');
  await page.fill('#s-name', 'E2E Owner');
  await page.fill('#s-org', `E2E Org ${stamp}`);
  await page.fill('#s-email', email);
  await page.fill('#s-password', 'StrongPass123');
  await page.click('button:has-text("Create account")');

  // Lands in the authenticated app (onboarding wizard or straight to dashboard).
  await expect(page).toHaveURL(/\/app\/(onboarding|dashboard)/, { timeout: 20_000 });

  // ── Create a lead ───────────────────────────────────────────────────
  await page.goto('/app/leads');
  await page.click('button:has-text("Add lead")');
  const dialog = page.locator('[role="dialog"]');
  await dialog.locator('#nl-name').fill('E2E Lead');
  await dialog.locator('#nl-phone').fill('9810000000');
  const createLeadBtn = dialog.locator('button:has-text("Create lead")');
  await createLeadBtn.scrollIntoViewIfNeeded().catch(() => undefined);
  await createLeadBtn.click({ force: true });
  await expect(page.getByText('E2E Lead').first()).toBeVisible({ timeout: 10_000 });

  // ── Open the lead and schedule a follow-up ──────────────────────────
  // Navigate via the lead's name link (the whole row isn't clickable).
  await page.locator('a', { hasText: 'E2E Lead' }).first().click();
  await expect(page).toHaveURL(/\/app\/leads\/[\w-]+/, { timeout: 10_000 });
  await page.click('button:has-text("Schedule follow-up")');

  const followDialog = page.locator('[role="dialog"]');
  await followDialog.getByPlaceholder('Call about quotation').fill('Call about website quote');
  // Tomorrow at the same local time (datetime-local needs local, not UTC).
  const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const local = new Date(future.getTime() - future.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  await followDialog.locator('input[type="datetime-local"]').fill(local);
  const scheduleBtn = followDialog.locator('button:has-text("Schedule")');
  await scheduleBtn.scrollIntoViewIfNeeded().catch(() => undefined);
  await scheduleBtn.click({ force: true });

  await expect(page.getByText('Call about website quote').first()).toBeVisible({ timeout: 10_000 });
});
