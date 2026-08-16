/**
 * Phase 14 · Global API rate limiter test.
 *
 * Lives in its own file because `apiLimiter` is a module-level constant —
 * every `createApp()` shares its in-memory store — so the limit must be
 * exercised from a worker with a small API_RATE_LIMIT and nothing else
 * consuming the shared budget.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import request from 'supertest';

const TEST_DB = path.join(__dirname, '..', '..', 'prisma', 'rate-limit-test.db');

let createApp: typeof import('../app').createApp;

function resetDb() {
  for (const f of [TEST_DB, `${TEST_DB}-journal`]) {
    if (fs.existsSync(f)) fs.rmSync(f, { force: true });
  }
  process.env.DATABASE_URL = `file:${TEST_DB.replace(/\\/g, '/')}`;
  process.env.API_RATE_LIMIT = '6'; // small on purpose: prove the limit bites
  process.env.LOGIN_RATE_LIMIT = '1000'; // keep the login throttle out of the way
  execSync('npx prisma db push --skip-generate --accept-data-loss', {
    cwd: path.join(__dirname, '..', '..'),
    stdio: 'pipe',
  });
}

beforeAll(async () => {
  resetDb();
  const appMod = await import('../app');
  createApp = appMod.createApp;
});

afterAll(async () => {
  const { prisma } = await import('../lib/prisma');
  await prisma.$disconnect();
});

describe('Phase 14 · API rate limiting', () => {
  it('returns 429 RATE_LIMITED once the global API limit is exceeded', async () => {
    const server = createApp();
    const a = request.agent(server);

    // Prime the CSRF cookie (counts toward the limit).
    await a.get('/api/auth/me');

    let last: request.Response | undefined;
    for (let i = 0; i < 8; i++) {
      last = await a.get('/api/auth/me');
    }
    expect(last!.status).toBe(429);
    expect(last!.body.error.code).toBe('RATE_LIMITED');
    expect(last!.body.error.message).toContain('Too many requests');
    expect(last!.body.error.requestId).toBeTruthy();
  });
});
