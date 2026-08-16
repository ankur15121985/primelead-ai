/**
 * Phase 14 · Platform security tests — rate limiting, security headers,
 * CORS, and the standard error contract.
 *
 * Lives in its own file because rate-limit thresholds are read from the
 * environment at module import time. The global API limiter gets its own
 * file (rate-limit.test.ts) because `apiLimiter` is a module-level constant
 * whose store is shared across every app instance; this file proves the
 * login throttle bites without perturbing the main suite (which raises it).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import request from 'supertest';

const TEST_DB = path.join(__dirname, '..', '..', 'prisma', 'security-test.db');

let createApp: typeof import('../app').createApp;

function resetDb() {
  for (const f of [TEST_DB, `${TEST_DB}-journal`]) {
    if (fs.existsSync(f)) fs.rmSync(f, { force: true });
  }
  process.env.DATABASE_URL = `file:${TEST_DB.replace(/\\/g, '/')}`;
  process.env.SUPER_ADMIN_EMAILS = 'owner@security.test';
  process.env.PAYMENT_WEBHOOK_SECRET = 'security-test-secret';
  process.env.API_RATE_LIMIT = '1000'; // high: the global limiter is tested in rate-limit.test.ts
  process.env.LOGIN_RATE_LIMIT = '3'; // small on purpose: the login throttle test
  execSync('npx prisma db push --skip-generate --accept-data-loss', {
    cwd: path.join(__dirname, '..', '..'),
    stdio: 'pipe',
  });
}

beforeAll(async () => {
  resetDb();
  const appMod = await import('../app');
  createApp = appMod.createApp;
  // Seed pricing plans so signup/billing payloads work like the main suite.
  const { prisma } = await import('../lib/prisma');
  await prisma.plan.createMany({
    data: [
      { slug: 'starter', name: 'Starter', priceMonthly: 0, priceYearly: 0, userLimit: 2, leadLimit: 1000 },
      { slug: 'growth', name: 'Growth', priceMonthly: 149900, priceYearly: 1499000, userLimit: 10, leadLimit: 25000 },
    ],
  });
  await prisma.$disconnect();
});

afterAll(async () => {
  const { prisma } = await import('../lib/prisma');
  await prisma.$disconnect();
});

/** Prime the CSRF cookie on a fresh agent and return the token. */
async function primeCsrf(a: ReturnType<typeof request.agent>): Promise<string> {
  const res = await a.get('/api/auth/me');
  const cookies = (res.headers['set-cookie'] as unknown as string[]) || [];
  const c = cookies.find((x) => x.startsWith('pl_csrf='));
  return c ? c.split(';')[0].replace('pl_csrf=', '') : '';
}

describe('Phase 14 · login throttle', () => {
  it('throttles repeated failed sign-in attempts with a friendly message', async () => {
    const server = createApp();
    const a = request.agent(server);
    const csrf = await primeCsrf(a);

    const signup = await a.post('/api/auth/signup').set('x-csrf-token', csrf).send({
      name: 'Rate Owner',
      email: 'owner@security.test',
      password: 'StrongPass123',
      orgName: 'Rate Co',
    });
    expect(signup.status).toBe(201);

    let last: request.Response | undefined;
    for (let i = 0; i < 4; i++) {
      last = await a.post('/api/auth/login').set('x-csrf-token', csrf).send({
        email: 'owner@security.test',
        password: 'wrong-password',
      });
    }
    expect(last!.status).toBe(429);
    expect(last!.body.error.code).toBe('RATE_LIMITED');
    expect(last!.body.error.message).toMatch(/sign-in/i);
  });
});

describe('Phase 14 · security headers & CORS', () => {
  it('sends hardening headers on every response', async () => {
    const server = createApp();
    const res = await request(server).get('/api/auth/me');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBeTruthy();
    expect(res.headers['referrer-policy']).toBeTruthy();
    expect(res.headers['x-download-options']).toBe('noopen');
  });

  it('answers CORS preflights and mirrors the origin with credentials', async () => {
    const server = createApp();
    const preflight = await request(server)
      .options('/api/auth/me')
      .set('Origin', 'https://app.example.com')
      .set('Access-Control-Request-Method', 'GET');
    expect(preflight.headers['access-control-allow-origin']).toBe('https://app.example.com');
    expect(preflight.headers['access-control-allow-credentials']).toBe('true');

    const get = await request(server)
      .get('/api/auth/me')
      .set('Origin', 'https://app.example.com');
    expect(get.headers['access-control-allow-origin']).toBe('https://app.example.com');
    expect(get.headers['access-control-allow-credentials']).toBe('true');
  });
});

describe('Phase 14 · error contract', () => {
  it('returns { code, message, requestId } — never a stack trace — for validation errors', async () => {
    const server = createApp();
    const a = request.agent(server);
    const csrf = await primeCsrf(a);
    const res = await a.post('/api/auth/signup').set('x-csrf-token', csrf).send({
      name: '', // invalid
      email: 'not-an-email',
      password: 'short',
    });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBeTruthy();
    expect(res.body.error.message).toBeTruthy();
    expect(res.body.error.requestId).toBeTruthy();
    const raw = JSON.stringify(res.body);
    // V8 stack frames start with a newline + spaces + 'at '; the message
    // legitimately contains words like 'at least', so match the frame marker.
    expect(raw).not.toContain('\n    at ');
    expect(raw).not.toContain('Error:');
    expect(raw).not.toContain('node_modules');
  });

  it('returns a JSON 404 with a requestId for unknown routes', async () => {
    const server = createApp();
    const res = await request(server).get('/api/definitely-not-a-route');
    expect(res.status).toBe(404);
    expect(res.body.error.requestId).toBeTruthy();
  });
});
