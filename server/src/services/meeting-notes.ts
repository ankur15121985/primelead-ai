/**
 * Meeting Notes Service — AI-generated meeting notes for call records
 * and video meetings.
 *
 * Flow:
 *   1. Recording is transcribed (via recording service)
 *   2. This service generates structured meeting notes from the transcript
 *   3. Notes include: summary, key decisions, action items, follow-ups, sentiment
 *   4. Notes can be manually edited and re-generated
 *
 * In production, this calls an LLM API (OpenAI/Anthropic).
 * In demo mode, it generates structured notes from the transcript text.
 */
import { prisma } from '../lib/prisma';
import { badRequest, notFound } from '../lib/http';

// ── Types ─────────────────────────────────────────────────

export interface GenerateNotesInput {
  orgId: string;
  userId?: string;
  leadId?: string;
  /** Set exactly one of these */
  callId?: string;
  meetingId?: string;
  recordingId?: string;
  /** Pre-existing transcript to generate notes from */
  transcript?: string;
  /** Force re-generation even if notes exist */
  force?: boolean;
}

export interface MeetingNotesData {
  id: string;
  title: string | null;
  notes: string;
  summary: string | null;
  keyDecisions: string[];
  actionItems: Array<{ assignee: string; task: string; dueDate?: string }>;
  followUpItems: string[];
  sentiment: string | null;
  attendees: string[];
  durationMinutes: number | null;
}

// ── Core Operations ───────────────────────────────────────

/**
 * Generate AI meeting notes from a recording transcript or meeting data.
 */
export async function generateMeetingNotes(input: GenerateNotesInput): Promise<MeetingNotesData> {
  if (!input.callId && !input.meetingId && !input.recordingId) {
    throw badRequest('Provide a callId, meetingId, or recordingId.');
  }

  // Check for existing notes (unless force)
  if (!input.force) {
    const existing = await findExistingNotes(input);
    if (existing) return existing;
  }

  // Gather context
  let transcript = input.transcript || '';
  let durationMinutes = 0;
  let participants: string[] = [];
  let meetingTitle = '';
  let leadName = '';

  if (input.recordingId) {
    const recording = await prisma.recording.findFirst({
      where: { id: input.recordingId, orgId: input.orgId },
    });
    if (!recording) throw notFound('Recording not found');
    transcript = transcript || recording.transcript || '';
    durationMinutes = Math.round((recording.durationSeconds || 0) / 60);
    if (!input.callId && recording.callId) input.callId = recording.callId;
    if (!input.meetingId && recording.meetingId) input.meetingId = recording.meetingId;
  }

  if (input.callId) {
    const call = await prisma.call.findFirst({
      where: { id: input.callId, orgId: input.orgId },
    });
    if (!call) throw notFound('Call not found');
    transcript = transcript || call.transcript || '';
    durationMinutes = durationMinutes || Math.round((call.durationSeconds || 0) / 60);
    if (call.fromNumber) participants.push(call.fromNumber);
    if (call.toNumber) participants.push(call.toNumber);
    meetingTitle = `Call with ${call.toNumber || 'Unknown'}`;
    if (call.leadId) {
      const lead = await prisma.lead.findFirst({ where: { id: call.leadId } });
      if (lead) { leadName = lead.name; meetingTitle = `Call with ${lead.name}`; }
    }
  }

  if (input.meetingId) {
    const meeting = await prisma.meeting.findFirst({
      where: { id: input.meetingId, orgId: input.orgId },
    });
    if (!meeting) throw notFound('Meeting not found');
    transcript = transcript || meeting.summary || '';
    durationMinutes = durationMinutes || meeting.durationMinutes;
    meetingTitle = meeting.title;
    if (meeting.leadId) {
      const lead = await prisma.lead.findFirst({ where: { id: meeting.leadId } });
      if (lead) leadName = lead.name;
    }
  }

  if (!transcript) {
    throw badRequest('No transcript available to generate notes from. Transcribe the recording first.');
  }

  // Generate notes (demo mode: structured extraction)
  const notes = generateNotesFromTranscript(transcript, meetingTitle, leadName, durationMinutes);

  // Persist
  const record = await prisma.meetingNotes.create({
    data: {
      orgId: input.orgId,
      callId: input.callId || null,
      meetingId: input.meetingId || null,
      recordingId: input.recordingId || null,
      leadId: input.leadId || null,
      userId: input.userId || null,
      source: 'AUTO_GENERATED',
      title: notes.title,
      notes: notes.notes,
      summary: notes.summary,
      keyDecisions: notes.keyDecisions as any,
      actionItems: notes.actionItems as any,
      followUpItems: notes.followUpItems as any,
      sentiment: notes.sentiment,
      attendees: notes.attendees as any,
      durationMinutes: notes.durationMinutes,
    },
  });

  // Also update the call/meeting summary if linked
  if (input.callId) {
    await prisma.call.update({
      where: { id: input.callId },
      data: { summary: notes.summary, sentiment: notes.sentiment, actionItems: notes.actionItems as any },
    });
  }
  if (input.meetingId) {
    await prisma.meeting.update({
      where: { id: input.meetingId },
      data: { summary: notes.summary, actionItems: notes.actionItems as any },
    });
  }

  return { ...notes, id: record.id };
}

