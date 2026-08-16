/**
 * End-to-end API smoke tests using an isolated SQLite database.
 * Covers the core promise: sign up → login → capture → assign → follow-up.
 *
 * CSRF note: like a real browser, each test first loads a page (GET) which
 * primes the double-submit CSRF cookie, then sends it back as a header.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import request from 'supertest';
import { generate as generateTotp } from 'otplib';

const TEST_DB = path.join(__dirname, '..', '..', 'prisma', 'test.db');

// NOTE: everything is imported dynamically so the isolated test DATABASE_URL
// is set before the Prisma client (and the whole route tree) is constructed.
let createApp: typeof import('../app').createApp;
let server: ReturnType<typeof import('../app').createApp>;
let agent: ReturnType<typeof request.agent>;

function resetDb() {
  for (const f of [TEST_DB, `${TEST_DB}-journal`]) {
    if (fs.existsSync(f)) fs.rmSync(f, { force: true });
  }
  process.env.DATABASE_URL = `file:${TEST_DB.replace(/\\/g, '/')}`;
  // The test owner is the website super-admin for admin-route tests.
  process.env.SUPER_ADMIN_EMAILS = 'owner@test.com';
  // Keep the login throttle out of the way across many tests, but keep the
  // per-user account lock small so the lockout behaviour is testable.
  process.env.LOGIN_RATE_LIMIT = '500';
  process.env.LOGIN_MAX_ATTEMPTS = '5';
  process.env.LOGIN_LOCK_MINUTES = '15';
  // The growing suite issues >600 requests per 15-minute window from the same
  // test IP — raise the global API limiter like the login limiter above.
  process.env.API_RATE_LIMIT = '100000';
  // Demo payment provider webhook signing secret.
  process.env.PAYMENT_WEBHOOK_SECRET = 'test-webhook-secret';
  execSync('npx prisma db push --skip-generate --accept-data-loss', {
    cwd: path.join(__dirname, '..', '..'),
    stdio: 'pipe',
  });
}

beforeAll(async () => {
  resetDb();
  const prismaMod = await import('../lib/prisma');
  const appMod = await import('../app');
  createApp = appMod.createApp;
  server = createApp();
  agent = request.agent(server);
  await prismaMod.prisma.$queryRawUnsafe('SELECT 1');

  // Seed the three pricing plans (fresh test DB has none)
  await prismaMod.prisma.plan.createMany({
    data: [
      { slug: 'starter', name: 'Starter', priceMonthly: 0, priceYearly: 0, userLimit: 2, leadLimit: 1000 },
      { slug: 'growth', name: 'Growth', priceMonthly: 149900, priceYearly: 1499000, userLimit: 10, leadLimit: 25000 },
      { slug: 'business', name: 'Business', priceMonthly: 399900, priceYearly: 3999000, userLimit: 0, leadLimit: 0 },
    ],
  });
});

afterAll(async () => {
  const { prisma } = await import('../lib/prisma');
  await prisma.$disconnect();
});

/**
 * Prime the CSRF cookie (GET = page load) and return the token.
 * The token is stable per agent (rotated only on successful /me), so a
 * remembered fallback keeps state-changing calls working after logout/reset
 * when the server no longer re-issues the cookie on 401s.
 */
const rememberedCsrf = new WeakMap<object, string>();
async function getCsrf(a: ReturnType<typeof request.agent> = agent): Promise<string> {
  const res = await a.get('/api/auth/me').catch(() => null);
  const cookies = (res?.headers['set-cookie'] as unknown as string[]) || [];
  const fresh = cookies.find((c) => c.startsWith('pl_csrf='));
  if (fresh) {
    const token = fresh.split(';')[0].replace('pl_csrf=', '');
    rememberedCsrf.set(a, token);
    return token;
  }
  const remembered = rememberedCsrf.get(a);
  if (remembered) return remembered;
  const me = await a.get('/api/auth/me');
  const c2 = (me.headers['set-cookie'] as unknown as string[]) || [];
  const second = c2.find((c) => c.startsWith('pl_csrf='));
  const token = second ? second.split(';')[0].replace('pl_csrf=', '') : '';
  if (token) rememberedCsrf.set(a, token);
  return token;
}

describe('Auth', () => {
  it('signs up a new org + owner and sets a session', async () => {
    const csrf = await getCsrf();
    const res = await agent.post('/api/auth/signup').set('x-csrf-token', csrf).send({
      name: 'Test Owner',
      email: 'owner@test.com',
      password: 'StrongPass123',
      orgName: 'Test Traders',
      businessType: 'RETAIL',
    });
    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe('OWNER');
    expect(res.body.data.org.plan).toBe('STARTER');
    expect((res.headers['set-cookie'] as unknown as string[]).some((c) => c.includes('pl_session'))).toBe(true);
  });

  it('rejects a duplicate email', async () => {
    const csrf = await getCsrf();
    const res = await agent.post('/api/auth/signup').set('x-csrf-token', csrf).send({
      name: 'Other',
      email: 'owner@test.com',
      password: 'StrongPass123',
      orgName: 'Other Co',
    });
    expect(res.status).toBe(409);
  });

  it('rejects wrong password with a friendly message', async () => {
    const csrf = await getCsrf();
    const res = await agent.post('/api/auth/login').set('x-csrf-token', csrf).send({ email: 'owner@test.com', password: 'wrongpass1' });
    expect(res.status).toBe(401);
    expect(res.body.error.message).toContain('Incorrect email or password');
  });
});

describe('Lead lifecycle (authenticated)', () => {
  it('GET /api/auth/me returns the org', async () => {
    const res = await agent.get('/api/auth/me');
    expect(res.status).toBe(200);
    expect(res.body.data.org.name).toBe('Test Traders');
  });

  it('creates a lead and auto-assigns it to the least-loaded salesperson', async () => {
    // STARTER caps at 2 users — this test needs 3, so move to GROWTH (10).
    const me = await agent.get('/api/auth/me');
    const { prisma } = await import('../lib/prisma');
    await prisma.organization.update({ where: { id: me.body.data.org.id }, data: { plan: 'GROWTH' } });

    const csrf = await getCsrf();
    // owner adds two salespeople
    const s1 = await agent.post('/api/team').set('x-csrf-token', csrf).send({
      name: 'Sales One',
      email: 'sales1@test.com',
      role: 'SALES',
      password: 'StrongPass123',
    });
    const s2 = await agent.post('/api/team').set('x-csrf-token', csrf).send({
      name: 'Sales Two',
      email: 'sales2@test.com',
      role: 'SALES',
      password: 'StrongPass123',
    });
    expect(s1.status).toBe(201);
    expect(s2.status).toBe(201);

    const res = await agent
      .post('/api/leads')
      .set('x-csrf-token', csrf)
      .send({
        name: 'Ramesh Kumar',
        phone: '9811111111',
        email: 'ramesh@example.com',
        source: 'WEBSITE',
        priority: 'HIGH',
        expectedValue: 100000,
        notes: 'Wants a site visit.',
      });
    expect(res.status).toBe(201);
    expect(res.body.data.lead.name).toBe('Ramesh Kumar');
    expect(res.body.data.lead.ownerId).toBeTruthy();
    const assignedTo = res.body.data.lead.ownerId;
    expect([s1.body.data.user.id, s2.body.data.user.id]).toContain(assignedTo);
    expect(res.body.data.lead.score).toBeGreaterThanOrEqual(60);

    // second lead goes to the other salesperson (round-robin / least-open)
    const res2 = await agent
      .post('/api/leads')
      .set('x-csrf-token', csrf)
      .send({ name: 'Sita Iyer', phone: '9822222222', email: 'sita@example.com', source: 'WEBSITE' });
    expect(res2.status).toBe(201);
    expect(res2.body.data.lead.ownerId).not.toBe(assignedTo);
  });

  it('detects duplicates by phone', async () => {
    const csrf = await getCsrf();
    const res = await agent
      .post('/api/leads')
      .set('x-csrf-token', csrf)
      .send({ name: 'Ramesh Again', phone: '9811111111' });
    expect(res.status).toBe(409);
    expect(res.body.error.message).toContain('already exists');
  });

  it('lists leads with pagination', async () => {
    const res = await agent.get('/api/leads?page=1&pageSize=10');
    expect(res.status).toBe(200);
    expect(res.body.data.rows.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.pagination.total).toBeGreaterThanOrEqual(1);
  });

  it('searches leads', async () => {
    const res = await agent.get('/api/leads?search=ramesh');
    expect(res.status).toBe(200);
    expect(res.body.data.rows[0].name).toContain('Ramesh');
  });

  it('moves a lead through the pipeline and logs an activity', async () => {
    const csrf = await getCsrf();
    const list = await agent.get('/api/leads');
    const leadId = list.body.data.rows[0].id;

    const pipeline = await agent.get('/api/pipeline');
    const stage = pipeline.body.data.stages.find((s: any) => s.name === 'Qualified');
    const res = await agent
      .patch(`/api/leads/${leadId}`)
      .set('x-csrf-token', csrf)
      .send({ status: 'QUALIFIED', stageId: stage.id });
    expect(res.status).toBe(200);
    expect(res.body.data.lead.status).toBe('QUALIFIED');

    const detail = await agent.get(`/api/leads/${leadId}`);
    const activity = detail.body.data.lead.activities.find((a: any) => a.type === 'STATUS_CHANGE');
    expect(activity).toBeTruthy();
  });

  it('adds a follow-up task', async () => {
    const csrf = await getCsrf();
    const list = await agent.get('/api/leads');
    const leadId = list.body.data.rows[0].id;
    const dueAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const res = await agent
      .post(`/api/leads/${leadId}/tasks`)
      .set('x-csrf-token', csrf)
      .send({ title: 'Call Ramesh about site visit', kind: 'CALL', dueAt });
    expect(res.status).toBe(201);
    const tasks = await agent.get('/api/tasks?view=upcoming');
    expect(tasks.body.data.tasks.some((t: any) => t.title.includes('Ramesh'))).toBe(true);
  });

  it('exports CSV', async () => {
    const res = await agent.get('/api/leads/export');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text).toContain('Name,Phone,Email');
  });
});

describe('QR lead capture', () => {
  let qrSlug = '';
  let campaignId = '';

  it('creates a QR code with a rendered image', async () => {
    const csrf = await getCsrf();
    const res = await agent
      .post('/api/qr-codes')
      .set('x-csrf-token', csrf)
      .send({ title: 'Shop Counter', campaignName: 'Counter', fields: ['name', 'phone', 'email', 'message'] });
    expect(res.status).toBe(201);
    expect(res.body.data.qrCode.slug).toBeTruthy();
    expect(res.body.data.qrCode.url).toContain('/r/');
    expect(res.body.data.qrCode.image).toContain('data:image/png');
    expect(res.body.data.qrCode.campaign.name).toBe('Counter');
    qrSlug = res.body.data.qrCode.slug;
    campaignId = res.body.data.qrCode.campaignId;
  });

  it('lists QR codes with campaigns', async () => {
    const res = await agent.get('/api/qr-codes');
    expect(res.status).toBe(200);
    expect(res.body.data.qrCodes.some((q: any) => q.slug === qrSlug)).toBe(true);
    expect(res.body.data.campaigns.some((c: any) => c.id === campaignId)).toBe(true);
  });

  it('public GET returns form meta and counts a scan', async () => {
    const res = await request(server).get(`/api/public/qr/${qrSlug}`);
    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe('Shop Counter');
    expect(res.body.data.orgName).toBe('Test Traders');
    expect(res.body.data.fields).toContain('phone');

    const list = await agent.get('/api/qr-codes');
    const qr = list.body.data.qrCodes.find((q: any) => q.slug === qrSlug);
    expect(qr.scanCount).toBeGreaterThanOrEqual(1);
  });

  it('public POST creates a lead (source QR) and increments counts', async () => {
    // prime CSRF cookie like a phone browser loading the form page
    await request(server).get(`/api/public/qr/${qrSlug}`);
    const agentPhone = request.agent(server);
    const csrf = await getCsrf(agentPhone);

    const res = await agentPhone
      .post(`/api/public/qr/${qrSlug}/lead`)
      .set('x-csrf-token', csrf)
      .send({ name: 'Public Scanner', phone: '9700000001', email: 'scanner@example.com', message: 'Interested in your services.' });
    expect(res.status).toBe(201);
    expect(res.body.data.received).toBe(true);

    const list = await agent.get('/api/qr-codes');
    const qr = list.body.data.qrCodes.find((q: any) => q.slug === qrSlug);
    expect(qr.leadCount).toBeGreaterThanOrEqual(1);

    // the lead exists, source = QR, and was auto-assigned
    const leads = await agent.get('/api/leads?search=Public+Scanner');
    const lead = leads.body.data.rows[0];
    expect(lead).toBeTruthy();
    expect(lead.source).toBe('QR');
    expect(lead.ownerId).toBeTruthy();
  });

  it('public POST with a duplicate phone acknowledges instead of failing', async () => {
    const agentPhone = request.agent(server);
    const csrf = await getCsrf(agentPhone);
    const res = await agentPhone
      .post(`/api/public/qr/${qrSlug}/lead`)
      .set('x-csrf-token', csrf)
      .send({ name: 'Another Scan', phone: '9700000001' });
    expect(res.status).toBe(200);
    expect(res.body.data.duplicate).toBe(true);
  });

  it('toggles a QR code off and blocks new submissions', async () => {
    const csrf = await getCsrf();
    const list = await agent.get('/api/qr-codes');
    const qr = list.body.data.qrCodes.find((q: any) => q.slug === qrSlug);
    const off = await agent
      .patch(`/api/qr-codes/${qr.id}`)
      .set('x-csrf-token', csrf)
      .send({ enabled: false });
    expect(off.status).toBe(200);
    expect(off.body.data.qrCode.enabled).toBe(false);

    const blocked = await request(server).get(`/api/public/qr/${qrSlug}`);
    expect(blocked.status).toBe(400);
    expect(blocked.body.error.message).toContain('paused');

    // re-enable so later tests pass
    await agent
      .patch(`/api/qr-codes/${qr.id}`)
      .set('x-csrf-token', csrf)
      .send({ enabled: true });
  });

  it('keeps QR codes org-isolated on the public endpoint', async () => {
    const other = await request(server).get(`/api/public/qr/definitely-not-a-real-slug-xyz`);
    expect(other.status).toBe(400);
  });
});

