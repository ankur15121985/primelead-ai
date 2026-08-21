import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

const TEST_DB = path.join(__dirname, '..', '..', 'prisma', 'test-sms.db');

let prisma: any;
let processInboundSms: typeof import('./sms-leads').processInboundSms;
let listInboundSms: typeof import('./sms-leads').listInboundSms;
let getSmsStats: typeof import('./sms-leads').getSmsStats;
let getCallReadyLeads: typeof import('./sms-leads').getCallReadyLeads;

function resetDb() {
  for (const f of [TEST_DB, `${TEST_DB}-journal`, `${TEST_DB}-wal`, `${TEST_DB}-shm`]) {
    if (fs.existsSync(f)) fs.rmSync(f, { force: true });
  }
  process.env.DATABASE_URL = `file:${TEST_DB.replace(/\\\\/g, '/')}`;
  execSync('npx prisma db push --skip-generate --accept-data-loss', {
    cwd: path.join(__dirname, '..', '..'),
    stdio: 'pipe',
  });
}

beforeAll(async () => {
  resetDb();
  const prismaMod = await import('../lib/prisma');
  prisma = prismaMod.prisma;

  const mod = await import('./sms-leads');
  processInboundSms = mod.processInboundSms;
  listInboundSms = mod.listInboundSms;
  getSmsStats = mod.getSmsStats;
  getCallReadyLeads = mod.getCallReadyLeads;

  await prisma.$queryRawUnsafe('SELECT 1');

  // Seed org
  await prisma.organization.upsert({
    where: { id: 'test-sms-org' },
    create: { id: 'test-sms-org', name: 'SMS Test Org', slug: 'test-sms-org' },
    update: {},
  });
});

afterAll(async () => {
  await prisma?.$disconnect();
  for (const f of [TEST_DB, `${TEST_DB}-journal`, `${TEST_DB}-wal`, `${TEST_DB}-shm`]) {
    if (fs.existsSync(f)) fs.rmSync(f, { force: true });
  }
});

describe('processInboundSms', () => {
  it('creates a new lead from inbound SMS', async () => {
    const result = await processInboundSms({
      orgId: 'test-sms-org',
      from: '+919876543210',
      body: 'Hi, I am Ravi and I am interested in your product',
    });

    expect(result.status).toBe('LEAD_CREATED');
    expect(result.leadCreated).toBe(true);
    expect(result.leadId).toBeTruthy();
    expect(result.smsId).toBeTruthy();
  });

  it('links to existing lead with same phone number', async () => {
    const result = await processInboundSms({
      orgId: 'test-sms-org',
      from: '+919876543210',
      body: 'This is a follow-up message',
    });

    // Should be a duplicate since same number within 24h
    expect(result.status).toBe('DUPLICATE');
  });

  it('creates a lead from a different number', async () => {
    const result = await processInboundSms({
      orgId: 'test-sms-org',
      from: '+919876543211',
      body: 'Hello, I want to buy something',
    });

    expect(result.status).toBe('LEAD_CREATED');
    expect(result.leadCreated).toBe(true);
  });

  it('handles opt-out messages', async () => {
    const result = await processInboundSms({
      orgId: 'test-sms-org',
      from: '+919876543299',
      body: 'STOP',
    });

    expect(result.status).toBe('OPTED_OUT');
  });

  it('handles unsubscribe keyword', async () => {
    const result = await processInboundSms({
      orgId: 'test-sms-org',
      from: '+919876543298',
      body: 'unsubscribe me',
    });

    expect(result.status).toBe('OPTED_OUT');
  });

  it('rejects invalid phone numbers', async () => {
    const result = await processInboundSms({
      orgId: 'test-sms-org',
      from: '12',
      body: 'Hello',
    });

    expect(result.status).toBe('IGNORED');
  });

  it('extracts name from SMS body when possible', async () => {
    const result = await processInboundSms({
      orgId: 'test-sms-org',
      from: '+919876543297',
      body: "Hi, I'm Priya Sharma and I need help",
    });

    expect(result.status).toBe('LEAD_CREATED');
    // Check the lead was created with a reasonable name
    if (result.leadId) {
      const lead = await prisma.lead.findFirst({ where: { id: result.leadId } });
      expect(lead).toBeTruthy();
      expect(lead.name).toContain('Priya');
    }
  });
});

describe('getCallReadyLeads', () => {
  it('returns leads with phone numbers', async () => {
    const leads = await getCallReadyLeads('test-sms-org');
    expect(leads.length).toBeGreaterThan(0);
    for (const lead of leads) {
      expect(lead.phone).toBeTruthy();
    }
  });
});

describe('getSmsStats', () => {
  it('returns SMS statistics', async () => {
    const stats = await getSmsStats('test-sms-org');
    expect(stats.total).toBeGreaterThan(0);
    expect(stats.today).toBeGreaterThanOrEqual(0);
    expect(stats.byStatus).toBeTruthy();
  });
});
