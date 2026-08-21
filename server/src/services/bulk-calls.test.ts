import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

const TEST_DB = path.join(__dirname, '..', '..', 'prisma', 'test-bulk-calls.db');

let prisma: any;
let bulkCallsMod: typeof import('./bulk-calls');
let videoCallMod: typeof import('./video-call');
let smsProviderMod: typeof import('./sms-provider');

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

  bulkCallsMod = await import('./bulk-calls');
  videoCallMod = await import('./video-call');
  smsProviderMod = await import('./sms-provider');

  await prisma.$queryRawUnsafe('SELECT 1');

  // Seed org + user
  await prisma.organization.upsert({
    where: { id: 'test-bulk-org' },
    create: { id: 'test-bulk-org', name: 'Bulk Test Org', slug: 'test-bulk-org' },
    update: {},
  });
  await prisma.user.upsert({
    where: { id: 'test-user-1' },
    create: { id: 'test-user-1', orgId: 'test-bulk-org', email: 'test@test.com', name: 'Test User', passwordHash: 'x', role: 'OWNER' },
    update: {},
  });
});

afterAll(async () => {
  await prisma?.$disconnect();
  for (const f of [TEST_DB, `${TEST_DB}-journal`, `${TEST_DB}-wal`, `${TEST_DB}-shm`]) {
    if (fs.existsSync(f)) fs.rmSync(f, { force: true });
  }
});

describe('Bulk Calls', () => {
  let leadIds: string[] = [];

  it('creates leads to call', async () => {
    for (const name of ['Alice', 'Bob', 'Charlie']) {
      const lead = await prisma.lead.create({
        data: {
          orgId: 'test-bulk-org',
          name,
          phone: `+9198765${name.charCodeAt(0)}000`,
          source: 'MANUAL',
        },
      });
      leadIds.push(lead.id);
    }
    expect(leadIds.length).toBe(3);
  });

  it('initiates bulk calls to multiple leads', async () => {
    const result = await bulkCallsMod.initiateBulkCalls({
      orgId: 'test-bulk-org',
      userId: 'test-user-1',
      leadIds,
    });

    expect(result.totalRequested).toBe(3);
    expect(result.initiated).toBe(3);
    expect(result.failed).toBe(0);
    expect(result.batchId).toBeTruthy();
    expect(result.calls.length).toBe(3);
    for (const c of result.calls) {
      expect(c.status).toBe('INITIATED');
      expect(c.callId).toBeTruthy();
    }
  });

  it('gets dialer queue', async () => {
    // Create leads that haven't been contacted yet (dialer queue filters by lastContactedAt)
    const freshLeads = [];
    for (const name of ['Zara', 'Yusuf']) {
      const lead = await prisma.lead.create({
        data: { orgId: 'test-bulk-org', name, phone: `+9198765${name.charCodeAt(0)}000`, source: 'MANUAL' },
      });
      freshLeads.push(lead);
    }

    const queue = await bulkCallsMod.getDialerQueue('test-bulk-org');
    // Should include the fresh leads (never contacted)
    const freshIds = new Set(freshLeads.map(l => l.id));
    const queueIds = new Set(queue.map((l: any) => l.id));
    const hasFresh = [...freshIds].some(id => queueIds.has(id));
    expect(hasFresh).toBe(true);
    for (const lead of queue) {
      expect(lead.phone).toBeTruthy();
    }
  });

  it('rejects empty lead list', async () => {
    await expect(
      bulkCallsMod.initiateBulkCalls({ orgId: 'test-bulk-org', userId: 'test-user-1', leadIds: [] })
    ).rejects.toThrow(/at least one/i);
  });

  it('rejects more than 50 leads', async () => {
    const manyIds = Array.from({ length: 51 }, (_, i) => `lead-${i}`);
    await expect(
      bulkCallsMod.initiateBulkCalls({ orgId: 'test-bulk-org', userId: 'test-user-1', leadIds: manyIds })
    ).rejects.toThrow(/maximum 50/i);
  });
});

describe('Video Call Rooms', () => {
  let roomId: string;

  it('creates a video room', async () => {
    const room = await videoCallMod.createRoom({
      orgId: 'test-bulk-org',
      userId: 'test-user-1',
      title: 'Team Standup',
      maxParticipants: 5,
      recordingEnabled: true,
    });

    expect(room.roomId).toBeTruthy();
    expect(room.title).toBe('Team Standup');
    expect(room.status).toBe('WAITING');
    expect(room.participantCount).toBe(1); // host auto-joined
    expect(room.maxParticipants).toBe(5);
    roomId = room.roomId;
  });

  it('gets room details with participants', async () => {
    const room = await videoCallMod.getRoom(roomId, 'test-bulk-org');
    expect(room.roomId).toBe(roomId);
    expect(room.participants).toHaveLength(1);
    expect(room.participants[0].role).toBe('HOST');
  });

  it('joins a room', async () => {
    const result = await videoCallMod.joinRoom(roomId, 'test-bulk-org', 'user-2');
    expect(result.participantId).toBeTruthy();

    // Room should now be ACTIVE
    const room = await videoCallMod.getRoom(roomId, 'test-bulk-org');
    expect(room.status).toBe('ACTIVE');
    expect(room.participants.length).toBe(2);
  });

  it('prevents duplicate join', async () => {
    const result = await videoCallMod.joinRoom(roomId, 'test-bulk-org', 'user-2');
    expect(result.alreadyInRoom).toBe(true);
  });

  it('stores and retrieves signaling data', async () => {
    const storeResult = await videoCallMod.storeSdp(roomId, 'test-bulk-org', 'test-user-1', 'v=0...', 'offer');
    expect(storeResult.stored).toBe(true);

    const signaling = await videoCallMod.getSignalingData(roomId, 'test-bulk-org', 'test-user-1');
    expect(signaling.length).toBe(1);
    expect(signaling[0].userId).toBe('user-2');
  });

  it('leaves a room', async () => {
    const result = await videoCallMod.leaveRoom(roomId, 'test-bulk-org', 'user-2');
    expect(result.left).toBe(true);
    expect(result.participantsRemaining).toBe(1);
  });

  it('ends room as host', async () => {
    const result = await videoCallMod.endRoom(roomId, 'test-bulk-org', 'test-user-1');
    expect(result.ended).toBe(true);

    const room = await videoCallMod.getRoom(roomId, 'test-bulk-org');
    expect(room.status).toBe('ENDED');
  });

  it('lists rooms', async () => {
    const rooms = await videoCallMod.listRooms('test-bulk-org');
    expect(rooms.length).toBeGreaterThan(0);
  });
});

describe('SMS Provider', () => {
  it('resolves demo provider by default', async () => {
    const status = await smsProviderMod.getProviderStatus('test-bulk-org');
    expect(status.provider).toBe('demo');
    expect(status.configured).toBe(false);
  });

  it('sends SMS via demo provider', async () => {
    const result = await smsProviderMod.sendSms({
      orgId: 'test-bulk-org',
      userId: 'test-user-1',
      to: '+919876543210',
      body: 'Hello from test!',
    });

    expect(result.result.success).toBe(true);
    expect(result.result.messageId).toBeTruthy();
    expect(result.logId).toBeTruthy();
  });
});