/**
 * Get meeting notes by ID.
 */
export async function getMeetingNotes(id: string, orgId: string) {
  const notes = await prisma.meetingNotes.findFirst({ where: { id, orgId } });
  if (!notes) throw notFound('Meeting notes not found');
  return notes;
}

/**
 * Update meeting notes (manual edits).
 */
export async function updateMeetingNotes(id: string, orgId: string, data: {
  title?: string;
  notes?: string;
  summary?: string;
  keyDecisions?: string[];
  actionItems?: Array<{ assignee: string; task: string; dueDate?: string }>;
  followUpItems?: string[];
}) {
  const existing = await prisma.meetingNotes.findFirst({ where: { id, orgId } });
  if (!existing) throw notFound('Meeting notes not found');

  const updateData: Record<string, unknown> = {};
  if (data.title !== undefined) updateData.title = data.title;
  if (data.notes !== undefined) updateData.notes = data.notes;
  if (data.summary !== undefined) updateData.summary = data.summary;
  if (data.keyDecisions !== undefined) updateData.keyDecisions = data.keyDecisions;
  if (data.actionItems !== undefined) updateData.actionItems = data.actionItems;
  if (data.followUpItems !== undefined) updateData.followUpItems = data.followUpItems;
  updateData.source = 'EDITED';

  return prisma.meetingNotes.update({ where: { id }, data: updateData });
}

/**
 * List meeting notes with filters.
 */
export async function listMeetingNotes(orgId: string, opts?: {
  callId?: string;
  meetingId?: string;
  leadId?: string;
  userId?: string;
  page?: number;
  limit?: number;
}) {
  const where: Record<string, unknown> = { orgId };
  if (opts?.callId) where.callId = opts.callId;
  if (opts?.meetingId) where.meetingId = opts.meetingId;
  if (opts?.leadId) where.leadId = opts.leadId;
  if (opts?.userId) where.userId = opts.userId;

  const page = opts?.page || 1;
  const limit = Math.min(opts?.limit || 50, 200);

  const [notes, total] = await Promise.all([
    prisma.meetingNotes.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
    prisma.meetingNotes.count({ where }),
  ]);

  return { notes, total, page, limit, pages: Math.ceil(total / limit) };
}

/**
 * Delete meeting notes.
 */
export async function deleteMeetingNotes(id: string, orgId: string) {
  const existing = await prisma.meetingNotes.findFirst({ where: { id, orgId } });
  if (!existing) throw notFound('Meeting notes not found');
  await prisma.meetingNotes.delete({ where: { id } });
  return { deleted: true };
}

// ── Helpers ───────────────────────────────────────────────