describe('Super-admin dashboard', () => {
  it('lets the listed super-admin see the overview', async () => {
    const res = await agent.get('/api/admin/overview');
    expect(res.status).toBe(200);
    expect(res.body.data.totals.organizations).toBeGreaterThanOrEqual(1);
    expect(res.body.data.totals.users).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(res.body.data.organizations)).toBe(true);
  });

  it('lists all organizations with stats', async () => {
    const res = await agent.get('/api/admin/orgs');
    expect(res.status).toBe(200);
    const org = res.body.data.organizations.find((o: any) => o.name === 'Test Traders');
    expect(org).toBeTruthy();
    expect(org.users).toBeGreaterThanOrEqual(1);
    expect(org.leads).toBeGreaterThanOrEqual(1);
  });

  it('shows org detail with users and recent leads', async () => {
    const me = await agent.get('/api/auth/me');
    const orgId = me.body.data.org.id;
    const res = await agent.get(`/api/admin/orgs/${orgId}`);
    expect(res.status).toBe(200);
    expect(res.body.data.org.name).toBe('Test Traders');
    expect(res.body.data.users.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.recentLeads.length).toBeGreaterThanOrEqual(1);
  });

  it('can suspend and re-activate an organization', async () => {
    // /auth/me rotates the CSRF cookie each call, so fetch the org id first,
    // then grab the fresh token right before the state-changing request.
    const me = await agent.get('/api/auth/me');
    const orgId = me.body.data.org.id;
    const csrf = await getCsrf();
    const suspended = await agent
      .patch(`/api/admin/orgs/${orgId}`)
      .set('x-csrf-token', csrf)
      .send({ status: 'SUSPENDED' });
    expect(suspended.status).toBe(200);
    expect(suspended.body.data.org.status).toBe('SUSPENDED');

    // a regular user of the suspended org can no longer authenticate
    const agent2 = request.agent(server);
    const csrf2 = await getCsrf(agent2);
    const login = await agent2.post('/api/auth/login').set('x-csrf-token', csrf2).send({
      email: 'sales1@test.com',
      password: 'StrongPass123',
    });
    expect(login.status).toBe(403);

    // …but the super-admin (listed in SUPER_ADMIN_EMAILS) still can
    const agent3 = request.agent(server);
    const csrf3 = await getCsrf(agent3);
    const adminLogin = await agent3.post('/api/auth/login').set('x-csrf-token', csrf3).send({
      email: 'owner@test.com',
      password: 'StrongPass123',
    });
    expect(adminLogin.status).toBe(200);

    const csrfReact = await getCsrf();
    const reactivated = await agent
      .patch(`/api/admin/orgs/${orgId}`)
      .set('x-csrf-token', csrfReact)
      .send({ status: 'ACTIVE' });
    expect(reactivated.status).toBe(200);
    expect(reactivated.body.data.org.status).toBe('ACTIVE');
  });

  it('shows system health', async () => {
    const res = await agent.get('/api/admin/system');
    expect(res.status).toBe(200);
    expect(res.body.data.uptimeSeconds).toBeGreaterThanOrEqual(0);
    expect(res.body.data.database.connected).toBe(true);
    expect(res.body.data.node).toBeTruthy();
  });

  it('blocks non-listed users from the admin area', async () => {
    const agent2 = request.agent(server);
    const csrf2 = await getCsrf(agent2);
    await agent2.post('/api/auth/signup').set('x-csrf-token', csrf2).send({
      name: 'Third Owner',
      email: 'third@test.com',
      password: 'StrongPass123',
      orgName: 'Third Co',
    });
    const res = await agent2.get('/api/admin/overview');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});

describe('Quotations (GST)', () => {
  let qId = '';
  let leadId = '';

  it('creates a quotation with calculated GST totals', async () => {
    const list = await agent.get('/api/leads');
    leadId = list.body.data.rows[0].id;
    const csrf = await getCsrf();
    const res = await agent
      .post('/api/quotations')
      .set('x-csrf-token', csrf)
      .send({
        customerName: 'Aakash Traders',
        company: 'Aakash Trading Co',
        gstin: '27ABCDE1234F1Z5',
        leadId,
        items: [
          { description: 'Website design', quantity: 1, rate: 50000, taxPct: 18 },
          { description: 'Hosting (1 yr)', quantity: 1, rate: 5000, taxPct: 18 },
        ],
        discount: 2000,
        terms: 'Valid 15 days.',
      });
    expect(res.status).toBe(201);
    const q = res.body.data.quotation;
    expect(q.number).toMatch(/^QT-/);
    expect(q.subtotal).toBe(55000);
    expect(q.discount).toBe(2000);
    // engine: taxes on per-item taxable (18% of 55000 = 9900), discount applied at document level after tax
    expect(q.gstSummary.cgst).toBe(4950);
    expect(q.gstSummary.sgst).toBe(4950);
    expect(q.gstSummary.igst).toBe(0);
    expect(q.total).toBe(62900);
    expect(q.items.length).toBe(2);
    qId = q.id;
  });

  it('lists quotations and filters by status', async () => {
    const res = await agent.get('/api/quotations?status=DRAFT');
    expect(res.status).toBe(200);
    expect(res.body.data.quotations.some((x: any) => x.id === qId)).toBe(true);
    expect(res.body.data.counts.total).toBeGreaterThanOrEqual(1);
  });

  it('marks a quotation accepted and shows it in detail', async () => {
    const csrf = await getCsrf();
    const res = await agent.patch(`/api/quotations/${qId}`).set('x-csrf-token', csrf).send({ status: 'ACCEPTED' });
    expect(res.status).toBe(200);
    expect(res.body.data.quotation.status).toBe('ACCEPTED');
    const detail = await agent.get(`/api/quotations/${qId}`);
    expect(detail.body.data.quotation.customerName).toBe('Aakash Traders');
    expect(detail.body.data.quotation.items.length).toBe(2);
  });

  it('converts an accepted quotation to an invoice', async () => {
    const csrf = await getCsrf();
    const res = await agent.post(`/api/quotations/${qId}/convert`).set('x-csrf-token', csrf);
    expect(res.status).toBe(200);
    expect(res.body.data.invoice.number).toMatch(/^INV-/);
    expect(res.body.data.invoice.total).toBe(62900);
    // converting twice fails (fresh token captured before the request, like a browser)
    const csrfAgain = await getCsrf();
    const again = await agent.post(`/api/quotations/${qId}/convert`).set('x-csrf-token', csrfAgain);
    expect(again.status).toBe(400);
  });

  it('downloads a PDF for a quotation', async () => {
    const res = await agent.get(`/api/quotations/${qId}/pdf`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    expect(res.headers['content-disposition']).toContain('QT-');
    expect(res.body.length).toBeGreaterThan(500);
  });
});

describe('Invoices', () => {
  let invId = '';

  it('creates an invoice and computes IGST', async () => {
    const csrf = await getCsrf();
    const res = await agent
      .post('/api/invoices')
      .set('x-csrf-token', csrf)
      .send({
        customerName: 'Cross State Ltd',
        status: 'SENT',
        items: [{ description: 'Machinery part', hsnSac: '8409', quantity: 3, rate: 10000, taxPct: 12, gstType: 'IGST' }],
      });
    expect(res.status).toBe(201);
    const inv = res.body.data.invoice;
    expect(inv.number).toMatch(/^INV-/);
    expect(inv.subtotal).toBe(30000);
    expect(inv.gstSummary.igst).toBe(3600);
    expect(inv.gstSummary.cgst).toBe(0);
    expect(inv.total).toBe(33600);
    invId = inv.id;
  });

  it('records a partial payment and advances status', async () => {
    const csrf = await getCsrf();
    const res = await agent.post(`/api/invoices/${invId}/payment`).set('x-csrf-token', csrf).send({ paidAmount: 10000 });
    expect(res.status).toBe(200);
    expect(res.body.data.invoice.paidAmount).toBe(10000);
    expect(res.body.data.invoice.status).toBe('PARTIALLY_PAID');
    expect(res.body.data.invoice.balanceDue).toBe(23600);
  });

  it('completes payment to PAID and lists with counts', async () => {
    const csrf = await getCsrf();
    const res = await agent.post(`/api/invoices/${invId}/payment`).set('x-csrf-token', csrf).send({ paidAmount: 23600 });
    expect(res.status).toBe(200);
    expect(res.body.data.invoice.status).toBe('PAID');
    const list = await agent.get('/api/invoices');
    expect(list.body.data.counts.paid).toBeGreaterThanOrEqual(1);
    expect(list.body.data.invoices.some((i: any) => i.id === invId)).toBe(true);
  });

  it('downloads an invoice PDF', async () => {
    const res = await agent.get(`/api/invoices/${invId}/pdf`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
  });
});

describe('AI assistant', () => {
  it('persists a conversation and returns a friendly not-configured reply', async () => {
    const csrf = await getCsrf();
    const res = await agent
      .post('/api/ai/chat')
      .set('x-csrf-token', csrf)
      .send({ message: 'How many leads this week?' });
    expect(res.status).toBe(200);
    expect(res.body.data.conversationId).toBeTruthy();
    expect(res.body.data.notConfigured).toBe(true);

    const convs = await agent.get('/api/ai/conversations');
    expect(convs.body.data.conversations.some((c: any) => c.id === res.body.data.conversationId)).toBe(true);
    const detail = await agent.get(`/api/ai/conversations/${res.body.data.conversationId}`);
    expect(detail.body.data.conversation.messages.length).toBe(2); // user + friendly fallback
  });
});

describe('Integrations & webhooks', () => {
  it('lists the integration catalog (nothing connected by default)', async () => {
    const res = await agent.get('/api/integrations');
    expect(res.status).toBe(200);
    expect(res.body.data.catalog.length).toBeGreaterThanOrEqual(10);
    expect(res.body.data.connections.length).toBe(0);
  });

  it('connects WhatsApp and returns a webhook secret', async () => {
    const csrf = await getCsrf();
    const res = await agent.post('/api/integrations/WHATSAPP/connect').set('x-csrf-token', csrf);
    expect(res.status).toBe(200);
    expect(res.body.data.integration.webhookSecret).toMatch(/^[a-f0-9]{48}$/);
    expect(res.body.data.integration.webhookUrl).toContain('/api/webhooks/whatsapp');
  });

  it('accepts a webhook lead with a valid secret and creates a source lead', async () => {
    const csrf = await getCsrf();
    const connect = await agent.post('/api/integrations/WHATSAPP/connect').set('x-csrf-token', csrf);
    const secret = connect.body.data.integration.webhookSecret;
    const res = await request(server)
      .post('/api/webhooks/whatsapp')
      .set('x-webhook-secret', secret)
      .send({ name: 'Webhook Walker', phone: '9711111111', email: 'walker@example.com', notes: 'Came via WhatsApp.' });
    expect(res.status).toBe(201);
    expect(res.body.data.received).toBe(true);

    const leads = await agent.get('/api/leads?search=Webhook+Walker');
    const lead = leads.body.data.rows[0];
    expect(lead.source).toBe('WHATSAPP');
    expect(lead.ownerId).toBeTruthy();
  });

  it('rejects webhook requests with a wrong/missing secret', async () => {
    const bad = await request(server).post('/api/webhooks/whatsapp').send({ name: 'Bad Guy', phone: '9722222222' });
    expect(bad.status).toBe(401);
    const bad2 = await request(server).post('/api/webhooks/whatsapp').set('x-webhook-secret', 'wrong').send({ name: 'Bad Guy', phone: '9722222222' });
    expect(bad2.status).toBe(401);
  });

  it('rejects duplicate webhook leads with 409', async () => {
    const csrf = await getCsrf();
    const connect = await agent.post('/api/integrations/WHATSAPP/connect').set('x-csrf-token', csrf);
    const secret = connect.body.data.integration.webhookSecret;
    const dup = await request(server)
      .post('/api/webhooks/whatsapp')
      .set('x-webhook-secret', secret)
      .send({ name: 'Another Walker', phone: '9711111111' });
    expect(dup.status).toBe(409);
  });
});

describe('Reports & billing & contacts', () => {
  it('returns an aggregated report for the range', async () => {
    const res = await agent.get('/api/reports');
    expect(res.status).toBe(200);
    expect(res.body.data.cards.leadsCreated).toBeGreaterThanOrEqual(1);
    expect(res.body.data.charts.bySource.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.charts.trend.length).toBeGreaterThanOrEqual(1);
  });

  it('exports the report as CSV', async () => {
    const res = await agent.get('/api/reports/export');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text).toContain('Leads by source');
  });

  it('shows billing with plans and a subscription', async () => {
    const res = await agent.get('/api/billing');
    expect(res.status).toBe(200);
    expect(res.body.data.plans.length).toBe(3);
    expect(res.body.data.currentPlan).toBeTruthy();
  });

  it('upgrades the plan in demo mode (no payment gateway configured)', async () => {
    const csrf = await getCsrf();
    const res = await agent.post('/api/billing/upgrade').set('x-csrf-token', csrf).send({ planSlug: 'growth', period: 'MONTHLY' });
    expect(res.status).toBe(200);
    expect(res.body.data.applied).toBe(true);
    expect(res.body.data.mode).toBe('demo');
    const billing = await agent.get('/api/billing');
    expect(billing.body.data.currentPlan.slug).toBe('growth');
  });

  it('creates and lists contacts', async () => {
    const csrf = await getCsrf();
    const res = await agent.post('/api/contacts').set('x-csrf-token', csrf).send({
      name: 'Nisha Verma',
      phone: '9733333333',
      email: 'nisha@example.com',
      company: 'Verma Textiles',
    });
    expect(res.status).toBe(201);
    const list = await agent.get('/api/contacts?search=nis');
    expect(list.body.data.contacts[0].name).toBe('Nisha Verma');
  });
});

describe('Security & org isolation', () => {
  it('requires auth for app routes', async () => {
    const res = await request(server).get('/api/leads');
    expect(res.status).toBe(401);
  });

  it('rejects state-changing requests without CSRF token', async () => {
    const res = await request(server).post('/api/leads').send({ name: 'No CSRF' });
    expect([401, 403]).toContain(res.status);
  });

  it('keeps orgs isolated', async () => {
    const agent2 = request.agent(server);
    const csrf2 = await getCsrf(agent2);
    await agent2.post('/api/auth/signup').set('x-csrf-token', csrf2).send({
      name: 'Second Owner',
      email: 'second@test.com',
      password: 'StrongPass123',
      orgName: 'Second Co',
    });
    const me = await agent2.get('/api/auth/me');
    const csrfB = await getCsrf(agent2);
    await agent2.post('/api/leads').set('x-csrf-token', csrfB).send({ name: 'Second Org Lead', phone: '9999000000' });
    const res = await agent2.get('/api/leads');
    expect(res.body.data.rows.every((r: any) => r.name === 'Second Org Lead')).toBe(true);

    // org 1 cannot see org 2 leads
    const res1 = await agent.get('/api/leads');
    expect(res1.body.data.rows.every((r: any) => r.name !== 'Second Org Lead')).toBe(true);
  });

  it('never leaks raw errors', async () => {
    const badAgent = request.agent(server);
    const csrf = await getCsrf(badAgent);
    const bad = await badAgent.post('/api/auth/login').set('x-csrf-token', csrf).send({ email: 'x@x.com', password: 'y' });
    expect(bad.body.error.message).not.toContain('undefined');
    expect(bad.body.error.code).toBe('UNAUTHORIZED');
  });
});

// ────────────────────────────────────────────────────────────────────────
// Phase 1 — Auth hardening, sessions, MFA, RBAC, teams, paise money
// ────────────────────────────────────────────────────────────────────────

let signupSeq = 0;

async function signupFresh(name: string, orgName: string, role = 'OWNER', password = 'StrongPass123') {
  const a = request.agent(server);
  const csrf = await getCsrf(a);
  const email = `${name.toLowerCase().replace(/\s/g, '')}${++signupSeq}@test.com`;
  const res = await a.post('/api/auth/signup').set('x-csrf-token', csrf).send({
    name,
    email,
    password,
    orgName,
  });
  expect(res.status).toBe(201);
  return { agent: a, email, password };
}

async function loginAs(a: ReturnType<typeof request.agent>, email: string, password: string) {
  const csrf = await getCsrf(a);
  return a.post('/api/auth/login').set('x-csrf-token', csrf).send({ email, password });
}

describe('Phase 1 · request ids & session revocation', () => {
  it('tags every request with a request id and includes it in errors', async () => {
    const badAgent = request.agent(server);
    const csrf = await getCsrf(badAgent);
    const bad = await badAgent.post('/api/auth/login').set('x-csrf-token', csrf).send({ email: 'nope@test.com', password: 'x' });
    expect(bad.status).toBe(401);
    expect(bad.headers['x-request-id']).toBeTruthy();
    expect(bad.body.error.requestId).toBe(bad.headers['x-request-id']);

    // CSRF rejections carry the request id too
    const noCsrf = await request(server).post('/api/auth/login').send({ email: 'x', password: 'y' });
    expect(noCsrf.status).toBe(403);
    expect(noCsrf.body.error.requestId).toBe(noCsrf.headers['x-request-id']);
  });

  it('lists active sessions and revoking the current one logs the user out', async () => {
    const { agent: a, email, password } = await signupFresh('Session Tester', 'Session Org');
    await loginAs(a, email, password);

    const list = await a.get('/api/auth/sessions');
    expect(list.status).toBe(200);
    expect(list.body.data.sessions.length).toBeGreaterThanOrEqual(1);
    const current = list.body.data.sessions.find((s: any) => s.current);
    expect(current).toBeTruthy();

    const csrf = await getCsrf(a);
    const revoke = await a.post(`/api/auth/sessions/${current.id}/revoke`).set('x-csrf-token', csrf);
    expect(revoke.status).toBe(200);

    // the revoked session no longer authenticates
    const after = await a.get('/api/leads');
    expect(after.status).toBe(401);
  });

  it('revoking other sessions keeps the current one', async () => {
    const { agent: a, email, password } = await signupFresh('Multi Device', 'Multi Org');
    await loginAs(a, email, password);
    await loginAs(a, email, password); // creates a second session, cookie now holds it

    const csrf = await getCsrf(a);
    const res = await a.post('/api/auth/sessions/revoke-others').set('x-csrf-token', csrf);
    expect(res.status).toBe(200);
    expect(res.body.data.revoked).toBeGreaterThanOrEqual(1);
    expect((await a.get('/api/leads')).status).toBe(200);
  });

  it('password reset revokes every session', async () => {
    const { prisma } = await import('../lib/prisma');
    const { hashToken } = await import('../lib/crypto');
    const { agent: a, email } = await signupFresh('Reset Tester', 'Reset Org');
    const me = await a.get('/api/auth/me');
    const userId = me.body.data.user.id;

    const token = 'phase1-reset-token-abcdef';
    await prisma.resetToken.create({
      data: { userId, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
    });
    const csrf = await getCsrf(a);
    const reset = await a.post('/api/auth/reset-password').set('x-csrf-token', csrf).send({ token, password: 'NewPass1234' });
    expect(reset.status).toBe(200);

    // every prior session is dead
    expect((await a.get('/api/leads')).status).toBe(401);
    expect((await loginAs(a, email, 'NewPass1234')).status).toBe(200);
  });

  it('locks the account after repeated failed attempts', async () => {
    const { agent: a, email, password } = await signupFresh('Lock Tester', 'Lock Org');
    for (let i = 0; i < 5; i++) {
      const fail = await loginAs(a, email, 'WrongPass123');
      expect(fail.status).toBe(401);
    }
    // even the correct password is refused while locked
    const locked = await loginAs(a, email, password);
    expect(locked.status).toBe(401);
    expect(locked.body.error.message.toLowerCase()).toContain('locked');

    // failed attempts are visible in login history
    const history = await a.get('/api/auth/login-history');
    expect(history.status).toBe(200);
    const badPassword = history.body.data.history.filter((h: any) => !h.success && h.reason === 'BAD_PASSWORD');
    expect(badPassword.length).toBeGreaterThanOrEqual(5);
    expect(history.body.data.history.some((h: any) => !h.success && h.reason === 'LOCKED')).toBe(true);
  });

  it('records login history on success', async () => {
    const { agent: a, email, password } = await signupFresh('History Tester', 'History Org');
    await loginAs(a, email, password);
    const history = await a.get('/api/auth/login-history');
    expect(history.body.data.history.some((h: any) => h.success && h.reason === 'OK')).toBe(true);
  });
});

describe('Phase 1 · security settings', () => {
  it('reports mfaEnabled on /me and changes the password', async () => {
    const { agent: a, email, password } = await signupFresh('Security Owner', 'Security Org');
    await loginAs(a, email, password);

    const me = await a.get('/api/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.data.user.mfaEnabled).toBe(false);

    // wrong current password is rejected
    const bad = await a.post('/api/auth/change-password').set('x-csrf-token', await getCsrf(a)).send({ currentPassword: 'nope', newPassword: 'NewPass123' });
    expect(bad.status).toBe(400);

    // valid change works and keeps the current session alive
    const okRes = await a.post('/api/auth/change-password').set('x-csrf-token', await getCsrf(a)).send({ currentPassword: password, newPassword: 'NewPass123' });
    expect(okRes.status).toBe(200);
    expect((await a.get('/api/leads')).status).toBe(200);

    // the old password no longer works, the new one does
    const stale = await loginAs(a, email, password);
    expect(stale.status).toBe(401);
    await a.post('/api/auth/logout').set('x-csrf-token', await getCsrf(a)).send({});
    const fresh = await loginAs(a, email, 'NewPass123');
    expect(fresh.status).toBe(200);
  });
});

describe('Phase 1 · multi-factor authentication', () => {
  it('enables MFA, challenges login and completes via TOTP and recovery codes', async () => {
    const { agent: a, email, password } = await signupFresh('Mfa Owner', 'Mfa Org');

    // 1. setup — requires the current password
    const csrf0 = await getCsrf(a);
    const setup = await a.post('/api/auth/mfa/setup').set('x-csrf-token', csrf0).send({ password });
    expect(setup.status).toBe(200);
    const secret: string = setup.body.data.secret;
    expect(secret.length).toBeGreaterThanOrEqual(16);
    expect(setup.body.data.qrDataUrl).toContain('data:image/png');

    // 2. confirm with a valid TOTP code → enabled + 10 recovery codes
    const code = await generateTotp({ secret });
    const csrf1 = await getCsrf(a);
    const confirm = await a.post('/api/auth/mfa/confirm').set('x-csrf-token', csrf1).send({ secret, code });
    expect(confirm.status).toBe(200);
    expect(confirm.body.data.enabled).toBe(true);
    expect(confirm.body.data.recoveryCodes.length).toBe(10);
    const recoveryCode: string = confirm.body.data.recoveryCodes[0];

    // 3. signing in now requires the second factor
    await a.post('/api/auth/logout').set('x-csrf-token', await getCsrf(a)).send({});
    const login = await loginAs(a, email, password);
    expect(login.status).toBe(200);
    expect(login.body.data.mfaRequired).toBe(true);
    const mfaToken: string = login.body.data.mfaToken;

    // 4. complete login with a fresh TOTP code
    const code2 = await generateTotp({ secret });
    const verify = await a.post('/api/auth/mfa/verify').set('x-csrf-token', await getCsrf(a)).send({ mfaToken, code: code2 });
    expect(verify.status).toBe(200);
    expect(verify.body.data.user.email).toBe(email);
    expect((await a.get('/api/leads')).status).toBe(200);

    // 5. a wrong code is rejected
    const wrong = await a.post('/api/auth/mfa/verify').set('x-csrf-token', await getCsrf(a)).send({ mfaToken, code: '123456' });
    expect(wrong.status).toBe(401);

    // 6. recovery code path — logout, login, redeem a recovery code
    await a.post('/api/auth/logout').set('x-csrf-token', await getCsrf(a)).send({});
    const login2 = await loginAs(a, email, password);
    const mfaToken2: string = login2.body.data.mfaToken;
    const recovery = await a.post('/api/auth/mfa/recovery').set('x-csrf-token', await getCsrf(a)).send({ mfaToken: mfaToken2, code: recoveryCode });
    expect(recovery.status).toBe(200);
    expect((await a.get('/api/leads')).status).toBe(200);

    // 7. used recovery codes cannot be reused
    await a.post('/api/auth/logout').set('x-csrf-token', await getCsrf(a)).send({});
    const login3 = await loginAs(a, email, password);
    const again = await a.post('/api/auth/mfa/recovery').set('x-csrf-token', await getCsrf(a)).send({ mfaToken: login3.body.data.mfaToken, code: recoveryCode });
    expect(again.status).toBe(401);

    // 8. complete a fresh login (TOTP) so we have a session, then verify the
    // login history recorded the MFA flows
    const login4 = await loginAs(a, email, password);
    const verify4 = await a
      .post('/api/auth/mfa/verify')
      .set('x-csrf-token', await getCsrf(a))
      .send({ mfaToken: login4.body.data.mfaToken, code: await generateTotp({ secret }) });
    expect(verify4.status).toBe(200);

    const history = await a.get('/api/auth/login-history');
    expect(history.status).toBe(200);
    const reasons = history.body.data.history.map((h: any) => h.reason);
    expect(reasons).toContain('MFA_OK');
    expect(reasons).toContain('RECOVERY_OK');
  });

  it('disabling MFA requires the current password and a valid code', async () => {
    const { agent: a, email, password } = await signupFresh('Disable Mfa', 'Disable Org');
    const csrf0 = await getCsrf(a);
    const setup = await a.post('/api/auth/mfa/setup').set('x-csrf-token', csrf0).send({ password });
    const secret = setup.body.data.secret;
    await a.post('/api/auth/mfa/confirm').set('x-csrf-token', await getCsrf(a)).send({ secret, code: await generateTotp({ secret }) });

    // wrong password → rejected
    const bad = await a.post('/api/auth/mfa/disable').set('x-csrf-token', await getCsrf(a)).send({ password: 'WrongPass', code: await generateTotp({ secret }) });
    expect(bad.status).toBe(400);

    const okRes = await a.post('/api/auth/mfa/disable').set('x-csrf-token', await getCsrf(a)).send({ password, code: await generateTotp({ secret }) });
    expect(okRes.status).toBe(200);
    expect(okRes.body.data.disabled).toBe(true);

    // login no longer requires a second factor
    await a.post('/api/auth/logout').set('x-csrf-token', await getCsrf(a)).send({});
    const login = await loginAs(a, email, password);
    expect(login.status).toBe(200);
    expect(login.body.data.mfaRequired).toBeFalsy();
  });
});

describe('Phase 1 · RBAC roles & permissions', () => {
  it('seeds 7 system roles with a permission catalog', async () => {
    const { agent: a } = await signupFresh('Roles Owner', 'Roles Org');
    const res = await a.get('/api/roles');
    expect(res.status).toBe(200);
    expect(res.body.data.roles.length).toBe(7);
    expect(res.body.data.catalog).toContain('leads.view');
    expect(res.body.data.catalog).toContain('invoices.create');
    const sales = res.body.data.roles.find((r: any) => r.key === 'SALES');
    expect(sales.permissions).toContain('leads.create');
    expect(sales.permissions).not.toContain('leads.delete');
    expect(sales.permissions).not.toContain('invoices.create');
  });

  it('lets admins create a custom role and enforce it on members', async () => {
    const { agent: a, email, password } = await signupFresh('Rbac Owner', 'Rbac Org');

    const csrf0 = await getCsrf(a);
    const roleRes = await a.post('/api/roles').set('x-csrf-token', csrf0).send({
      name: 'Lead Closer',
      description: 'Reads and edits leads only',
      permissions: ['dashboard.view', 'leads.view', 'leads.create', 'leads.edit'],
    });
    expect(roleRes.status).toBe(201);
    expect(roleRes.body.data.role.key).toContain('CUSTOM_');

    // invite a member with the custom role
    const memberEmail = 'closer@test.com';
    const invite = await a.post('/api/team').set('x-csrf-token', await getCsrf(a)).send({
      name: 'Closer Person',
      email: memberEmail,
      role: roleRes.body.data.role.key,
      password: 'StrongPass123',
    });
    expect(invite.status).toBe(201);

    // the custom-role member can view/create leads but cannot delete or manage roles
    const member = request.agent(server);
    const login = await loginAs(member, memberEmail, 'StrongPass123');
    expect(login.status).toBe(200);
    expect((await member.get('/api/leads')).status).toBe(200);

    const createLead = await member.post('/api/leads').set('x-csrf-token', await getCsrf(member)).send({ name: 'Closer Lead', phone: '9900001234' });
    expect(createLead.status).toBe(201);

    const deleteLead = await member.delete('/api/leads/whatever').set('x-csrf-token', await getCsrf(member));
    expect(deleteLead.status).toBe(403);
    expect(deleteLead.body.error.code).toBe('FORBIDDEN');

    const manageRoles = await member.post('/api/roles').set('x-csrf-token', await getCsrf(member)).send({ name: 'Nope', permissions: [] });
    expect(manageRoles.status).toBe(403);

    const manageTeams = await member.post('/api/teams').set('x-csrf-token', await getCsrf(member)).send({ name: 'Nope' });
    expect(manageTeams.status).toBe(403);

    // owner can delete the custom role once unassigned — reassign first
    const teamRes = await a.get('/api/team');
    const closer = teamRes.body.data.users.find((u: any) => u.email === memberEmail);
    const reassign = await a.patch(`/api/team/${closer.id}`).set('x-csrf-token', await getCsrf(a)).send({ role: 'VIEWER' });
    expect(reassign.status).toBe(200);
    const del = await a.delete(`/api/roles/${roleRes.body.data.role.id}`).set('x-csrf-token', await getCsrf(a));
    expect(del.status).toBe(200);
    expect(del.body.data.deleted).toBe(true);
  });

  it('a viewer cannot create leads (granular enforcement)', async () => {
    const { agent: a, email, password } = await signupFresh('Viewer Boss', 'Viewer Org');
    const viewerEmail = 'viewer1@test.com';
    await a.post('/api/team').set('x-csrf-token', await getCsrf(a)).send({
      name: 'Read Only',
      email: viewerEmail,
      role: 'VIEWER',
      password: 'StrongPass123',
    });
    const viewer = request.agent(server);
    const login = await loginAs(viewer, viewerEmail, 'StrongPass123');
    expect(login.status).toBe(200);

    expect((await viewer.get('/api/dashboard')).status).toBe(200);
    const denied = await viewer.post('/api/leads').set('x-csrf-token', await getCsrf(viewer)).send({ name: 'Nope', phone: '9900000001' });
    expect(denied.status).toBe(403);
    const deniedExport = await viewer.get('/api/leads/export');
    expect(deniedExport.status).toBe(403);
  });
});

describe('Phase 1 · teams', () => {
  it('creates teams, assigns members and cleans up on delete', async () => {
    const { agent: a } = await signupFresh('Team Boss', 'Team Org');
    const csrf0 = await getCsrf(a);
    const created = await a.post('/api/teams').set('x-csrf-token', csrf0).send({ name: 'Sales A', description: 'Outbound squad' });
    expect(created.status).toBe(201);
    const teamId = created.body.data.team.id;

    const memberEmail = 'teammate@test.com';
    await a.post('/api/team').set('x-csrf-token', await getCsrf(a)).send({
      name: 'Teammate',
      email: memberEmail,
      role: 'SALES',
      password: 'StrongPass123',
    });
    const team = await a.get('/api/team');
    const member = team.body.data.users.find((u: any) => u.email === memberEmail);

    const assign = await a.patch(`/api/team/${member.id}`).set('x-csrf-token', await getCsrf(a)).send({ teamId });
    expect(assign.status).toBe(200);

    const teams = await a.get('/api/teams');
    const salesA = teams.body.data.teams.find((t: any) => t.id === teamId);
    expect(salesA.memberCount).toBe(1);

    // duplicate name rejected
    const dup = await a.post('/api/teams').set('x-csrf-token', await getCsrf(a)).send({ name: 'Sales A' });
    expect(dup.status).toBe(409);

    // deleting the team unassigns members (they stay in the org)
    const del = await a.delete(`/api/teams/${teamId}`).set('x-csrf-token', await getCsrf(a));
    expect(del.status).toBe(200);
    const after = await a.get('/api/teams');
    expect(after.body.data.teams.some((t: any) => t.id === teamId)).toBe(false);
    const memberAfter = (await a.get('/api/team')).body.data.users.find((u: any) => u.id === member.id);
    expect(memberAfter.teamId).toBeNull();
  });

  it('cannot assign a member to a team from another org', async () => {
    const { agent: a } = await signupFresh('Team Owner A', 'Org Alpha');
    const { agent: b } = await signupFresh('Team Owner B', 'Org Beta');
    const teamsA = await a.get('/api/teams');
    const teamA = teamsA.body.data.teams.length ? teamsA.body.data.teams[0] : (await a.post('/api/teams').set('x-csrf-token', await getCsrf(a)).send({ name: 'A Team' })).body.data.team;
    const usersB = (await b.get('/api/team')).body.data.users;
    const ownerB = usersB[0];

    const crossOrg = await a.patch(`/api/team/${ownerB.id}`).set('x-csrf-token', await getCsrf(a)).send({ teamId: teamA.id });
    expect(crossOrg.status).toBe(404); // member does not exist in org A
  });
});

describe('Phase 1 · paise money storage', () => {
  it('stores expected value as paise and returns rupees', async () => {
    const { prisma } = await import('../lib/prisma');
    const { agent: a } = await signupFresh('Money Owner', 'Money Org');
    const csrf = await getCsrf(a);
    const res = await a.post('/api/leads').set('x-csrf-token', csrf).send({
      name: 'Big Deal',
      phone: '9988001122',
      expectedValue: 123456.78,
    });
    expect(res.status).toBe(201);
    expect(res.body.data.lead.expectedValue).toBe(123456.78);

    const row = await prisma.lead.findUnique({ where: { orgId_phone: { orgId: res.body.data.lead.orgId, phone: '9988001122' } } });
    expect(row?.expectedValue).toBe(12345678); // paise
  });

  it('keeps quotation totals exact through paise arithmetic', async () => {
    const { agent: a } = await signupFresh('Quote Money', 'Quote Org');
    const csrf = await getCsrf(a);
    const res = await a.post('/api/quotations').set('x-csrf-token', csrf).send({
      customerName: 'Precision Co',
      items: [{ description: 'Service', quantity: 1, rate: 99.99, taxPct: 18 }],
    });
    expect(res.status).toBe(201);
    const q = res.body.data.quotation;
    expect(q.subtotal).toBe(99.99);
    expect(q.total).toBeCloseTo(117.99, 2); // 99.99 + 17.9982 → rounds to paise 18.00
  });
});


// ────────────────────────────────────────────────────────────────────────
// Phase 2 — payments, subscriptions, webhook idempotency, plan limits
// ────────────────────────────────────────────────────────────────────────

async function demoWebhook(
  paymentId: string,
  kind: 'PAYMENT_CAPTURED' | 'PAYMENT_FAILED' | 'REFUND_PROCESSED' = 'PAYMENT_CAPTURED',
  extra: Record<string, unknown> = {}
) {
  const { buildDemoWebhook } = await import('../payments/demo');
  const { headers, rawBody } = buildDemoWebhook(kind, paymentId, extra);
  return { secret: headers['x-webhook-secret'], body: rawBody.toString('utf8') };
}

async function fireDemoWebhook(paymentId: string, kind: 'PAYMENT_CAPTURED' | 'PAYMENT_FAILED' | 'REFUND_PROCESSED' = 'PAYMENT_CAPTURED', extra: Record<string, unknown> = {}) {
  const w = await demoWebhook(paymentId, kind, extra);
  return request(server)
    .post('/api/webhooks/payments/demo')
    .set('Content-Type', 'application/json')
    .set('x-webhook-secret', w.secret)
    .send(w.body);
}

describe('Phase 2 · payment webhooks', () => {
  it('rejects unsigned and incorrectly-signed provider webhooks', async () => {
    const noSig = await request(server).post('/api/webhooks/payments/demo').set('Content-Type', 'application/json').send('{"type":"payment.captured","paymentId":"x"}');
    expect(noSig.status).toBe(401);
    expect(noSig.body.error.code).toBe('INVALID_SIGNATURE');

    const badSig = await request(server)
      .post('/api/webhooks/payments/demo')
      .set('Content-Type', 'application/json')
      .set('x-webhook-secret', 'wrong-secret')
      .send('{"type":"payment.captured","paymentId":"x"}');
    expect(badSig.status).toBe(401);
  });

  it('demo upgrade starts a trial with a pending payment; a signed webhook activates it', async () => {
    const { agent: a } = await signupFresh('Pay Owner', 'Pay Org');

    const up = await a.post('/api/billing/upgrade').set('x-csrf-token', await getCsrf(a)).send({ planSlug: 'growth', period: 'MONTHLY' });
    expect(up.status).toBe(200);
    expect(up.body.data.applied).toBe(true);
    expect(up.body.data.mode).toBe('demo');

    const billing = await a.get('/api/billing');
    expect(billing.body.data.currentPlan.slug).toBe('growth');
    expect(billing.body.data.subscription.status).toBe('TRIAL');
    const pending = billing.body.data.payments.find((p: any) => p.status === 'PENDING');
    expect(pending).toBeTruthy();

    const sim = await a.post('/api/billing/demo/complete').set('x-csrf-token', await getCsrf(a)).send({ paymentId: pending.id });
    expect(sim.status).toBe(200);
    expect(sim.body.data.simulated).toBe(true);

    const after = await a.get('/api/billing');
    expect(after.body.data.subscription.status).toBe('ACTIVE');
    const settled = after.body.data.payments.find((p: any) => p.id === pending.id);
    expect(settled.status).toBe('SUCCEEDED');
    expect(settled.paidAt).toBeTruthy();
    expect(after.body.data.org.plan).toBe('GROWTH');
  });

  it('is idempotent — the same provider event is acknowledged, never reprocessed', async () => {
    const { agent: a } = await signupFresh('Idem Owner', 'Idem Org');
    await a.post('/api/billing/upgrade').set('x-csrf-token', await getCsrf(a)).send({ planSlug: 'growth', period: 'MONTHLY' });
    const billing = await a.get('/api/billing');
    const payment = billing.body.data.payments.find((p: any) => p.status === 'PENDING');

    const first = await fireDemoWebhook(payment.id);
    expect(first.status).toBe(200);
    expect(first.body.data.duplicate).toBe(false);

    const second = await fireDemoWebhook(payment.id);
    expect(second.status).toBe(200);
    expect(second.body.data.duplicate).toBe(true);

    const { prisma } = await import('../lib/prisma');
    const count = await prisma.webhookEvent.count({ where: { provider: 'demo', eventId: `demo:payment.captured:${payment.id}` } });
    expect(count).toBe(1);
  });
});

describe('Phase 2 · payment lifecycle', () => {
  it('a failed-payment webhook marks the payment failed and the subscription past due', async () => {
    const { agent: a } = await signupFresh('Fail Owner', 'Fail Org');
    await a.post('/api/billing/upgrade').set('x-csrf-token', await getCsrf(a)).send({ planSlug: 'growth', period: 'MONTHLY' });
    let billing = await a.get('/api/billing');
    let payment = billing.body.data.payments.find((p: any) => p.status === 'PENDING');

    // First a successful payment → ACTIVE
    await a.post('/api/billing/demo/complete').set('x-csrf-token', await getCsrf(a)).send({ paymentId: payment.id });
    billing = await a.get('/api/billing');
    expect(billing.body.data.subscription.status).toBe('ACTIVE');

    // A second payment attempt fails → FAILED + PAST_DUE
    await a.post('/api/billing/upgrade').set('x-csrf-token', await getCsrf(a)).send({ planSlug: 'business', period: 'MONTHLY' });
    billing = await a.get('/api/billing');
    payment = billing.body.data.payments.find((p: any) => p.status === 'PENDING');

    const res = await fireDemoWebhook(payment.id, 'PAYMENT_FAILED');
    expect(res.status).toBe(200);

    billing = await a.get('/api/billing');
    const failed = billing.body.data.payments.find((p: any) => p.id === payment.id);
    expect(failed.status).toBe('FAILED');
    expect(billing.body.data.subscription.status).toBe('PAST_DUE');
  });

  it('a refund webhook records the refunded amount and marks the payment refunded', async () => {
    const { agent: a } = await signupFresh('Refund Owner', 'Refund Org');
    await a.post('/api/billing/upgrade').set('x-csrf-token', await getCsrf(a)).send({ planSlug: 'growth', period: 'MONTHLY' });
    const billing = await a.get('/api/billing');
    const payment = billing.body.data.payments.find((p: any) => p.status === 'PENDING');
    await a.post('/api/billing/demo/complete').set('x-csrf-token', await getCsrf(a)).send({ paymentId: payment.id });

    const res = await fireDemoWebhook(payment.id, 'REFUND_PROCESSED', { amountPaise: 149900 });
    expect(res.status).toBe(200);

    const after = await a.get('/api/billing');
    const refunded = after.body.data.payments.find((p: any) => p.id === payment.id);
    expect(refunded.status).toBe('REFUNDED');
    expect(refunded.refundedAmount).toBe(1499);
  });

  it('refuses to settle a payment whose amount does not match the invoice', async () => {
    const { agent: a } = await signupFresh('Mismatch Owner', 'Mismatch Org');
    await a.post('/api/billing/upgrade').set('x-csrf-token', await getCsrf(a)).send({ planSlug: 'growth', period: 'MONTHLY' });
    const billing = await a.get('/api/billing');
    const payment = billing.body.data.payments.find((p: any) => p.status === 'PENDING');

    const res = await fireDemoWebhook(payment.id, 'PAYMENT_CAPTURED', { amountPaise: 1 });
    expect(res.status).toBe(500); // provider retries — nothing was settled

    const after = await a.get('/api/billing');
    const still = after.body.data.payments.find((p: any) => p.id === payment.id);
    expect(still.status).toBe('PENDING');
    expect(after.body.data.subscription.status).toBe('TRIAL');
  });

  it('keeps payments tenant-isolated', async () => {
    const { agent: a } = await signupFresh('Iso Owner A', 'Isolation A');
    await a.post('/api/billing/upgrade').set('x-csrf-token', await getCsrf(a)).send({ planSlug: 'growth', period: 'MONTHLY' });
    const billing = await a.get('/api/billing');
    const payment = billing.body.data.payments.find((p: any) => p.status === 'PENDING');

    const { agent: b } = await signupFresh('Iso Owner B', 'Isolation B');
    const poll = await b.get(`/api/billing/payments/${payment.id}`);
    expect(poll.status).toBe(404);
    const simulate = await b.post('/api/billing/demo/complete').set('x-csrf-token', await getCsrf(b)).send({ paymentId: payment.id });
    expect(simulate.status).toBe(404);
  });
});

describe('Phase 2 · plan-driven usage limits', () => {
  it('enforces lead and user caps from the Plan table', async () => {
    const { prisma } = await import('../lib/prisma');
    await prisma.plan.create({
      data: { slug: 'limited', name: 'Limited', priceMonthly: 0, priceYearly: 0, userLimit: 1, leadLimit: 2 },
    });
    const { agent: a } = await signupFresh('Limit Owner', 'Limit Org');
    const me = await a.get('/api/auth/me');
    await prisma.organization.update({ where: { id: me.body.data.org.id }, data: { plan: 'LIMITED' } });

    // lead cap: exactly 2 allowed, the 3rd is blocked with a friendly 403
    for (const phone of ['9811000001', '9811000002']) {
      const ok = await a.post('/api/leads').set('x-csrf-token', await getCsrf(a)).send({ name: `Lead ${phone}`, phone });
      expect(ok.status).toBe(201);
    }
    const blocked = await a.post('/api/leads').set('x-csrf-token', await getCsrf(a)).send({ name: 'Lead Over', phone: '9811000003' });
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.code).toBe('LIMIT_EXCEEDED');
    expect(blocked.body.error.message).toContain('leads limit');

    // user cap: the owner is the only user (limit 1) → invites are blocked
    const invite = await a.post('/api/team').set('x-csrf-token', await getCsrf(a)).send({
      name: 'Extra Member',
      email: 'extra@test.com',
      role: 'SALES',
      password: 'StrongPass123',
    });
    expect(invite.status).toBe(403);
    expect(invite.body.error.code).toBe('LIMIT_EXCEEDED');

    // a plan with 0 limits is unlimited
    const { agent: b } = await signupFresh('Unlimited Owner', 'Unlimited Org');
    for (let i = 0; i < 3; i++) {
      const ok = await b.post('/api/leads').set('x-csrf-token', await getCsrf(b)).send({ name: `U Lead ${i}`, phone: `98910000${i}` });
      expect(ok.status).toBe(201);
    }
  });

  it('exposes plan limits in the billing payload', async () => {
    const { agent: a } = await signupFresh('Limits View', 'Limits Org');
    const res = await a.get('/api/billing');
    expect(res.status).toBe(200);
    const growth = res.body.data.plans.find((p: any) => p.slug === 'growth');
    expect(growth.userLimit).toBe(10);
    expect(growth.leadLimit).toBe(25000);
  });
});

// ────────────────────────────────────────────────────────────────────────
// Phase 3 — Pipeline (multi-pipeline, stages, probability, win/lost) + Follow-ups
// ────────────────────────────────────────────────────────────────────────

describe('Phase 3 · pipeline management', () => {
  it('creates custom pipelines and lists them on the board', async () => {
    const { agent: a } = await signupFresh('Pipeline Owner', 'Pipeline Org');

    const board = await a.get('/api/pipeline');
    expect(board.status).toBe(200);
    expect(board.body.data.pipeline.isDefault).toBe(true);
    expect(board.body.data.stages.length).toBe(7);
    expect(board.body.data.pipelines.length).toBe(1);

    const created = await a.post('/api/pipeline').set('x-csrf-token', await getCsrf(a)).send({
      name: 'Web Development',
      stages: [
        { name: 'Enquiry', probability: 10 },
        { name: 'Proposal', probability: 40 },
        { name: 'Signed', isWon: true, probability: 100 },
      ],
    });
    expect(created.status).toBe(201);
    expect(created.body.data.pipeline.isDefault).toBe(false);

    const board2 = await a.get('/api/pipeline');
    expect(board2.body.data.pipelines.length).toBe(2);
    expect(board2.body.data.pipeline.isDefault).toBe(true); // default unchanged

    // switch to the new pipeline via ?pipelineId=
    const web = await a.get(`/api/pipeline?pipelineId=${created.body.data.pipeline.id}`);
    expect(web.status).toBe(200);
    expect(web.body.data.stages.map((s: any) => s.name)).toEqual(['Enquiry', 'Proposal', 'Signed']);
    expect(web.body.data.stages[0].probability).toBe(10);
    expect(web.body.data.stages[2].isWon).toBe(true);
  });

  it('rejects pipeline/stage mutations from salespeople', async () => {
    const { agent: a, email, password } = await signupFresh('P3 Manager', 'P3 Org');
    const csrf = await getCsrf(a);
    const invite = await a.post('/api/team').set('x-csrf-token', csrf).send({
      name: 'P3 Sales', email: 'p3sales@test.com', role: 'SALES', password: 'StrongPass123',
    });
    expect(invite.status).toBe(201);

    // log the salesperson in on their own agent
    const s = request.agent(server);
    await s.post('/api/auth/login').set('x-csrf-token', await getCsrf(s)).send({ email: 'p3sales@test.com', password: 'StrongPass123' });

    const blocked = await s.post('/api/pipeline').set('x-csrf-token', await getCsrf(s)).send({ name: 'Nope' });
    expect(blocked.status).toBe(403);

    const board = await a.get('/api/pipeline');
    const stageId = board.body.data.stages[0].id;
    const stageBlocked = await s.patch(`/api/pipeline/stages/${stageId}`).set('x-csrf-token', await getCsrf(s)).send({ name: 'Hacked' });
    expect(stageBlocked.status).toBe(403);
    void email; void password;
  });

  it('edits stage probability and deletes a stage without deleting its leads', async () => {
    const { agent: a } = await signupFresh('Stage Owner', 'Stage Org');
    const board = await a.get('/api/pipeline');
    const stageId = board.body.data.stages[0].id;

    const updated = await a.patch(`/api/pipeline/stages/${stageId}`).set('x-csrf-token', await getCsrf(a)).send({ name: 'Fresh Enquiry', probability: 25 });
    expect(updated.status).toBe(200);
    expect(updated.body.data.stage.probability).toBe(25);

    // add a lead on that stage, then delete the stage
    const lead = await a.post('/api/leads').set('x-csrf-token', await getCsrf(a)).send({ name: 'Stage Lead', phone: '9822000000', stageId });
    expect(lead.status).toBe(201);

    const removed = await a.delete(`/api/pipeline/stages/${stageId}`).set('x-csrf-token', await getCsrf(a));
    expect(removed.status).toBe(200);

    const list = await a.get('/api/leads');
    const stillThere = list.body.data.rows.find((r: any) => r.name === 'Stage Lead');
    expect(stillThere).toBeTruthy();
    expect(stillThere.stageId).toBeNull();
  });

  it('computes the weighted forecast from stage probability', async () => {
    const { agent: a } = await signupFresh('Forecast Owner', 'Forecast Org');
    const board = await a.get('/api/pipeline');
    const qualified = board.body.data.stages.find((s: any) => s.name === 'Qualified');
    expect(qualified).toBeTruthy();

    // put a ₹1,00,000 lead on the 0% stage, then bump probability to 50
    await a.post('/api/leads').set('x-csrf-token', await getCsrf(a)).send({ name: 'Big Pipe', phone: '9833000000', stageId: qualified.id, expectedValue: 100000 });

    await a.patch(`/api/pipeline/stages/${qualified.id}`).set('x-csrf-token', await getCsrf(a)).send({ probability: 50 });

    const board2 = await a.get('/api/pipeline');
    const q2 = board2.body.data.stages.find((s: any) => s.name === 'Qualified');
    expect(q2.value).toBe(100000);
    expect(q2.weightedValue).toBe(50000);
    expect(board2.body.data.forecast).toBeGreaterThanOrEqual(50000);
  });
});

describe('Phase 3 · win/lost lifecycle', () => {
  it('derives WON/LOST from stage flags and stores reasons', async () => {
    const { agent: a } = await signupFresh('Win Owner', 'Win Org');
    const csrf = await getCsrf(a);
    const board = await a.get('/api/pipeline');
    const wonStage = board.body.data.stages.find((s: any) => s.name === 'Won');
    const lostStage = board.body.data.stages.find((s: any) => s.name === 'Lost');
    const newStage = board.body.data.stages.find((s: any) => s.name === 'New');

    const lead = await a.post('/api/leads').set('x-csrf-token', csrf).send({ name: 'Deal Lead', phone: '9844000000', expectedValue: 250000 });
    expect(lead.status).toBe(201);
    expect(lead.body.data.lead.status).toBe('NEW');

    // move to Won — status flips automatically, reason stored, no client status needed
    const won = await a.patch(`/api/leads/${lead.body.data.lead.id}`).set('x-csrf-token', csrf).send({ stageId: wonStage.id, wonReason: 'Best pricing and fast delivery' });
    expect(won.status).toBe(200);
    expect(won.body.data.lead.status).toBe('WON');
    expect(won.body.data.lead.wonReason).toBe('Best pricing and fast delivery');
    expect(won.body.data.lead.stageId).toBe(wonStage.id);

    // moving out of Won clears the reason and reopens the deal
    const reopened = await a.patch(`/api/leads/${lead.body.data.lead.id}`).set('x-csrf-token', csrf).send({ stageId: newStage.id });
    expect(reopened.body.data.lead.status).toBe('NEW');
    expect(reopened.body.data.lead.wonReason).toBeNull();

    // move to Lost — reason stored
    const lost = await a.patch(`/api/leads/${lead.body.data.lead.id}`).set('x-csrf-token', csrf).send({ stageId: lostStage.id, lostReason: 'Went with a competitor' });
    expect(lost.body.data.lead.status).toBe('LOST');
    expect(lost.body.data.lead.lostReason).toBe('Went with a competitor');

    // stage changes are logged with from → to metadata
    const detail = await a.get(`/api/leads/${lead.body.data.lead.id}`);
    const moves = detail.body.data.lead.activities.filter((x: any) => x.type === 'STATUS_CHANGE');
    expect(moves.length).toBeGreaterThanOrEqual(3);
    const lastMove = moves[0];
    expect(lastMove.metadata.toStage).toBe('Lost');
    expect(lastMove.metadata.fromStage).toBe('New');
  });

  it('stores expected close date on the lead', async () => {
    const { agent: a } = await signupFresh('Close Owner', 'Close Org');
    const csrf = await getCsrf(a);
    const lead = await a.post('/api/leads').set('x-csrf-token', csrf).send({ name: 'Closing Lead', phone: '9855000000' });
    const closeAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    const updated = await a.patch(`/api/leads/${lead.body.data.lead.id}`).set('x-csrf-token', csrf).send({ expectedCloseAt: closeAt });
    expect(updated.status).toBe(200);
    expect(new Date(updated.body.data.lead.expectedCloseAt).toISOString()).toBe(closeAt);
  });
});

describe('Phase 3 · follow-up engine', () => {
  it('creates follow-ups with priority and recurrence', async () => {
    const { agent: a } = await signupFresh('Task Owner', 'Task Org');
    const csrf = await getCsrf(a);
    const lead = await a.post('/api/leads').set('x-csrf-token', csrf).send({ name: 'Task Lead', phone: '9866000000' });
    const dueAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const created = await a.post('/api/tasks').set('x-csrf-token', csrf).send({
      title: 'Weekly check-in', kind: 'CALL', priority: 'HIGH', repeatEveryDays: 7, dueAt,
    });
    expect(created.status).toBe(201);

    const list = await a.get('/api/tasks?view=all');
    const task = list.body.data.tasks.find((t: any) => t.title === 'Weekly check-in');
    expect(task).toBeTruthy();
    expect(task.priority).toBe('HIGH');
    expect(task.repeatEveryDays).toBe(7);

    void lead;
  });

  it('auto-schedules the next occurrence when a recurring follow-up completes', async () => {
    const { agent: a } = await signupFresh('Recur Owner', 'Recur Org');
    const csrf = await getCsrf(a);
    const lead = await a.post('/api/leads').set('x-csrf-token', csrf).send({ name: 'Recur Lead', phone: '9877000000' });
    const dueAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    await a.post('/api/tasks').set('x-csrf-token', csrf).send({
      title: 'Monthly follow-up', kind: 'FOLLOW_UP', priority: 'MEDIUM', repeatEveryDays: 30, dueAt, leadId: lead.body.data.lead.id,
    });

    const list = await a.get('/api/tasks?view=all');
    const task = list.body.data.tasks.find((t: any) => t.title === 'Monthly follow-up');
    expect(task).toBeTruthy();

    // complete it → a new occurrence is created 30 days later
    const done = await a.patch(`/api/tasks/${task.id}`).set('x-csrf-token', csrf).send({ status: 'DONE' });
    expect(done.status).toBe(200);

    const after = await a.get('/api/tasks?view=all');
    const next = after.body.data.tasks.find((t: any) => t.title === 'Monthly follow-up' && t.status === 'PENDING');
    expect(next).toBeTruthy();
    expect(next.repeatEveryDays).toBe(30);
    const expectedNext = new Date(new Date(dueAt).getTime() + 30 * 24 * 60 * 60 * 1000);
    expect(new Date(next.dueAt).getTime()).toBe(expectedNext.getTime());

    const completed = after.body.data.tasks.find((t: any) => t.id === task.id);
    expect(completed.status).toBe('DONE');

    // lead's next-follow-up pointer was refreshed to the new occurrence
    const leadDetail = await a.get(`/api/leads/${lead.body.data.lead.id}`);
    expect(new Date(leadDetail.body.data.lead.nextFollowUpAt).getTime()).toBe(expectedNext.getTime());
  });

  it('does not duplicate non-recurring tasks on completion', async () => {
    const { agent: a } = await signupFresh('Once Owner', 'Once Org');
    const csrf = await getCsrf(a);
    const dueAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    await a.post('/api/tasks').set('x-csrf-token', csrf).send({ title: 'One-off call', kind: 'CALL', dueAt });

    const list = await a.get('/api/tasks?view=all');
    const task = list.body.data.tasks.find((t: any) => t.title === 'One-off call');
    await a.patch(`/api/tasks/${task.id}`).set('x-csrf-token', csrf).send({ status: 'DONE' });

    const after = await a.get('/api/tasks?view=all');
    const oneOffs = after.body.data.tasks.filter((t: any) => t.title === 'One-off call');
    expect(oneOffs.length).toBe(1);
    expect(oneOffs[0].status).toBe('DONE');
  });

  it('supports snoozing by rescheduling the due date', async () => {
    const { agent: a } = await signupFresh('Snooze Owner', 'Snooze Org');
    const csrf = await getCsrf(a);
    const dueAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    await a.post('/api/tasks').set('x-csrf-token', csrf).send({ title: 'Snooze me', kind: 'FOLLOW_UP', dueAt });

    const list = await a.get('/api/tasks?view=all');
    const task = list.body.data.tasks.find((t: any) => t.title === 'Snooze me');
    const tomorrow = new Date(Date.now() + 26 * 60 * 60 * 1000).toISOString();
    const snoozed = await a.patch(`/api/tasks/${task.id}`).set('x-csrf-token', csrf).send({ dueAt: tomorrow });
    expect(snoozed.status).toBe(200);

    const after = await a.get('/api/tasks?view=all');
    const moved = after.body.data.tasks.find((t: any) => t.id === task.id);
    expect(new Date(moved.dueAt).toISOString()).toBe(tomorrow);
  });
});

// ────────────────────────────────────────────────────────────────────────
// Phase 4 — GST billing: credit/debit notes, receipts, GST config, GSTIN
// ────────────────────────────────────────────────────────────────────────

describe('Phase 4 · credit notes', () => {
  it('creates a credit note against an invoice with GST totals and numbering', async () => {
    const { agent: a } = await signupFresh('CN Owner', 'CN Org');
    const csrf = await getCsrf(a);

    const inv = await a.post('/api/invoices').set('x-csrf-token', csrf).send({
      customerName: 'GST Customer',
      company: 'Acme Pvt Ltd',
      gstin: '27ABCDE1234F1Z5',
      items: [{ description: 'Website design', quantity: 1, rate: 50000, taxPct: 18 }],
    });
    expect(inv.status).toBe(201);
    expect(inv.body.data.invoice.number).toMatch(/^INV-\d{4}-\d{4}$/);

    const cn = await a.post('/api/credit-notes').set('x-csrf-token', csrf).send({
      invoiceId: inv.body.data.invoice.id,
      customerName: 'GST Customer',
      gstin: '27ABCDE1234F1Z5',
      reason: 'Partial refund after discount',
      items: [{ description: 'Website design correction', quantity: 1, rate: 10000, taxPct: 18 }],
    });
    expect(cn.status).toBe(201);
    expect(cn.body.data.note.number).toMatch(/^CN-\d{4}-\d{4}$/);
    expect(cn.body.data.note.invoice.number).toBe(inv.body.data.invoice.number);
    // 10,000 + 18% GST = 11,800
    expect(cn.body.data.note.total).toBe(11800);
    expect(cn.body.data.note.gstSummary.cgst).toBe(900);
    expect(cn.body.data.note.gstSummary.sgst).toBe(900);

    const list = await a.get('/api/credit-notes');
    expect(list.body.data.notes.length).toBe(1);

    const pdf = await a.get(`/api/credit-notes/${cn.body.data.note.id}/pdf`);
    expect(pdf.status).toBe(200);
    expect(pdf.headers['content-type']).toContain('application/pdf');
  });

  it('issues and cancels a credit note', async () => {
    const { agent: a } = await signupFresh('CN Flow', 'CN Flow Org');
    const csrf = await getCsrf(a);
    const cn = await a.post('/api/credit-notes').set('x-csrf-token', csrf).send({
      customerName: 'Flow Customer',
      items: [{ description: 'Refund line', quantity: 1, rate: 5000, taxPct: 0 }],
    });
    expect(cn.status).toBe(201);
    expect(cn.body.data.note.status).toBe('DRAFT');

    const issued = await a.patch(`/api/credit-notes/${cn.body.data.note.id}`).set('x-csrf-token', csrf).send({ status: 'ISSUED' });
    expect(issued.body.data.note.status).toBe('ISSUED');
    expect(issued.body.data.note.issuedAt).toBeTruthy();

    const cancelled = await a.patch(`/api/credit-notes/${cn.body.data.note.id}`).set('x-csrf-token', csrf).send({ status: 'CANCELLED' });
    expect(cancelled.body.data.note.status).toBe('CANCELLED');

    const reissue = await a.patch(`/api/credit-notes/${cn.body.data.note.id}`).set('x-csrf-token', csrf).send({ status: 'ISSUED' });
    expect(reissue.status).toBe(400);
  });
});

describe('Phase 4 · debit notes & receipts', () => {
  it('creates a debit note with DN numbering', async () => {
    const { agent: a } = await signupFresh('DN Owner', 'DN Org');
    const csrf = await getCsrf(a);
    const dn = await a.post('/api/debit-notes').set('x-csrf-token', csrf).send({
      customerName: 'Late Payer',
      reason: 'Interest on delayed payment',
      items: [{ description: 'Late payment charge', quantity: 1, rate: 2000, taxPct: 18 }],
    });
    expect(dn.status).toBe(201);
    expect(dn.body.data.note.number).toMatch(/^DN-\d{4}-\d{4}$/);
    expect(dn.body.data.note.total).toBe(2360);

    const pdf = await a.get(`/api/debit-notes/${dn.body.data.note.id}/pdf`);
    expect(pdf.status).toBe(200);
  });

  it('serves a payment receipt PDF for a paid invoice only', async () => {
    const { agent: a } = await signupFresh('Receipt Owner', 'Receipt Org');
    const csrf = await getCsrf(a);
    const inv = await a.post('/api/invoices').set('x-csrf-token', csrf).send({
      customerName: 'Receipt Customer',
      items: [{ description: 'Service', quantity: 1, rate: 10000, taxPct: 0 }],
    });
    const id = inv.body.data.invoice.id;

    // no payment yet → 400
    const early = await a.get(`/api/invoices/${id}/receipt`);
    expect(early.status).toBe(400);

    await a.post(`/api/invoices/${id}/payment`).set('x-csrf-token', csrf).send({ paidAmount: 10000 });
    const receipt = await a.get(`/api/invoices/${id}/receipt`);
    expect(receipt.status).toBe(200);
    expect(receipt.headers['content-type']).toContain('application/pdf');
  });

  it('keeps notes org-isolated', async () => {
    const { agent: a } = await signupFresh('CN Iso A', 'CN Iso A Org');
    const { agent: b } = await signupFresh('CN Iso B', 'CN Iso B Org');
    const csrfA = await getCsrf(a);
    const cn = await a.post('/api/credit-notes').set('x-csrf-token', csrfA).send({
      customerName: 'Isolated',
      items: [{ description: 'X', quantity: 1, rate: 100, taxPct: 0 }],
    });
    const csrfB = await getCsrf(b);
    const other = await b.get(`/api/credit-notes/${cn.body.data.note.id}`).set('x-csrf-token', csrfB);
    expect(other.status).toBe(404);
  });
});

describe('Phase 4 · GST configuration & validation', () => {
  it('exposes default GST rates and saves org-specific ones', async () => {
    const { agent: a } = await signupFresh('GST Owner', 'GST Org');
    const csrf = await getCsrf(a);
    const initial = await a.get('/api/settings/gst');
    expect(initial.status).toBe(200);
    expect(initial.body.data.gst.rates).toEqual([0, 5, 12, 18, 28]);
    expect(initial.body.data.gst.defaultRate).toBe(18);

    const saved = await a.patch('/api/settings/gst').set('x-csrf-token', csrf).send({ rates: [0, 5, 18], defaultRate: 5 });
    expect(saved.status).toBe(200);

    const after = await a.get('/api/settings/gst');
    expect(after.body.data.gst.rates).toEqual([0, 5, 18]);
    expect(after.body.data.gst.defaultRate).toBe(5);
  });

  it('rejects an invalid GSTIN format', async () => {
    const { agent: a } = await signupFresh('GSTIN Owner', 'GSTIN Org');
    const csrf = await getCsrf(a);
    const bad = await a.post('/api/invoices').set('x-csrf-token', csrf).send({
      customerName: 'Bad GSTIN',
      gstin: 'NOT-A-GSTIN',
      items: [{ description: 'X', quantity: 1, rate: 100, taxPct: 0 }],
    });
    expect(bad.status).toBe(422);
    expect(bad.body.error.message.toLowerCase()).toContain('gstin');
  });
});

// ────────────────────────────────────────────────────────────────────────
// Phase 5 — refunds, renewal, reconciliation
// ────────────────────────────────────────────────────────────────────────

describe('Phase 5 · payment refunds', () => {
  it('refunds a succeeded demo payment through the signed webhook path', async () => {
    const { agent: a } = await signupFresh('Refund Owner', 'Refund Org');
    const csrf = await getCsrf(a);

    // Activate the growth plan in demo mode, then settle it.
    const up = await a.post('/api/billing/upgrade').set('x-csrf-token', csrf).send({ planSlug: 'growth', period: 'MONTHLY' });
    expect(up.status).toBe(200);
    const pending = (await a.get('/api/billing')).body.data.payments.find((p: any) => p.status === 'PENDING');
    expect(pending).toBeTruthy();
    await a.post('/api/billing/demo/complete').set('x-csrf-token', csrf).send({ paymentId: pending.id });

    const billing = await a.get('/api/billing');
    const paid = billing.body.data.payments.find((p: any) => p.status === 'SUCCEEDED');
    expect(paid).toBeTruthy();

    // Full refund → REFUNDED
    const refunded = await a.post(`/api/billing/payments/${paid.id}/refund`).set('x-csrf-token', csrf).send({});
    expect(refunded.status).toBe(200);

    const after = await a.get('/api/billing');
    const paidAfter = after.body.data.payments.find((p: any) => p.id === paid.id);
    expect(paidAfter.status).toBe('REFUNDED');
    expect(paidAfter.refundedAmount).toBe(paid.amount);

    // Refunding again is blocked (nothing refundable left)
    const again = await a.post(`/api/billing/payments/${paid.id}/refund`).set('x-csrf-token', csrf).send({});
    expect(again.status).toBe(400);
  });

  it('supports partial refunds and rejects over-refunds', async () => {
    const { agent: a } = await signupFresh('Partial Owner', 'Partial Org');
    const csrf = await getCsrf(a);
    await a.post('/api/billing/upgrade').set('x-csrf-token', csrf).send({ planSlug: 'growth', period: 'MONTHLY' });
    const pending = (await a.get('/api/billing')).body.data.payments.find((p: any) => p.status === 'PENDING');
    await a.post('/api/billing/demo/complete').set('x-csrf-token', csrf).send({ paymentId: pending.id });
    const paid = (await a.get('/api/billing')).body.data.payments.find((p: any) => p.status === 'SUCCEEDED');

    // Partial refund of half
    const half = await a.post(`/api/billing/payments/${paid.id}/refund`).set('x-csrf-token', csrf).send({ amount: paid.amount / 2 });
    expect(half.status).toBe(200);
    let after = await a.get('/api/billing');
    let p = after.body.data.payments.find((x: any) => x.id === paid.id);
    expect(p.status).toBe('PARTIALLY_REFUNDED');
    expect(p.refundedAmount).toBe(paid.amount / 2);

    // Over-refund rejected
    const over = await a.post(`/api/billing/payments/${paid.id}/refund`).set('x-csrf-token', csrf).send({ amount: paid.amount });
    expect(over.status).toBe(400);

    // Refunding an unsettled payment is blocked
    await a.post('/api/billing/upgrade').set('x-csrf-token', csrf).send({ planSlug: 'business', period: 'MONTHLY' });
    const pending2 = (await a.get('/api/billing')).body.data.payments.find((x: any) => x.status === 'PENDING');
    const blocked = await a.post(`/api/billing/payments/${pending2.id}/refund`).set('x-csrf-token', csrf).send({});
    expect(blocked.status).toBe(400);
    void after; void p;
  });
});

describe('Phase 5 · renewal & reconciliation', () => {
  it('rolls the subscription end date forward on renewal', async () => {
    const { agent: a } = await signupFresh('Renew Owner', 'Renew Org');
    const csrf = await getCsrf(a);
    await a.post('/api/billing/upgrade').set('x-csrf-token', csrf).send({ planSlug: 'growth', period: 'MONTHLY' });
    const pending = (await a.get('/api/billing')).body.data.payments.find((p: any) => p.status === 'PENDING');
    await a.post('/api/billing/demo/complete').set('x-csrf-token', csrf).send({ paymentId: pending.id });

    const before = (await a.get('/api/billing')).body.data.subscription;
    expect(before.status).toBe('ACTIVE');

    const renewed = await a.post('/api/billing/demo/renew').set('x-csrf-token', csrf).send({});
    expect(renewed.status).toBe(200);
    expect(renewed.body.data.renewed).toBe(true);

    const after = (await a.get('/api/billing')).body.data;
    expect(after.subscription.status).toBe('ACTIVE');
    // endsAt moved ~1 month forward
    const days = (new Date(after.subscription.endsAt).getTime() - new Date(before.endsAt).getTime()) / (24 * 60 * 60 * 1000);
    expect(days).toBeGreaterThan(27);
    expect(days).toBeLessThan(32);
    // A new settlement appeared for the renewed period
    expect(after.payments.filter((p: any) => p.status === 'SUCCEEDED').length).toBe(2);
  });

  it('rejects renewal without an active subscription', async () => {
    const { agent: a } = await signupFresh('NoRenew Owner', 'NoRenew Org');
    const csrf = await getCsrf(a);
    const res = await a.post('/api/billing/demo/renew').set('x-csrf-token', csrf).send({});
    expect(res.status).toBe(400);
  });

  it('reports reconciliation totals and exports CSV', async () => {
    const { agent: a } = await signupFresh('Recon Owner', 'Recon Org');
    const csrf = await getCsrf(a);
    await a.post('/api/billing/upgrade').set('x-csrf-token', csrf).send({ planSlug: 'growth', period: 'MONTHLY' });
    const pending = (await a.get('/api/billing')).body.data.payments.find((p: any) => p.status === 'PENDING');
    await a.post('/api/billing/demo/complete').set('x-csrf-token', csrf).send({ paymentId: pending.id });
    const paid = (await a.get('/api/billing')).body.data.payments.find((p: any) => p.status === 'SUCCEEDED');
    await a.post(`/api/billing/payments/${paid.id}/refund`).set('x-csrf-token', csrf).send({ amount: paid.amount / 2 });

    const recon = await a.get('/api/billing/reconciliation');
    expect(recon.status).toBe(200);
    expect(recon.body.data.totals.succeeded).toBe(1);
    expect(recon.body.data.totals.refunded).toBe(1);
    expect(recon.body.data.totals.collected).toBe(paid.amount);
    expect(recon.body.data.totals.refundedAmount).toBe(paid.amount / 2);
    expect(recon.body.data.totals.net).toBe(paid.amount / 2);

    const csv = await a.get('/api/billing/payments/export');
    expect(csv.status).toBe(200);
    expect(csv.headers['content-type']).toContain('text/csv');
    expect(csv.text).toContain('Amount (₹)');
    expect(csv.text).toContain('PARTIALLY_REFUNDED');
  });
});
// ────────────────────────────────────────────────────────────────────────
// Phase 6 — WhatsApp shared inbox
// ────────────────────────────────────────────────────────────────────────

/** Build a Meta-style signed webhook body for the org's phone number. */
async function metaWebhook(orgId: string, payload: Record<string, unknown>) {
  const { prisma } = await import('../lib/prisma');
  const { hmacSha256Hex } = await import('../whatsapp/provider');
  const rawBody = JSON.stringify(payload);
  const sig = `sha256=${hmacSha256Hex(process.env.PAYMENT_WEBHOOK_SECRET || 'test-webhook-secret', rawBody)}`;
  const me = await prisma.orgSetting.findUnique({ where: { orgId_key: { orgId, key: 'whatsapp' } } });
  const phoneNumberId = (me?.value as any)?.phoneNumberId;
  return { rawBody, sig, phoneNumberId };
}

function metaMessageEvent(phoneNumberId: string, waMessageId: string, from: string, body: string) {
  return {
    object: 'whatsapp_business_account',
    entry: [{
      id: phoneNumberId,
      changes: [{
        field: 'messages',
        value: {
          messaging_product: 'whatsapp',
          metadata: { display_phone_number: '15550001234', phone_number_id: phoneNumberId },
          contacts: [{ profile: { name: 'Test Customer' }, wa_id: from }],
          messages: [{ from, id: waMessageId, timestamp: String(Math.floor(Date.now() / 1000)), type: 'text', text: { body } }],
        },
      }],
    }],
  };
}

describe('Phase 6 · WhatsApp provider settings & webhook handshake', () => {
  it('saves provider settings without echoing the token', async () => {
    const { agent: a } = await signupFresh('Wa Owner', 'Wa Org');
    const csrf = await getCsrf(a);

    const saved = await a.patch('/api/whatsapp/settings').set('x-csrf-token', csrf).send({
      provider: 'meta',
      enabled: true,
      phoneNumberId: '105612345678901',
      verifyToken: 'verify-token-abc',
      token: 'EAAG-super-secret-token-123456',
    });
    expect(saved.status).toBe(200);
    expect(saved.body.data.settings.provider).toBe('meta');
    expect(saved.body.data.settings.hasToken).toBe(true);
    expect(saved.body.data.settings.phoneNumberId).toBe('105612345678901');
    expect(JSON.stringify(saved.body.data)).not.toContain('EAAG-super-secret-token');

    // reading settings never leaks the token
    const read = await a.get('/api/whatsapp/settings');
    expect(read.status).toBe(200);
    expect(JSON.stringify(read.body.data)).not.toContain('EAAG-super-secret-token');
    expect(read.body.data.settings.hasToken).toBe(true);

    // empty token on update keeps the existing one
    const keep = await a.patch('/api/whatsapp/settings').set('x-csrf-token', await getCsrf(a)).send({ provider: 'meta' });
    expect(keep.status).toBe(200);
    expect(keep.body.data.settings.hasToken).toBe(true);
  });

  it('answers the Meta hub verification handshake for the configured org', async () => {
    const { agent: a } = await signupFresh('Verify Owner', 'Verify Org');
    await a.patch('/api/whatsapp/settings').set('x-csrf-token', await getCsrf(a)).send({
      provider: 'meta',
      verifyToken: 'my-verify-token-1',
      token: 'EAAG-token-abcdef-123456',
    });
    const res = await request(server).get('/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=my-verify-token-1&hub.challenge=12345678');
    expect(res.status).toBe(200);
    expect(res.text).toBe('12345678');
  });

  it('rejects the handshake with a wrong verify token', async () => {
    const res = await request(server).get('/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=wrong-token&hub.challenge=12345678');
    expect(res.status).toBe(403);
  });
});

describe('Phase 6 · inbound messages, lead linking & idempotency', () => {
  it('simulates an inbound message that creates a conversation linked to a lead', async () => {
    const { agent: a } = await signupFresh('Inbound Owner', 'Inbound Org');
    const csrf = await getCsrf(a);

    // a lead whose phone matches the customer number (91 prefix dropped)
    const lead = await a.post('/api/leads').set('x-csrf-token', csrf).send({
      name: 'Ravi Sharma',
      phone: '9812345678',
      source: 'WEBSITE',
    });
    expect(lead.status).toBe(201);
    const leadId = lead.body.data.lead.id;

    const sim = await a.post('/api/whatsapp/demo/inbound').set('x-csrf-token', csrf).send({
      from: '919812345678',
      body: 'Hi, I need a website for my shop.',
    });
    expect(sim.status).toBe(201);
    expect(sim.body.data.received).toBe(true);
    expect(sim.body.data.normalizedFrom).toBe('919812345678');
    const conversationId = sim.body.data.conversationId;

    // conversation is linked to the lead and marked unread
    const detail = await a.get(`/api/whatsapp/conversations/${conversationId}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.conversation.leadId).toBe(leadId);
    expect(detail.body.data.conversation.customerName).toBe('Ravi Sharma');
    expect(detail.body.data.conversation.unreadCount).toBe(1);
    expect(detail.body.data.messages.length).toBe(1);
    expect(detail.body.data.messages[0].direction).toBe('INBOUND');
    expect(detail.body.data.messages[0].body).toContain('website');

    // the timeline on the lead reflects the WhatsApp message
    const leadDetail = await a.get(`/api/leads/${leadId}`);
    const waActivity = leadDetail.body.data.lead.activities.find((x: any) => x.type === 'WHATSAPP');
    expect(waActivity).toBeTruthy();
    expect(waActivity.body).toContain('website');

    // the conversation appears in the list with the preview + unread count
    const list = await a.get('/api/whatsapp/conversations');
    expect(list.body.data.conversations.length).toBe(1);
    expect(list.body.data.unreadTotal).toBe(1);
    expect(list.body.data.conversations[0].lastMessagePreview).toContain('website');
  });

  it('deduplicates a signed Meta webhook by provider message id', async () => {
    const { agent: a } = await signupFresh('Webhook Owner', 'Webhook Org');
    const { prisma } = await import('../lib/prisma');
    await a.patch('/api/whatsapp/settings').set('x-csrf-token', await getCsrf(a)).send({
      provider: 'meta',
      phoneNumberId: '1056999888777',
      token: 'EAAG-webhook-token-123456',
    });
    const me = await a.get('/api/auth/me');
    const orgId = me.body.data.org.id;

    const waMessageId = 'wamid.phase6.unique.001';
    const event = metaMessageEvent('1056999888777', waMessageId, '919876000111', 'First webhook hello');
    const { rawBody, sig } = await metaWebhook(orgId, event);

    const fire = (replay: boolean) =>
      request(server)
        .post('/api/webhooks/whatsapp')
        .set('Content-Type', 'application/json')
        .set('x-hub-signature-256', sig)
        .send(rawBody);

    const first = await fire(false);
    expect(first.status).toBe(200);
    expect(first.body.data.received).toBe(true);

    // fire the identical payload again (provider retry) — acknowledged, not duplicated
    const replay = await fire(true);
    expect(replay.status).toBe(200);

    const count = await prisma.message.count({ where: { waMessageId } });
    expect(count).toBe(1);

    // the conversation has exactly one message
    const convs = await a.get('/api/whatsapp/conversations');
    expect(convs.body.data.conversations.length).toBe(1);
    const convDetail = await a.get(`/api/whatsapp/conversations/${convs.body.data.conversations[0].id}`);
    expect(convDetail.body.data.messages.length).toBe(1);
  });

  it('rejects a signed Meta webhook with a bad signature', async () => {
    const bad = await request(server)
      .post('/api/webhooks/whatsapp')
      .set('Content-Type', 'application/json')
      .set('x-hub-signature-256', 'sha256=deadbeef')
      .send(JSON.stringify({ object: 'whatsapp_business_account', entry: [] }));
    expect(bad.status).toBe(400);
  });
});
describe('Phase 6 · outbound messages, templates & status', () => {
  it('sends an outbound text and template message', async () => {
    const { agent: a } = await signupFresh('Outbound Owner', 'Outbound Org');
    const csrf = await getCsrf(a);

    // seed a conversation via the demo simulator
    await a.post('/api/whatsapp/demo/inbound').set('x-csrf-token', csrf).send({
      from: '919900112233',
      body: 'Hello, pricing please?',
    });
    const convs = await a.get('/api/whatsapp/conversations');
    const conversationId = convs.body.data.conversations[0].id;

    // text reply
    const reply = await a.post(`/api/whatsapp/conversations/${conversationId}/messages`).set('x-csrf-token', csrf).send({
      body: 'Sure — a website starts at ₹25,000. Shall I share a quote?',
    });
    expect(reply.status).toBe(201);
    expect(reply.body.data.sent).toBe(true);

    const detail = await a.get(`/api/whatsapp/conversations/${conversationId}`);
    expect(detail.body.data.messages.length).toBe(2);
    const outbound = detail.body.data.messages.find((m: any) => m.direction === 'OUTBOUND');
    expect(outbound.status).toBe('SENT');
    expect(outbound.body).toContain('₹25,000');
    expect(detail.body.data.conversation.lastMessagePreview).toContain('₹25,000');

    // template message with params
    const tmpl = await a.post('/api/whatsapp/templates').set('x-csrf-token', csrf).send({
      name: 'follow_up_offer',
      category: 'UTILITY',
      body: 'Hi {{1}}, your quote for {{2}} is ready.',
    });
    expect(tmpl.status).toBe(201);

    const sendT = await a.post(`/api/whatsapp/conversations/${conversationId}/messages`).set('x-csrf-token', csrf).send({
      templateName: 'follow_up_offer',
      templateParams: ['Ravi', 'Website Design'],
    });
    expect(sendT.status).toBe(201);
    expect(sendT.body.data.sent).toBe(true);

    const detail2 = await a.get(`/api/whatsapp/conversations/${conversationId}`);
    const templated = detail2.body.data.messages.find((m: any) => m.type === 'TEMPLATE');
    expect(templated).toBeTruthy();
    expect(templated.waTemplateName).toBe('follow_up_offer');
    expect(templated.direction).toBe('OUTBOUND');

    // duplicate template names are rejected (unique per org)
    const dup = await a.post('/api/whatsapp/templates').set('x-csrf-token', csrf).send({
      name: 'follow_up_offer',
      body: 'Duplicate.',
    });
    expect(dup.status).toBe(409);
  });

  it('applies delivery/read status updates from the provider webhook', async () => {
    const { agent: a } = await signupFresh('Status Owner', 'Status Org');
    const { prisma } = await import('../lib/prisma');
    const csrf = await getCsrf(a);
    // demo provider so outbound sends succeed, but keep the phoneNumberId so
    // the Meta-style status webhook can resolve this org (statuses flow through
    // the provider webhook regardless of which adapter sends).
    await a.patch('/api/whatsapp/settings').set('x-csrf-token', csrf).send({
      provider: 'demo',
      phoneNumberId: '1056000111222',
    });
    const me = await a.get('/api/auth/me');
    const orgId = me.body.data.org.id;

    await a.post('/api/whatsapp/demo/inbound').set('x-csrf-token', csrf).send({ from: '919877665544', body: 'Are you there?' });
    const convs = await a.get('/api/whatsapp/conversations');
    const conversationId = convs.body.data.conversations[0].id;
    await a.post(`/api/whatsapp/conversations/${conversationId}/messages`).set('x-csrf-token', csrf).send({ body: 'Yes, how can I help?' });

    // the demo provider assigned a real waMessageId — fetch it from the DB
    const outbound = await prisma.message.findFirst({ where: { conversationId, direction: 'OUTBOUND' } });
    expect(outbound?.waMessageId).toBeTruthy();

    const statusEvent = (status: string) => ({
      object: 'whatsapp_business_account',
      entry: [{
        id: '1056000111222',
        changes: [{
          field: 'messages',
          value: {
            messaging_product: 'whatsapp',
            metadata: { display_phone_number: '15550001234', phone_number_id: '1056000111222' },
            statuses: [{
              id: outbound!.waMessageId,
              status,
              timestamp: String(Math.floor(Date.now() / 1000)),
              recipient_id: '919877665544',
            }],
          },
        }],
      }],
    });

    const fire = async (payload: Record<string, unknown>) => {
      const { hmacSha256Hex } = await import('../whatsapp/provider');
      const rawBody = JSON.stringify(payload);
      const sig = `sha256=${hmacSha256Hex(process.env.PAYMENT_WEBHOOK_SECRET || 'test-webhook-secret', rawBody)}`;
      return request(server)
        .post('/api/webhooks/whatsapp')
        .set('Content-Type', 'application/json')
        .set('x-hub-signature-256', sig)
        .send(rawBody);
    };

    expect((await fire(statusEvent('DELIVERED'))).status).toBe(200);
    expect((await fire(statusEvent('READ'))).status).toBe(200);

    const after = await prisma.message.findUnique({ where: { id: outbound!.id } });
    expect(after?.status).toBe('READ');
    expect(after?.deliveredAt).toBeTruthy();
    expect(after?.readAt).toBeTruthy();
  });

  it('assigns, closes, reopens and marks conversations read', async () => {
    const { agent: a } = await signupFresh('Assign Owner', 'Assign Org');
    const csrf = await getCsrf(a);
    await a.post('/api/whatsapp/demo/inbound').set('x-csrf-token', csrf).send({ from: '919811223344', body: 'Need support.' });
    const convs = await a.get('/api/whatsapp/conversations');
    const conversationId = convs.body.data.conversations[0].id;

    // assign to self (the owner)
    const me = await a.get('/api/auth/me');
    const ownerId = me.body.data.user.id;
    const assigned = await a.patch(`/api/whatsapp/conversations/${conversationId}`).set('x-csrf-token', csrf).send({ assigneeId: ownerId });
    expect(assigned.status).toBe(200);
    expect(assigned.body.data.conversation.assigneeId).toBe(ownerId);

    // mark read clears the unread count
    const read = await a.post(`/api/whatsapp/conversations/${conversationId}/read`).set('x-csrf-token', csrf).send({});
    expect(read.status).toBe(200);
    const afterRead = await a.get(`/api/whatsapp/conversations/${conversationId}`);
    expect(afterRead.body.data.conversation.unreadCount).toBe(0);

    // close then reopen
    const closed = await a.patch(`/api/whatsapp/conversations/${conversationId}`).set('x-csrf-token', csrf).send({ status: 'CLOSED' });
    expect(closed.body.data.conversation.status).toBe('CLOSED');
    const open = await a.patch(`/api/whatsapp/conversations/${conversationId}`).set('x-csrf-token', csrf).send({ status: 'OPEN' });
    expect(open.body.data.conversation.status).toBe('OPEN');

    // assigning to a user from another org is rejected
    const other = await signupFresh('Other Org Owner', 'Other Org');
    const otherMe = await other.agent.get('/api/auth/me');
    const badAssign = await a.patch(`/api/whatsapp/conversations/${conversationId}`).set('x-csrf-token', await getCsrf(a)).send({ assigneeId: otherMe.body.data.user.id });
    expect(badAssign.status).toBe(400);
  });

  it('enforces RBAC — viewers cannot send or manage conversations', async () => {
    const { agent: a } = await signupFresh('Rbac Wa Owner', 'Rbac Wa Org');
    const viewerEmail = 'waviewer@test.com';
    await a.post('/api/team').set('x-csrf-token', await getCsrf(a)).send({
      name: 'Wa Viewer',
      email: viewerEmail,
      role: 'VIEWER',
      password: 'StrongPass123',
    });
    const csrf = await getCsrf(a);
    await a.post('/api/whatsapp/demo/inbound').set('x-csrf-token', csrf).send({ from: '919800001111', body: 'Hello?' });
    const convs = await a.get('/api/whatsapp/conversations');
    const conversationId = convs.body.data.conversations[0].id;

    const viewer = request.agent(server);
    await loginAs(viewer, viewerEmail, 'StrongPass123');

    // viewer can read the inbox
    expect((await viewer.get('/api/whatsapp/conversations')).status).toBe(200);
    expect((await viewer.get(`/api/whatsapp/conversations/${conversationId}`)).status).toBe(200);

    // viewer cannot send
    const send = await viewer.post(`/api/whatsapp/conversations/${conversationId}/messages`).set('x-csrf-token', await getCsrf(viewer)).send({ body: 'hi' });
    expect(send.status).toBe(403);

    // viewer cannot assign
    const assign = await viewer.patch(`/api/whatsapp/conversations/${conversationId}`).set('x-csrf-token', await getCsrf(viewer)).send({ status: 'CLOSED' });
    expect(assign.status).toBe(403);

    // viewer cannot manage templates
    const tmpl = await viewer.post('/api/whatsapp/templates').set('x-csrf-token', await getCsrf(viewer)).send({ name: 'nope', body: 'nope' });
    expect(tmpl.status).toBe(403);
  });
  it('keeps conversations org-isolated', async () => {
    const { agent: a } = await signupFresh('Isolation A', 'Isolation Org A');
    const { agent: b } = await signupFresh('Isolation B', 'Isolation Org B');
    const csrf = await getCsrf(a);
    await a.post('/api/whatsapp/demo/inbound').set('x-csrf-token', csrf).send({ from: '919811110000', body: 'Org A message.' });

    const convsA = await a.get('/api/whatsapp/conversations');
    const conversationId = convsA.body.data.conversations[0].id;

    // org B sees an empty inbox and cannot read org A's conversation
    const listB = await b.get('/api/whatsapp/conversations');
    expect(listB.body.data.conversations.length).toBe(0);
    const readB = await b.get(`/api/whatsapp/conversations/${conversationId}`);
    expect(readB.status).toBe(404);

    // org B cannot send into org A's conversation either
    const sendB = await b.post(`/api/whatsapp/conversations/${conversationId}/messages`).set('x-csrf-token', await getCsrf(b)).send({ body: 'sneak' });
    expect(sendB.status).toBe(404);
  });
});
// ────────────────────────────────────────────────────────────────────────
// Phase 7 — IndiaMART + Meta Lead Ads source adapters
// ────────────────────────────────────────────────────────────────────────

async function connectSource(source: string, a: ReturnType<typeof request.agent>) {
  const csrf = await getCsrf(a);
  const res = await a.post(`/api/integrations/${source}/connect`).set('x-csrf-token', csrf);
  expect(res.status).toBe(200);
  return res.body.data.integration.webhookSecret as string;
}

describe('Phase 7 · IndiaMART adapter', () => {
  it('normalizes a buyer enquiry into a source-attributed lead and logs it', async () => {
    const { agent: a } = await signupFresh('Im Owner', 'Im Org');
    const secret = await connectSource('INDIAMART', a);

    const res = await request(server)
      .post('/api/webhooks/indiamart')
      .set('x-webhook-secret', secret)
      .send({
        QUERY_ID: 'IM-QUERY-88231',
        BUYER_NAME: 'Vikram Malhotra',
        MOBILE: '9815557777',
        EMAIL: 'vikram@example.com',
        COMPANY: 'Malhotra Steels',
        PRODUCT: 'CNC machine',
        QUERY: 'Need a quote for a CNC lathe, delivery to Pune.',
        CITY: 'Pune',
        STATE: 'Maharashtra',
        QTY: '2 units',
      });
    expect(res.status).toBe(201);
    expect(res.body.data.received).toBe(true);

    const leads = await a.get('/api/leads?search=vikram');
    const lead = leads.body.data.rows[0];
    expect(lead.source).toBe('INDIAMART');
    expect(lead.name).toBe('Vikram Malhotra');
    expect(lead.company).toBe('Malhotra Steels');
    expect(lead.customFields.product).toBe('CNC machine');
    expect(lead.customFields.city).toBe('Pune');
    expect(lead.customFields.indiamartQueryId).toBe('IM-QUERY-88231');
    expect(lead.notes).toContain('CNC');

    // the attempt is logged as SUCCESS
    const logs = await a.get('/api/integrations/INDIAMART/logs');
    expect(logs.status).toBe(200);
    expect(logs.body.data.counts.success).toBe(1);
    expect(logs.body.data.logs[0].status).toBe('SUCCESS');
    expect(logs.body.data.logs[0].externalId).toBe('IM-QUERY-88231');
    expect(logs.body.data.health.lastSyncAt).toBeTruthy();
  });

  it('answers 409 on a duplicate buyer and 409 on a replay of the same query id', async () => {
    const { agent: a } = await signupFresh('Im Dup Owner', 'Im Dup Org');
    const secret = await connectSource('INDIAMART', a);

    const payload = {
      QUERY_ID: 'IM-QUERY-90001',
      BUYER_NAME: 'Sameer Jain',
      MOBILE: '9816668888',
      QUERY: 'Interested in packaging machines.',
    };
    expect((await request(server).post('/api/webhooks/indiamart').set('x-webhook-secret', secret).send(payload)).status).toBe(201);

    // same phone → duplicate
    const dupPhone = await request(server)
      .post('/api/webhooks/indiamart')
      .set('x-webhook-secret', secret)
      .send({ ...payload, QUERY_ID: 'IM-QUERY-90002', BUYER_NAME: 'Sameer Again' });
    expect(dupPhone.status).toBe(409);
    expect(dupPhone.body.error.message).toContain('already exists');

    // same QUERY_ID (provider retry) with a different number → replay-guarded
    const replay = await request(server)
      .post('/api/webhooks/indiamart')
      .set('x-webhook-secret', secret)
      .send({ ...payload, MOBILE: '9816669999' });
    expect(replay.status).toBe(409);
    expect(replay.body.error.message).toContain('replay');

    const logs = await a.get('/api/integrations/INDIAMART/logs');
    expect(logs.body.data.counts.success).toBe(1);
    expect(logs.body.data.counts.duplicate).toBe(2);

    // exactly one lead with this phone
    const leads = await a.get('/api/leads?search=Sameer');
    expect(leads.body.data.rows.filter((l: any) => l.phone === '9816668888').length).toBe(1);
  });

  it('rejects malformed enquiries with 422, logs them, and degrades connection health', async () => {
    const { agent: a } = await signupFresh('Im Bad Owner', 'Im Bad Org');
    const secret = await connectSource('INDIAMART', a);

    const bad = await request(server).post('/api/webhooks/indiamart').set('x-webhook-secret', secret).send({ random: 'nonsense' });
    expect(bad.status).toBe(422);
    expect(bad.body.error.code).toBe('INVALID_PAYLOAD');

    // repeated failures flip the connection to ERROR health
    for (let i = 0; i < 4; i++) {
      await request(server).post('/api/webhooks/indiamart').set('x-webhook-secret', secret).send({ nope: i });
    }
    const integrations = await a.get('/api/integrations');
    const im = integrations.body.data.connections.find((c: any) => c.source === 'INDIAMART');
    expect(im.status).toBe('ERROR');
    expect(im.errorCount).toBeGreaterThanOrEqual(5);
    expect(im.lastError).toBeTruthy();

    // a healthy payload resets the health
    const okRes = await request(server).post('/api/webhooks/indiamart').set('x-webhook-secret', secret).send({
      BUYER_NAME: 'Healthy Buyer',
      MOBILE: '9811112222',
      QUERY: 'Hello',
    });
    expect(okRes.status).toBe(201);
    const after = (await a.get('/api/integrations')).body.data.connections.find((c: any) => c.source === 'INDIAMART');
    expect(after.status).toBe('CONNECTED');
    expect(after.errorCount).toBe(0);
  });
});
describe('Phase 7 · Meta Lead Ads adapter', () => {
  it('normalizes a Facebook leadgen webhook into a lead with campaign attribution', async () => {
    const { agent: a } = await signupFresh('Meta Owner', 'Meta Org');
    const secret = await connectSource('FACEBOOK', a);

    const res = await request(server)
      .post('/api/webhooks/facebook')
      .set('x-webhook-secret', secret)
      .send({
        object: 'page',
        entry: [{
          id: 'page-1001',
          changes: [{
            field: 'leadgen',
            value: {
              leadgen_id: 'leadgen-556677',
              form_id: 'form-900',
              ad_id: 'ad-77',
              adset_id: 'adset-55',
              campaign_id: 'camp-33',
              page_id: 'page-1001',
              created_time: 1720000000,
              field_data: [
                { name: 'full_name', values: ['Ananya Gupta'] },
                { name: 'phone_number', values: ['+91 98300 11223'] },
                { name: 'email', values: ['ananya@example.com'] },
                { name: 'company_name', values: ['Gupta Interiors'] },
                { name: 'city', values: ['Mumbai'] },
                { name: 'budget', values: ['₹50k–1L'] },
              ],
            },
          }],
        }],
      });
    expect(res.status).toBe(201);

    const leads = await a.get('/api/leads?search=ananya');
    const lead = leads.body.data.rows[0];
    expect(lead.source).toBe('FACEBOOK');
    expect(lead.name).toBe('Ananya Gupta');
    expect(lead.phone).toBe('9830011223');
    expect(lead.customFields.metaCampaignId).toBe('camp-33');
    expect(lead.customFields.metaAdId).toBe('ad-77');
    expect(lead.customFields.metaFormId).toBe('form-900');
    expect(lead.customFields['question:budget']).toBe('₹50k–1L');

    const logs = await a.get('/api/integrations/FACEBOOK/logs');
    expect(logs.body.data.counts.success).toBe(1);
    expect(logs.body.data.logs[0].externalId).toBe('leadgen-556677');
  });

  it('replays the same leadgen_id only once and rejects malformed payloads', async () => {
    const { agent: a } = await signupFresh('Meta Dup Owner', 'Meta Dup Org');
    const secret = await connectSource('FACEBOOK', a);

    const payload = {
      object: 'page',
      entry: [{
        id: 'page-2',
        changes: [{
          field: 'leadgen',
          value: {
            leadgen_id: 'leadgen-999',
            form_id: 'form-1',
            field_data: [
              { name: 'full_name', values: ['Repeat Customer'] },
              { name: 'phone_number', values: ['9812340000'] },
            ],
          },
        }],
      }],
    };

    expect((await request(server).post('/api/webhooks/facebook').set('x-webhook-secret', secret).send(payload)).status).toBe(201);
    // provider retries the identical event → replayed, no new lead
    const replay = await request(server).post('/api/webhooks/facebook').set('x-webhook-secret', secret).send(payload);
    expect(replay.status).toBe(409);
    expect(replay.body.error.message).toContain('replay');

    const leads = await a.get('/api/leads?search=Repeat');
    expect(leads.body.data.rows.length).toBe(1);

    // malformed (no leadgen_id) → 422
    const bad = await request(server)
      .post('/api/webhooks/facebook')
      .set('x-webhook-secret', secret)
      .send({ object: 'page', entry: [{ changes: [{ field: 'leadgen', value: { field_data: [] } }] }] });
    expect(bad.status).toBe(422);
  });

  it('keeps integration logs org-isolated and manager-gated', async () => {
    const { agent: a } = await signupFresh('Log Owner A', 'Log Org A');
    const { agent: b } = await signupFresh('Log Owner B', 'Log Org B');
    const secret = await connectSource('INDIAMART', a);
    await request(server).post('/api/webhooks/indiamart').set('x-webhook-secret', secret).send({
      BUYER_NAME: 'Org A Buyer',
      MOBILE: '9817770000',
      QUERY: 'hi',
    });

    // org B cannot see org A's logs (no connection of its own either)
    const logsB = await b.get('/api/integrations/INDIAMART/logs');
    expect(logsB.status).toBe(400);
    expect(logsB.body.error.message).toContain('Connect');

    // viewer cannot access logs
    const { agent: owner } = await signupFresh('Log Rbac Owner', 'Log Rbac Org');
    const viewerEmail = 'logviewer@test.com';
    await owner.post('/api/team').set('x-csrf-token', await getCsrf(owner)).send({
      name: 'Log Viewer',
      email: viewerEmail,
      role: 'VIEWER',
      password: 'StrongPass123',
    });
    const viewer = request.agent(server);
    await loginAs(viewer, viewerEmail, 'StrongPass123');
    const denied = await viewer.get('/api/integrations/INDIAMART/logs');
    expect(denied.status).toBe(403);
  });
});
// ────────────────────────────────────────────────────────────────────────
// Phase 9 — AI engine: lead intelligence, usage ledger & budget
// ────────────────────────────────────────────────────────────────────────

describe('Phase 9 · lead intelligence (rule fallback when no AI key)', () => {
  it('summarizes, scores and suggests a next action for a lead', async () => {
    const { agent: a } = await signupFresh('Ai Owner', 'Ai Org');
    const csrf = await getCsrf(a);
    const created = await a.post('/api/leads').set('x-csrf-token', csrf).send({
      name: 'AI Prospect',
      phone: '9810009090',
      email: 'prospect@example.com',
      priority: 'HIGH',
      expectedValue: 200000,
      notes: 'Wants a full website revamp.',
      source: 'WEBSITE',
    });
    const leadId = created.body.data.lead.id;

    // summary — rule source (no key configured)
    const summary = await a.post(`/api/ai/lead/${leadId}/summary`).set('x-csrf-token', csrf).send({});
    expect(summary.status).toBe(200);
    expect(summary.body.data.enabled).toBe(true);
    expect(summary.body.data.source).toBe('rules');
    expect(summary.body.data.summary).toContain('AI Prospect');
    expect(summary.body.data.summary).toContain('₹2,00,000');

    // score — same heuristic as the stored score
    const score = await a.post(`/api/ai/lead/${leadId}/score`).set('x-csrf-token', csrf).send({});
    expect(score.status).toBe(200);
    expect(score.body.data.source).toBe('rules');
    expect(score.body.data.score).toBeGreaterThanOrEqual(50);
    expect(score.body.data.reasoning).toContain('high priority');

    // next action — never-contacted lead gets a first-outreach suggestion
    const action = await a.post(`/api/ai/lead/${leadId}/next-action`).set('x-csrf-token', csrf).send({});
    expect(action.status).toBe(200);
    expect(action.body.data.source).toBe('rules');
    expect(action.body.data.action).toContain('never been contacted');
    expect(action.body.data.createdTaskId).toBeNull(); // SUGGEST mode never writes
  });

  it('AUTOMATIC mode lets the next action create the follow-up task; OFF disables everything', async () => {
    const { agent: a } = await signupFresh('Ai Mode Owner', 'Ai Mode Org');
    const csrf = await getCsrf(a);
    const created = await a.post('/api/leads').set('x-csrf-token', csrf).send({
      name: 'Auto Lead',
      phone: '9811110101',
      source: 'MANUAL',
    });
    const leadId = created.body.data.lead.id;

    // switch to AUTOMATIC (manager-gated)
    const setMode = await a.patch('/api/ai/settings').set('x-csrf-token', csrf).send({ mode: 'AUTOMATIC' });
    expect(setMode.status).toBe(200);
    expect(setMode.body.data.mode).toBe('AUTOMATIC');

    const action = await a.post(`/api/ai/lead/${leadId}/next-action`).set('x-csrf-token', csrf).send({});
    expect(action.status).toBe(200);
    expect(action.body.data.createdTaskId).toBeTruthy();

    const tasks = await a.get('/api/tasks?view=all');
    expect(tasks.body.data.tasks.some((t: any) => t.title.includes('Auto Lead'))).toBe(true);

    // OFF mode: everything disabled, nothing generated
    await a.patch('/api/ai/settings').set('x-csrf-token', await getCsrf(a)).send({ mode: 'OFF' });
    const offSummary = await a.post(`/api/ai/lead/${leadId}/summary`).set('x-csrf-token', await getCsrf(a)).send({});
    expect(offSummary.body.data.enabled).toBe(false);
    expect(offSummary.body.data.mode).toBe('OFF');
    expect(offSummary.body.data.summary).toBeNull();
  });

  it('enforces the org AI budget before any generation', async () => {
    const { agent: a } = await signupFresh('Ai Budget Owner', 'Ai Budget Org');
    const { prisma } = await import('../lib/prisma');
    const csrf = await getCsrf(a);
    const me = await a.get('/api/auth/me');
    const orgId = me.body.data.org.id;

    // set a tiny budget (₹1) and record ₹5 of usage for this month
    await a.patch('/api/ai/settings').set('x-csrf-token', csrf).send({ monthlyLimitRupees: 1 });
    await prisma.aiUsage.create({
      data: { orgId, category: 'OTHER', totalTokens: 1000, costEstimatePaise: 500 }, // ₹5 > ₹1
    });

    const created = await a.post('/api/leads').set('x-csrf-token', await getCsrf(a)).send({ name: 'Budget Lead', phone: '9812220202' });
    const res = await a.post(`/api/ai/lead/${created.body.data.lead.id}/summary`).set('x-csrf-token', await getCsrf(a)).send({});
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('AI_BUDGET_EXCEEDED');
    expect(res.body.error.message).toContain('budget');
  });

  it('reports usage stats and settings with a budget meter', async () => {
    const { agent: a } = await signupFresh('Ai Usage Owner', 'Ai Usage Org');
    const csrf = await getCsrf(a);
    const created = await a.post('/api/leads').set('x-csrf-token', csrf).send({ name: 'Stats Lead', phone: '9813330303' });
    const leadId = created.body.data.lead.id;

    // rule-based calls record no usage rows (no provider call happened)
    await a.post(`/api/ai/lead/${leadId}/score`).set('x-csrf-token', csrf).send({});

    const usage = await a.get('/api/ai/usage');
    expect(usage.status).toBe(200);
    expect(usage.body.data.budget.monthlyLimitRupees).toBeGreaterThan(0);
    expect(usage.body.data.stats.calls).toBeGreaterThanOrEqual(0);

    const settings = await a.get('/api/ai/settings');
    expect(settings.status).toBe(200);
    expect(['OFF', 'SUGGEST', 'AUTOMATIC']).toContain(settings.body.data.mode);
    expect(settings.body.data.budget.spentRupees).toBeGreaterThanOrEqual(0);
  });

  it('keeps lead intelligence org-scoped and sales-scoped', async () => {
    const { agent: a } = await signupFresh('Ai Iso A', 'Ai Iso Org A');
    const { agent: b } = await signupFresh('Ai Iso B', 'Ai Iso Org B');
    const csrf = await getCsrf(a);
    const created = await a.post('/api/leads').set('x-csrf-token', csrf).send({ name: 'Isolated Lead', phone: '9814440404' });
    const leadId = created.body.data.lead.id;

    // another org cannot read it
    const cross = await b.post(`/api/ai/lead/${leadId}/summary`).set('x-csrf-token', await getCsrf(b)).send({});
    expect(cross.status).toBe(404);

    // a salesperson who doesn't own it cannot read it either
    const { agent: owner } = await signupFresh('Ai Sales Boss', 'Ai Sales Org');
    const salesEmail = 'aisales@test.com';
    await owner.post('/api/team').set('x-csrf-token', await getCsrf(owner)).send({
      name: 'Ai Sales', email: salesEmail, role: 'SALES', password: 'StrongPass123',
    });
    const sales = request.agent(server);
    await loginAs(sales, salesEmail, 'StrongPass123');
    const denied = await sales.post(`/api/ai/lead/${leadId}/summary`).set('x-csrf-token', await getCsrf(sales)).send({});
    expect(denied.status).toBe(404);
  });
});
// ────────────────────────────────────────────────────────────────────────
// Phase 10 — Automation engine
// ────────────────────────────────────────────────────────────────────────

describe('Phase 10 · automation rules as data', () => {
  it('fires a LEAD_CREATED rule: creates a task, adds a tag, and logs the run', async () => {
    const { agent: a } = await signupFresh('Auto Owner', 'Auto Org');
    const csrf = await getCsrf(a);

    const rule = await a.post('/api/automations').set('x-csrf-token', csrf).send({
      name: 'New lead follow-up',
      trigger: 'LEAD_CREATED',
      actions: [
        { type: 'CREATE_TASK', title: 'Call the new lead', kind: 'CALL', dueInDays: 1 },
        { type: 'ADD_TAG', tag: 'hot-lead' },
      ],
    });
    expect(rule.status).toBe(201);
    const ruleId = rule.body.data.rule.id;

    const created = await a.post('/api/leads').set('x-csrf-token', await getCsrf(a)).send({
      name: 'Automation Target',
      phone: '9815550101',
      source: 'WEBSITE',
    });
    expect(created.status).toBe(201);
    const leadId = created.body.data.lead.id;

    // the task was created by the automation
    const tasks = await a.get('/api/tasks?view=all');
    const autoTask = tasks.body.data.tasks.find((t: any) => t.title === 'Call the new lead' && t.leadId === leadId);
    expect(autoTask).toBeTruthy();

    // the tag was added
    const detail = await a.get(`/api/leads/${leadId}`);
    expect(detail.body.data.lead.tags).toContain('hot-lead');

    // the run was logged as SUCCESS and the rule counters moved
    const list = await a.get('/api/automations');
    const ruleRow = list.body.data.rules.find((r: any) => r.id === ruleId);
    expect(ruleRow.runCount).toBe(1);
    expect(ruleRow.lastRunAt).toBeTruthy();
    const run = list.body.data.runs[0];
    expect(run.status).toBe('SUCCESS');
    expect(run.trigger).toBe('LEAD_CREATED');
    expect(run.result.actions.some((x: any) => x.message.includes('Call the new lead'))).toBe(true);
  });

  it('respects source conditions (SKIPPED when they do not match) and paused rules', async () => {
    const { agent: a } = await signupFresh('Auto Cond Owner', 'Auto Cond Org');
    const csrf = await getCsrf(a);

    const rule = await a.post('/api/automations').set('x-csrf-token', csrf).send({
      name: 'IndiaMART only',
      trigger: 'LEAD_CREATED',
      triggerConfig: { source: 'INDIAMART' },
      actions: [{ type: 'ADD_TAG', tag: 'im-lead' }],
    });
    const ruleId = rule.body.data.rule.id;

    // lead from WEBSITE → conditions not met → SKIPPED run, no tag
    const webLead = await a.post('/api/leads').set('x-csrf-token', await getCsrf(a)).send({ name: 'Web Guy', phone: '9815550202', source: 'WEBSITE' });
    const webDetail = await a.get(`/api/leads/${webLead.body.data.lead.id}`);
    expect(webDetail.body.data.lead.tags || []).not.toContain('im-lead');

    // lead from INDIAMART → tag added
    const imLead = await a.post('/api/leads').set('x-csrf-token', await getCsrf(a)).send({ name: 'IM Guy', phone: '9815550303', source: 'INDIAMART' });
    const imDetail = await a.get(`/api/leads/${imLead.body.data.lead.id}`);
    expect(imDetail.body.data.lead.tags).toContain('im-lead');

    // pause the rule — nothing fires any more
    await a.patch(`/api/automations/${ruleId}`).set('x-csrf-token', await getCsrf(a)).send({ enabled: false });
    const before = (await a.get('/api/automations')).body.data.rules.find((r: any) => r.id === ruleId).runCount;
    await a.post('/api/leads').set('x-csrf-token', await getCsrf(a)).send({ name: 'IM Two', phone: '9815550404', source: 'INDIAMART' });
    const after = (await a.get('/api/automations')).body.data.rules.find((r: any) => r.id === ruleId).runCount;
    expect(after).toBe(before);
  });

  it('moves a lead to a stage when the STAGE_CHANGED trigger fires and re-assigns via round-robin', async () => {
    const { agent: a } = await signupFresh('Auto Stage Owner', 'Auto Stage Org');
    const { prisma } = await import('../lib/prisma');
    const csrf = await getCsrf(a);

    // GROWTH so the plan cap (STARTER = 2 users) doesn't block the second salesperson
    await prisma.organization.update({
      where: { id: (await a.get('/api/auth/me')).body.data.org.id },
      data: { plan: 'GROWTH' },
    });
    await a.post('/api/team').set('x-csrf-token', await getCsrf(a)).send({
      name: 'Auto Sales A', email: 'autosalesa@test.com', role: 'SALES', password: 'StrongPass123',
    });
    const second = await a.post('/api/team').set('x-csrf-token', await getCsrf(a)).send({
      name: 'Auto Sales B', email: 'autosalesb@test.com', role: 'SALES', password: 'StrongPass123',
    });
    expect(second.status).toBe(201);

    const pipeline = await a.get('/api/pipeline');
    const qualified = pipeline.body.data.stages.find((s: any) => s.name === 'Qualified');

    const rule = await a.post('/api/automations').set('x-csrf-token', await getCsrf(a)).send({
      name: 'Escalate qualified',
      trigger: 'STAGE_CHANGED',
      actions: [
        { type: 'ASSIGN_USER', mode: 'roundRobin' },
        { type: 'NOTIFY_TEAM', message: 'A lead reached Qualified — focus on it!' },
      ],
    });
    expect(rule.status).toBe(201);

    const created = await a.post('/api/leads').set('x-csrf-token', await getCsrf(a)).send({ name: 'Stage Target', phone: '9815550505', source: 'MANUAL' });
    const leadId = created.body.data.lead.id;
    const firstOwner = created.body.data.lead.ownerId;

    // move the lead to Qualified → automation reassigns + notifies
    await a.patch(`/api/leads/${leadId}`).set('x-csrf-token', await getCsrf(a)).send({ stageId: qualified.id });

    const list = await a.get('/api/automations');

    const detail = await a.get(`/api/leads/${leadId}`);
    expect(detail.body.data.lead.ownerId).not.toBe(firstOwner); // round-robin moved it

    expect(list.body.data.runs[0].status).toBe('SUCCESS');
  });

  it('manual run executes a paused rule against a lead', async () => {
    const { agent: a } = await signupFresh('Auto Manual Owner', 'Auto Manual Org');
    const csrf = await getCsrf(a);

    const rule = await a.post('/api/automations').set('x-csrf-token', csrf).send({
      name: 'Paused but testable',
      trigger: 'LEAD_CREATED',
      enabled: false,
      actions: [{ type: 'ADD_TAG', tag: 'manually-ran' }],
    });
    const ruleId = rule.body.data.rule.id;

    const created = await a.post('/api/leads').set('x-csrf-token', await getCsrf(a)).send({ name: 'Manual Target', phone: '9815550606' });
    const leadId = created.body.data.lead.id;
    // paused → no automatic run
    const detail0 = await a.get(`/api/leads/${leadId}`);
    expect(detail0.body.data.lead.tags || []).not.toContain('manually-ran');

    const run = await a.post(`/api/automations/${ruleId}/run`).set('x-csrf-token', await getCsrf(a)).send({ leadId });
    expect(run.status).toBe(200);
    expect(run.body.data.executed).toBe(true);

    const detail = await a.get(`/api/leads/${leadId}`);
    expect(detail.body.data.lead.tags).toContain('manually-ran');
  });

  it('keeps rules org-isolated and manager-gated', async () => {
    const { agent: a } = await signupFresh('Auto Iso A', 'Auto Iso Org A');
    const { agent: b } = await signupFresh('Auto Iso B', 'Auto Iso Org B');

    const rule = await a.post('/api/automations').set('x-csrf-token', await getCsrf(a)).send({
      name: 'Org A rule', trigger: 'LEAD_CREATED', actions: [{ type: 'ADD_TAG', tag: 'a' }],
    });
    const ruleId = rule.body.data.rule.id;

    // org B cannot see or delete org A's rule
    const listB = await b.get('/api/automations');
    expect(listB.body.data.rules.some((r: any) => r.id === ruleId)).toBe(false);
    const delB = await b.delete(`/api/automations/${ruleId}`).set('x-csrf-token', await getCsrf(b));
    expect(delB.status).toBe(404);

    // a viewer cannot create or run rules
    const { agent: owner } = await signupFresh('Auto Rbac Owner', 'Auto Rbac Org');
    const viewerEmail = 'autoviewer@test.com';
    await owner.post('/api/team').set('x-csrf-token', await getCsrf(owner)).send({
      name: 'Auto Viewer', email: viewerEmail, role: 'VIEWER', password: 'StrongPass123',
    });
    const viewer = request.agent(server);
    await loginAs(viewer, viewerEmail, 'StrongPass123');
    const create = await viewer.post('/api/automations').set('x-csrf-token', await getCsrf(viewer)).send({
      name: 'Nope', trigger: 'LEAD_CREATED', actions: [{ type: 'ADD_TAG', tag: 'x' }],
    });
    expect(create.status).toBe(403);
  });
});

// ────────────────────────────────────────────────────────────────────────
// Phase 13 — Security hardening: CSV import validation + formula injection,
// data export, account deletion (retention-safe purge + session revocation)
// ────────────────────────────────────────────────────────────────────────

describe('Phase 13 · CSV import security', () => {
  it('rejects non-CSV extensions and binary payloads', async () => {
    const { agent: a } = await signupFresh('Csv Reject', 'Csv Reject Org');
    const csrf = await getCsrf(a);

    // Executable payload spoofed as CSV: binary NUL bytes in the head.
    const binary = Buffer.from([0x4d, 0x5a, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
    const exe = await a
      .post('/api/leads/import')
      .set('x-csrf-token', csrf)
      .field('file', binary, { filename: 'malware.csv', contentType: 'text/csv' });
    expect(exe.status).toBe(400);
    expect(exe.body.error.message).toMatch(/not a valid CSV/i);

    // Wrong extension entirely.
    const txt = await a
      .post('/api/leads/import')
      .set('x-csrf-token', csrf)
      .field('file', Buffer.from('Name,Phone\nA,1\n'), { filename: 'leads.exe', contentType: 'text/csv' });
    expect(txt.status).toBe(400);
    expect(txt.body.error.message).toMatch(/only \.csv or \.txt/i);
  });

  it('sanitises spreadsheet formula injection in free-text cells', async () => {
    const { agent: a } = await signupFresh('Csv Formula', 'Csv Formula Org');
    const csrf = await getCsrf(a);
    const csv = 'Name,Company,Notes,Phone,Email\n"=HYPERLINK(""http://evil"")","+SUM(1,1)","@SUM(1,1)",+919811223344,=cmd@x.com\n';
    const res = await a
      .post('/api/leads/import')
      .set('x-csrf-token', csrf)
      .field('file', Buffer.from(csv), { filename: 'leads.csv', contentType: 'text/csv' });
    expect(res.status).toBe(200);
    expect(res.body.data.created).toBe(1);
    expect(res.body.data.skipped).toBe(0);

    // The persisted lead must have formula prefixes neutralised — and the
    // phone must survive intact (normalised to a 10-digit Indian number).
    const list = await a.get('/api/leads');
    const lead = list.body.data.rows.find((r: any) => r.phone === '9811223344');
    expect(lead).toBeTruthy();
    expect(lead.name.startsWith("'=")).toBe(true);
    expect(lead.company.startsWith("'+")).toBe(true);
    expect(lead.notes.startsWith("'@")).toBe(true);
    expect(lead.phone).toBe('9811223344');
  });
});

describe('Phase 13 · data export & account deletion', () => {
  it('exports the full org dataset as JSON including leads and child rows', async () => {
    const { agent: a, email, password } = await signupFresh('Export Me', 'Export Org');
    await loginAs(a, email, password);
    const csrf = await getCsrf(a);
    await a.post('/api/leads').set('x-csrf-token', csrf).send({ name: 'Exportable Lead', phone: '9800000001' });

    const exportRes = await a.get('/api/account/export');
    expect(exportRes.status).toBe(200);
    expect(exportRes.headers['content-type']).toContain('application/json');
    expect(exportRes.headers['content-disposition']).toContain('primelead-export');
    const parsed = JSON.parse(exportRes.text);
    expect(parsed.data.organization.name).toBe('Export Org');
    expect(parsed.data.lead.some((l: any) => l.name === 'Exportable Lead')).toBe(true);
    expect(Array.isArray(parsed.data.quotationItem)).toBe(true);
  });

  it('requires explicit confirmation before deleting the workspace', async () => {
    const { agent: a } = await signupFresh('No Delete', 'No Delete Org');
    const csrf = await getCsrf(a);
    const denied = await a.post('/api/account/delete').set('x-csrf-token', csrf).send({ confirm: 'nope' });
    expect(denied.status).toBe(400);

    const ok2 = await a.post('/api/account/delete').set('x-csrf-token', csrf).send({ confirm: 'DELETE' });
    expect(ok2.status).toBe(200);
    expect(ok2.body.data.deleted).toBe(true);
  });

  it('purges org data and revokes sessions after deletion (login fails after)', async () => {
    const { agent: a, email, password } = await signupFresh('Purge Org', 'Purge Org Co');
    await loginAs(a, email, password);
    const csrf = await getCsrf(a);
    await a.post('/api/leads').set('x-csrf-token', csrf).send({ name: 'Doomed Lead', phone: '9800000002' });

    const del = await a.post('/api/account/delete').set('x-csrf-token', csrf).send({ confirm: 'DELETE' });
    expect(del.status).toBe(200);

    // Session cookie revoked server-side: the same agent can no longer auth.
    const me = await a.get('/api/auth/me');
    expect(me.status).toBe(401);

    // Login with the same credentials fails — the user row is gone.
    const fresh = request.agent(server);
    const c = await getCsrf(fresh);
    const relogin = await fresh.post('/api/auth/login').set('x-csrf-token', c).send({ email, password });
    expect(relogin.status).toBe(401);

    // And an org B that signs up afterwards is fully isolated (no leaked rows).
    const { agent: b } = await signupFresh('Isolated After Purge', 'Purge Neighbour');
    const list = await b.get('/api/leads');
    expect(list.body.data.rows.every((r: any) => r.name !== 'Doomed Lead')).toBe(true);
  });
});
// ────────────────────────────────────────────────────────────────────────
// Phase 14 — Security hardening tests: mass assignment, hardened headers
// (rate limiting + CORS live in security.test.ts with isolated env).
// ────────────────────────────────────────────────────────────────────────

describe('Phase 14 · mass assignment & hardening headers', () => {
  it('ignores forged tenant/identity fields in the create payload', async () => {
    const { agent: a } = await signupFresh('Mass Assign', 'Mass Co');
    const { agent: b } = await signupFresh('Other Tenant', 'Other Co');

    // The other org's id, a forged lead id, and fake identity fields —
    // none of these may influence where or how the lead is stored.
    const otherMe = await b.get('/api/auth/me');
    const otherOrgId = otherMe.body.data.org.id;

    const csrf = await getCsrf(a);
    const res = await a
      .post('/api/leads')
      .set('x-csrf-token', csrf)
      .send({
        name: 'Forged Lead',
        phone: '9811111111',
        orgId: otherOrgId,
        id: 'forged-lead-id',
        createdAt: '2001-01-01',
        deletedAt: new Date().toISOString(),
      });
    expect(res.status).toBe(201);
    expect(res.body.data.lead.id).not.toBe('forged-lead-id');

    // The lead landed in the caller's org, not the forged one.
    const mine = await a.get('/api/leads');
    expect(mine.body.data.rows.some((r: any) => r.name === 'Forged Lead')).toBe(true);

    const theirs = await b.get('/api/leads');
    expect(theirs.body.data.rows.every((r: any) => r.name !== 'Forged Lead')).toBe(true);

    // createdAt from the payload was not honoured (server timestamps rule).
    expect(res.body.data.lead.createdAt).not.toBe('2001-01-01');

    // A forged ownerId from outside the org is rejected outright (the route
    // guards assignments to the caller's team — stronger than ignoring it).
    const forgedOwner = await a
      .post('/api/leads')
      .set('x-csrf-token', csrf)
      .send({ name: 'Forged Owner Lead', phone: '9811111112', ownerId: 'forged-owner-id' });
    expect(forgedOwner.status).toBe(400);
    expect(forgedOwner.body.error.message).toMatch(/not part of your team/i);
  });

  it('sends hardening headers and standard error bodies on app responses', async () => {
    const res = await request(server).get('/api/auth/me');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBeTruthy();
    expect(res.headers['referrer-policy']).toBeTruthy();

    // Unknown route → JSON error contract, not HTML.
    const nf = await request(server).get('/api/not-a-real-route');
    expect(nf.status).toBe(404);
    expect(nf.body.error.requestId).toBeTruthy();
    expect(nf.body.error.code).toBeTruthy();
  });
});
