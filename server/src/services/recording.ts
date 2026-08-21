/**
 * Recording Service — manages call and video meeting recordings.
 *
 * Supports:
 *   - Start/stop recording (creates Recording record)
 *   - Upload recording file metadata (fileUrl, duration, etc.)
 *   - Transcription status tracking
 *   - Linking recordings to calls and meetings
 *   - Auto-generation of AI summary after transcription
 */
import { prisma } from '../lib/prisma';
import { badRequest, notFound } from '../lib/http';

// ── Types ─────────────────────────────────────────────────

export interface StartRecordingInput {
  orgId: string;
  userId?: string;
  leadId?: string;
  /** Set exactly one of these */
  callId?: string;
  meetingId?: string;
  type?: 'AUDIO' | 'VIDEO' | 'SCREEN_SHARE';
  consentGiven?: boolean;
}

export interface CompleteRecordingInput {
  orgId: string;
  recordingId: string;
  fileUrl: string;
  fileName?: string;
  fileSizeBytes?: number;
  durationSeconds: number;
  mimeType?: string;
}

export interface TranscriptInput {
  orgId: string;
  recordingId: string;
  transcript: string;
  summary?: string;
  sentiment?: string;
  actionItems?: string[];
  keyTopics?: string[];
  speakers?: Array<{ name: string; speakingTime: number; sentiment?: string }>;
}

// ── Core CRUD ─────────────────────────────────────────────

/**
 * Start a new recording for a call or meeting.
 */
export async function startRecording(input: StartRecordingInput) {
  // Validate references
  if (!input.callId && !input.meetingId) {
    throw badRequest('Provide a callId or meetingId to attach the recording to.');
  }

  if (input.callId) {
    const call = await prisma.call.findFirst({ where: { id: input.callId, orgId: input.orgId } });
    if (!call) throw notFound('Call not found');
  }
  if (input.meetingId) {
    const meeting = await prisma.meeting.findFirst({ where: { id: input.meetingId, orgId: input.orgId } });
    if (!meeting) throw notFound('Meeting not found');
  }

  const recording = await prisma.recording.create({
    data: {
      orgId: input.orgId,
      callId: input.callId || null,
      meetingId: input.meetingId || null,
      leadId: input.leadId || null,
      userId: input.userId || null,
      type: input.type || 'AUDIO',
      status: 'RECORDING',
      consentGiven: input.consentGiven ?? false,
      startedAt: new Date(),
    },
  });

  return recording;
}

/**
 * Complete a recording with file details.
 */
export async function completeRecording(input: CompleteRecordingInput) {
  const existing = await prisma.recording.findFirst({
    where: { id: input.recordingId, orgId: input.orgId },
  });
  if (!existing) throw notFound('Recording not found');

  const recording = await prisma.recording.update({
    where: { id: input.recordingId },
    data: {
      status: 'TRANSCRIBING',
      fileUrl: input.fileUrl,
      fileName: input.fileName || null,
      fileSizeBytes: input.fileSizeBytes || 0,
      durationSeconds: input.durationSeconds,
      mimeType: input.mimeType || null,
      endedAt: new Date(),
    },
  });

  return recording;
}

/**
 * Save transcription results for a recording.
 */
export async function saveTranscript(input: TranscriptInput) {
  const existing = await prisma.recording.findFirst({
    where: { id: input.recordingId, orgId: input.orgId },
  });
  if (!existing) throw notFound('Recording not found');

  const recording = await prisma.recording.update({
    where: { id: input.recordingId },
    data: {
      status: 'TRANSCRIBED',
      transcript: input.transcript,
      summary: input.summary || null,
      sentiment: input.sentiment || null,
      actionItems: input.actionItems ? (input.actionItems as any) : undefined,
      keyTopics: input.keyTopics ? (input.keyTopics as any) : undefined,
      speakers: input.speakers ? (input.speakers as any) : undefined,
    },
  });

  return recording;
}

/**
 * Get a recording by ID.
 */
export async function getRecording(id: string, orgId: string) {
  const recording = await prisma.recording.findFirst({ where: { id, orgId } });
  if (!recording) throw notFound('Recording not found');
  return recording;
}

/**
 * List recordings with filters.
 */
export async function listRecordings(orgId: string, opts?: {
  callId?: string;
  meetingId?: string;
  userId?: string;
  type?: string;
  status?: string;
  days?: number;
  page?: number;
  limit?: number;
}) {
  const where: Record<string, unknown> = { orgId };
  if (opts?.callId) where.callId = opts.callId;
  if (opts?.meetingId) where.meetingId = opts.meetingId;
  if (opts?.userId) where.userId = opts.userId;
  if (opts?.type) where.type = opts.type;
  if (opts?.status) where.status = opts.status;
  if (opts?.days) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - opts.days);
    where.createdAt = { gte: cutoff };
  }

  const page = opts?.page || 1;
  const limit = Math.min(opts?.limit || 50, 200);

  const [recordings, total] = await Promise.all([
    prisma.recording.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.recording.count({ where }),
  ]);

  return { recordings, total, page, limit, pages: Math.ceil(total / limit) };
}

/**
 * Delete a recording.
 */
export async function deleteRecording(id: string, orgId: string) {
  const existing = await prisma.recording.findFirst({ where: { id, orgId } });
  if (!existing) throw notFound('Recording not found');
  await prisma.recording.delete({ where: { id } });
  return { deleted: true };
}

/**
 * Get recording statistics for an org.
 */
export async function getRecordingStats(orgId: string) {
  const [total, byType, byStatus, totalDuration] = await Promise.all([
    prisma.recording.count({ where: { orgId } }),
    prisma.recording.groupBy({ by: ['type'], where: { orgId }, _count: true }),
    prisma.recording.groupBy({ by: ['status'], where: { orgId }, _count: true }),
    prisma.recording.aggregate({ where: { orgId }, _sum: { durationSeconds: true } }),
  ]);

  return {
    total,
    totalDurationSeconds: totalDuration._sum.durationSeconds || 0,
    byType: Object.fromEntries(byType.map(t => [t.type, t._count])),
    byStatus: Object.fromEntries(byStatus.map(s => [s.status, s._count])),
  };
}