async function findExistingNotes(input: GenerateNotesInput) {
  const where: Record<string, unknown> = { orgId: input.orgId };
  if (input.callId) where.callId = input.callId;
  if (input.meetingId) where.meetingId = input.meetingId;
  if (input.recordingId) where.recordingId = input.recordingId;

  const existing = await prisma.meetingNotes.findFirst({
    where,
    orderBy: { createdAt: 'desc' },
  });

  if (existing) {
    return {
      id: existing.id,
      title: existing.title,
      notes: existing.notes,
      summary: existing.summary,
      keyDecisions: (existing.keyDecisions as string[]) || [],
      actionItems: (existing.actionItems as any[]) || [],
      followUpItems: (existing.followUpItems as string[]) || [],
      sentiment: existing.sentiment,
      attendees: (existing.attendees as string[]) || [],
      durationMinutes: existing.durationMinutes,
    };
  }
  return null;
}

/**
 * Generate structured meeting notes from transcript text.
 * In production, replace this with an LLM API call.
 */
function generateNotesFromTranscript(
  transcript: string,
  title: string,
  leadName: string,
  durationMinutes: number,
): MeetingNotesData {
  const lines = transcript.split('\n').filter(l => l.trim());

  // Extract speaker turns
  const speakerTurns = lines.filter(l => l.match(/^[A-Z][a-z]+:|^Speaker \d+:/i));
  const speakers = [...new Set(speakerTurns.map(l => l.split(':')[0].trim()))];

  // Extract action items (lines with action verbs)
  const actionKeywords = ['will', 'should', 'need to', 'follow up', 'send', 'schedule', 'prepare', 'check', 'review', 'call'];
  const actionItems = lines
    .filter(l => actionKeywords.some(kw => l.toLowerCase().includes(kw)))
    .slice(0, 10)
    .map(l => ({
      assignee: speakers[0] || 'Team',
      task: l.replace(/^\w+:\s*/, '').trim().slice(0, 200),
    }));

  // Extract key topics (capitalized phrases)
  const topics = lines
    .filter(l => l.length > 10 && l.length < 200)
    .slice(0, 5)
    .map(l => l.replace(/^\w+:\s*/, '').trim().slice(0, 100));

  // Simple sentiment detection
  const positiveWords = ['great', 'excellent', 'agree', 'perfect', 'wonderful', 'happy', 'excited', 'confident'];
  const negativeWords = ['concern', 'worried', 'issue', 'problem', 'risk', 'unfortunately', 'difficult', 'challenging'];
  const lowerTranscript = transcript.toLowerCase();
  const posCount = positiveWords.filter(w => lowerTranscript.includes(w)).length;
  const negCount = negativeWords.filter(w => lowerTranscript.includes(w)).length;
  const sentiment = posCount > negCount ? 'POSITIVE' : negCount > posCount ? 'NEGATIVE' : 'NEUTRAL';

  // Build the notes document
  const noteTitle = title || `Meeting Notes - ${leadName || 'Unknown'} - ${new Date().toLocaleDateString()}`;
  const summary = `Meeting with ${leadName || 'participant'} (${durationMinutes} min). ${speakers.length > 0 ? `Participants: ${speakers.join(', ')}.` : ''} ${topics.length > 0 ? `Key topics: ${topics.slice(0, 3).join('; ')}.` : ''}`;

  const notesMarkdown = [
    `# ${noteTitle}`,
    '',
    `**Date:** ${new Date().toLocaleDateString()}`,
    `**Duration:** ${durationMinutes} minutes`,
    speakers.length > 0 ? `**Participants:** ${speakers.join(', ')}` : '',
    '',
    '## Summary',
    summary,
    '',
    '## Key Topics',
    ...topics.map((t, i) => `${i + 1}. ${t}`),
    '',
    '## Discussion',
    ...lines.slice(0, 30).map(l => `> ${l}`),
    lines.length > 30 ? `\n> ... (${lines.length - 30} more lines)` : '',
    '',
    '## Action Items',
    ...actionItems.map((a, i) => `- [ ] **${a.assignee}:** ${a.task}`),
    '',
    '## Key Decisions',
    ...topics.slice(0, 3).map(t => `- ${t}`),
    '',
    `**Sentiment:** ${sentiment}`,
  ].filter(Boolean).join('\n');

  return {
    id: '',
    title: noteTitle,
    notes: notesMarkdown,
    summary,
    keyDecisions: topics.slice(0, 3),
    actionItems,
    followUpItems: actionItems.map(a => a.task),
    sentiment,
    attendees: speakers,
    durationMinutes,
  };
}
