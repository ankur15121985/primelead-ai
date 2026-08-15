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
      { slug: 'starter', name: 'Starter', priceMonthly: 0, priceYearly: 0 },
      { slug: 'growth', name: 'Growth', priceMonthly: 1499, priceYearly: 14990 },
      { slug: 'business', name: 'Business', priceMonthly: 3999, priceYearly: 39990 },
    ],
  });
});

afterAll(async () => {
  const { prisma } = await import('../lib/prisma');
  await prisma.$disconnect();
});

/** Prime the CSRF cookie (GET = page load) and return the token. */
async function getCsrf(a: ReturnType<typeof request.agent> = agent): Promise<string> {
  const res = await a.get('/api/auth/me').catch(() => null);
  const cookies = (res?.headers['set-cookie'] as unknown as string[]) || [];
  const csrf = cookies.find((c) => c.startsWith('lf_csrf='));
  if (csrf) return csrf.split(';')[0].replace('lf_csrf=', '');
  const me = await a.get('/api/auth/me');
  const c2 = (me.headers['set-cookie'] as unknown as string[]) || [];
  const second = c2.find((c) => c.startsWith('lf_csrf='));
  return second ? second.split(';')[0].replace('lf_csrf=', '') : '';
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
    expect((res.headers['set-cookie'] as unknown as string[]).some((c) => c.includes('lf_session'))).toBe(true);
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
