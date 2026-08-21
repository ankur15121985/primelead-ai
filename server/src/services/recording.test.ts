import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

const TEST_DB = path.join(__dirname, '..', '..', 'prisma', 'test-recording.db');

let prisma: any;
let recordingMod: typeof import('./recording');
let meetingNotesMod: typeof import('./meeting-notes');

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

  recordingMod = await import('./recording');
  meetingNotesMod = await import('./meeting-notes');

  await prisma.$queryRawUnsafe('SELECT 1');

  // Seed org
  await prisma.organization.upsert({
    where: { id: 'test-rec-org' },
    create: { id: 'test-rec-org', name: 'Recording Test Org', slug: 'test-rec-org' },
    update: {},
  });
});

afterAll(async () => {
  await prisma?.$disconnect();
  for (const f of [TEST_DB, `${TEST_DB}-journal`, `${TEST_DB}-wal`, `${TEST_DB}-shm`]) {
    if (fs.existsSync(f)) fs.rmSync(f, { force: true });
  }
});

describe('Recording Service', () => {
  let callId: string;
  let recordingId: string;

  it('creates a call to attach recordings to', async () => {
    const call = await prisma.call.create({
      data: {
        orgId: 'test-rec-org',
        status: 'CONNECTED',
        direction: 'OUTBOUND',
        toNumber: '+919876543210',
        durationSeconds: 300,
        startedAt: new Date(),
        endedAt: new Date(),
      },
    });
    callId = call.id;
  });

  it('starts a recording', async () => {
    const rec = await recordingMod.startRecording({
      orgId: 'test-rec-org',
      callId,
      type: 'AUDIO',
      consentGiven: true,
    });

    expect(rec.id).toBeTruthy();
    expect(rec.status).toBe('RECORDING');
    expect(rec.type).toBe('AUDIO');
    expect(rec.consentGiven).toBe(true);
    recordingId = rec.id;
  });

  it('completes a recording with file details', async () => {
    const rec = await recordingMod.completeRecording({
      orgId: 'test-rec-org',
      recordingId,
      fileUrl: 'https://storage.example.com/recording-001.wav',
      fileName: 'call-001.wav',
      fileSizeBytes: 1024000,
      durationSeconds: 300,
      mimeType: 'audio/wav',
    });

    expect(rec.status).toBe('TRANSCRIBING');
    expect(rec.fileUrl).toBe('https://storage.example.com/recording-001.wav');
    expect(rec.durationSeconds).toBe(300);
  });

  it('saves transcript', async () => {
    const rec = await recordingMod.saveTranscript({
      orgId: 'test-rec-org',
      recordingId,
      transcript: 'Speaker 1: Hello, how are you?\nSpeaker 2: I am good, thanks.',
      summary: 'Brief greeting call',
      sentiment: 'POSITIVE',
      actionItems: ['Follow up next week'],
      keyTopics: ['Greeting', 'Follow-up'],
      speakers: [
        { name: 'Speaker 1', speakingTime: 30 },
        { name: 'Speaker 2', speakingTime: 45 },
      ],
    });

    expect(rec.status).toBe('TRANSCRIBED');
    expect(rec.transcript).toBeTruthy();
    expect(rec.summary).toBe('Brief greeting call');
  });

  it('gets recording by id', async () => {
    const rec = await recordingMod.getRecording(recordingId, 'test-rec-org');
    expect(rec.id).toBe(recordingId);
  });

  it('lists recordings', async () => {
    const result = await recordingMod.listRecordings('test-rec-org');
    expect(result.recordings.length).toBeGreaterThan(0);
    expect(result.total).toBeGreaterThan(0);
  });

  it('gets recording stats', async () => {
    const stats = await recordingMod.getRecordingStats('test-rec-org');
    expect(stats.total).toBeGreaterThan(0);
    expect(stats.totalDurationSeconds).toBeGreaterThan(0);
  });

  it('throws when recording call not found', async () => {
    await expect(
      recordingMod.startRecording({ orgId: 'test-rec-org', callId: 'nonexistent' })
    ).rejects.toThrow(/not found/i);
  });
});

describe('Meeting Notes Service', () => {
  let meetingId: string;
  let notesId: string;

  it('creates a meeting', async () => {
    const meeting = await prisma.meeting.create({
      data: {
        orgId: 'test-rec-org',
        title: 'Product Demo',
        startAt: new Date(),
        endAt: new Date(Date.now() + 3600000),
        durationMinutes: 60,
        status: 'COMPLETED',
      },
    });
    meetingId = meeting.id;
  });

  it('generates meeting notes from transcript', async () => {
    const notes = await meetingNotesMod.generateMeetingNotes({
      orgId: 'test-rec-org',
      meetingId,
      transcript: [
        'Host: Welcome everyone to the product demo.',
        'Attendee: Thanks for having us.',
        'Host: Let me show you the new features.',
        'Attendee: This looks great, we should schedule a follow-up.',
        'Host: I will send you the proposal by next week.',
      ].join('\n'),
    });

    expect(notes.id).toBeTruthy();
    expect(notes.notes).toContain('#');
    expect(notes.summary).toBeTruthy();
    expect(notes.sentiment).toBeTruthy();
    notesId = notes.id;
  });

  it('returns existing notes on second call', async () => {
    const notes = await meetingNotesMod.generateMeetingNotes({
      orgId: 'test-rec-org',
      meetingId,
    });

    expect(notes.id).toBe(notesId);
  });

  it('forces regeneration when requested', async () => {
    const notes = await meetingNotesMod.generateMeetingNotes({
      orgId: 'test-rec-org',
      meetingId,
      force: true,
      transcript: 'New transcript: everything went well.',
    });

    expect(notes.id).not.toBe(notesId);
    notesId = notes.id;
  });

  it('updates notes manually', async () => {
    const updated = await meetingNotesMod.updateMeetingNotes(notesId, 'test-rec-org', {
      title: 'Updated Title',
      notes: 'Manually edited notes content',
    });

    expect(updated.title).toBe('Updated Title');
    expect(updated.notes).toBe('Manually edited notes content');
    expect(updated.source).toBe('EDITED');
  });

  it('lists meeting notes', async () => {
    const result = await meetingNotesMod.listMeetingNotes('test-rec-org');
    expect(result.notes.length).toBeGreaterThan(0);
  });

  it('gets notes by id', async () => {
    const notes = await meetingNotesMod.getMeetingNotes(notesId, 'test-rec-org');
    expect(notes.id).toBe(notesId);
  });

  it('deletes notes', async () => {
    const result = await meetingNotesMod.deleteMeetingNotes(notesId, 'test-rec-org');
    expect(result.deleted).toBe(true);
  });
});
