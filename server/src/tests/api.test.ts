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
