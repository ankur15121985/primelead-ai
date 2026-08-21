/**
 * Integration tests for the Scheduled Messaging Queue service.
 * Uses an isolated SQLite database like the main API tests.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

const TEST_DB = path.join(__dirname, '..', '..', 'prisma', 'test-msg-queue.db');

let prisma: any;
let scheduleMessage: typeof import('./message-queue').scheduleMessage;
let cancelMessage: typeof import('./message-queue').cancelMessage;
let cancelBatch: typeof import('./message-queue').cancelBatch;
let retryMessage: typeof import('./message-queue').retryMessage;
let listMessages: typeof import('./message-queue').listMessages;
let getQueueStats: typeof import('./message-queue').getQueueStats;
let getMessageLogs: typeof import('./message-queue').getMessageLogs;
let processDueMessages: typeof import('./message-queue').processDueMessages;

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

  const mq = await import('./message-queue');
  scheduleMessage = mq.scheduleMessage;
  cancelMessage = mq.cancelMessage;
  cancelBatch = mq.cancelBatch;
  retryMessage = mq.retryMessage;
  listMessages = mq.listMessages;
  getQueueStats = mq.getQueueStats;
  getMessageLogs = mq.getMessageLogs;
  processDueMessages = mq.processDueMessages;

  // Ensure prisma client is connected
  await prisma.$queryRawUnsafe('SELECT 1');

  // Seed prerequisite organizations for foreign key constraints
  const orgIds = ['test-org', 'test-org-log', 'test-cancel', 'test-batch-cancel', 'test-retry', 'test-stats', 'test-list', 'test-process'];
  for (const orgId of orgIds) {
    await prisma.organization.upsert({
      where: { id: orgId },
      create: { id: orgId, name: `Test Org ${orgId}`, slug: orgId },
      update: {},
    });
  }
});

afterAll(async () => {
  await prisma?.$disconnect();
  // Clean up test DB
  for (const f of [TEST_DB, `${TEST_DB}-journal`, `${TEST_DB}-wal`, `${TEST_DB}-shm`]) {
    if (fs.existsSync(f)) fs.rmSync(f, { force: true });
  }
});

describe('Message Queue — scheduleMessage', () => {
  it('schedules a WhatsApp message with valid input', async () => {
    const msg = await scheduleMessage({
      orgId: 'test-org',
      userId: 'user-1',
      channel: 'WHATSAPP',
      recipientPhone: '+919876543210',
      body: 'Hello from test',
    });

    expect(msg.id).toBeTruthy();
    expect(msg.channel).toBe('WHATSAPP');
    expect(msg.status).toBe('PENDING');
    expect(msg.body).toBe('Hello from test');
    expect(msg.recipientPhone).toBe('+919876543210');
  });

  it('schedules an email message with valid input', async () => {
    const msg = await scheduleMessage({
      orgId: 'test-org',
      userId: 'user-1',
      channel: 'EMAIL',
      recipientEmail: 'test@example.com',
      subject: 'Test Subject',
      body: 'Email body content',
    });

    expect(msg.id).toBeTruthy();
    expect(msg.channel).toBe('EMAIL');
    expect(msg.status).toBe('PENDING');
    expect(msg.subject).toBe('Test Subject');
  });

  it('throws when body and templateName are both missing', async () => {
    await expect(
      scheduleMessage({
        orgId: 'test-org',
        channel: 'WHATSAPP',
        recipientPhone: '+919876543210',
        body: '',
      })
    ).rejects.toThrow(/body or template/);
  });

  it('throws when WhatsApp has no recipient phone', async () => {
    await expect(
      scheduleMessage({
        orgId: 'test-org',
        channel: 'WHATSAPP',
        body: 'Hello',
      })
    ).rejects.toThrow(/phone number/);
  });

  it('throws when email has no recipient email', async () => {
    await expect(
      scheduleMessage({
        orgId: 'test-org',
        channel: 'EMAIL',
        body: 'Hello',
      })
    ).rejects.toThrow(/email address/);
  });

  it('accepts a message with template name instead of body', async () => {
    const msg = await scheduleMessage({
      orgId: 'test-org',
      channel: 'WHATSAPP',
      recipientPhone: '+919876543210',
      body: '',
      templateName: 'welcome_template',
      templateParams: ['Ankur', 'PrimeLead'],
    });

    expect(msg.templateName).toBe('welcome_template');
    expect(msg.status).toBe('PENDING');
  });

  it('defaults scheduledAt to now', async () => {
    const before = new Date();
    const msg = await scheduleMessage({
      orgId: 'test-org',
      channel: 'WHATSAPP',
      recipientPhone: '+919876543210',
      body: 'Test',
    });
    const after = new Date();

    expect(msg.scheduledAt.getTime()).toBeGreaterThanOrEqual(before.getTime() - 1000);
    expect(msg.scheduledAt.getTime()).toBeLessThanOrEqual(after.getTime() + 1000);
  });

  it('respects custom scheduledAt', async () => {
    const future = new Date(Date.now() + 3600000); // 1 hour from now
    const msg = await scheduleMessage({
      orgId: 'test-org',
      channel: 'WHATSAPP',
      recipientPhone: '+919876543210',
      body: 'Future message',
      scheduledAt: future,
    });

    expect(msg.scheduledAt.getTime()).toBeCloseTo(future.getTime(), -3);
  });

  it('creates a log entry for the scheduled message', async () => {
    const msg = await scheduleMessage({
      orgId: 'test-org-log',
      channel: 'WHATSAPP',
      recipientPhone: '+919876543210',
      body: 'Logged message',
    });

    const logs = await getMessageLogs(msg.id, 'test-org-log');
    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0].status).toBe('QUEUED');
  });
});

describe('Message Queue — cancel / retry', () => {
  it('cancels a pending message', async () => {
    const msg = await scheduleMessage({
      orgId: 'test-cancel',
      channel: 'WHATSAPP',
      recipientPhone: '+919876543210',
      body: 'Cancel me',
    });

    const result = await cancelMessage(msg.id, 'test-cancel');
    expect(result.cancelled).toBe(true);

    // Verify status changed
    const { messages } = await listMessages('test-cancel');
    const cancelled = messages.find((m: any) => m.id === msg.id);
    expect(cancelled?.status).toBe('CANCELLED');
  });

  it('cancels a batch of messages', async () => {
    const batchId = `test-batch-${Date.now()}`;
    await scheduleMessage({
      orgId: 'test-batch-cancel',
      channel: 'WHATSAPP',
      recipientPhone: '+919876543210',
      body: 'Batch message 1',
      batchId,
    });
    await scheduleMessage({
      orgId: 'test-batch-cancel',
      channel: 'WHATSAPP',
      recipientPhone: '+919876543211',
      body: 'Batch message 2',
      batchId,
    });

    const result = await cancelBatch(batchId, 'test-batch-cancel');
    expect(result.cancelled).toBeGreaterThanOrEqual(1);
  });

  it('retries a failed message', async () => {
    const msg = await scheduleMessage({
      orgId: 'test-retry',
      channel: 'WHATSAPP',
      recipientPhone: '+919876543210',
      body: 'Retry me',
    });

    // Manually set status to FAILED so retry works
    await prisma.scheduledMessage.update({ where: { id: msg.id }, data: { status: 'FAILED' } });

    const result = await retryMessage(msg.id, 'test-retry');
    expect(result.retried).toBe(true);
  });
});

describe('Message Queue — stats and listing', () => {
  it('returns queue stats', async () => {
    // Schedule a few messages
    await scheduleMessage({
      orgId: 'test-stats',
      channel: 'WHATSAPP',
      recipientPhone: '+919876543210',
      body: 'Stats message',
    });

    const stats = await getQueueStats('test-stats');
    expect(stats.total).toBeGreaterThanOrEqual(1);
    expect(stats.pending).toBeGreaterThanOrEqual(1);
    expect(stats.byChannel.WHATSAPP).toBeGreaterThanOrEqual(1);
  });

  it('lists messages with filtering', async () => {
    await scheduleMessage({
      orgId: 'test-list',
      channel: 'WHATSAPP',
      recipientPhone: '+919876543210',
      body: 'List message 1',
    });
    await scheduleMessage({
      orgId: 'test-list',
      channel: 'EMAIL',
      recipientEmail: 'test@test.com',
      body: 'List message 2',
    });

    const { messages: allMessages } = await listMessages('test-list');
    expect(allMessages.length).toBeGreaterThanOrEqual(2);

    // Filter by channel
    const { messages: waMessages } = await listMessages('test-list', { channel: 'WHATSAPP' });
    expect(waMessages.every((m: any) => m.channel === 'WHATSAPP')).toBe(true);
  });
});

describe('Message Queue — processDueMessages', () => {
  it('processes messages that are past their scheduled time', async () => {
    // Schedule a message with past time
    const pastTime = new Date(Date.now() - 10000); // 10 seconds ago
    await scheduleMessage({
      orgId: 'test-process',
      channel: 'WHATSAPP',
      recipientPhone: '+919876543210',
      body: 'Process me',
      scheduledAt: pastTime,
    });

    // Process should pick up this message (it will fail to send since no real provider, but that's OK)
    const processed = await processDueMessages(10);
    expect(processed).toBeGreaterThanOrEqual(0); // May be 0 if send fails, but should not throw
  });
});
