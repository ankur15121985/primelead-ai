/**
 * SMS Lead Generation — converts inbound SMS messages into leads.
 *
 * Flow:
 *   1. Twilio/textbelt/Textlocal sends POST /webhooks/sms with From + Body
 *   2. Service checks for duplicate (same number, same org, last 24h)
 *   3. If new: creates/links a Lead, creates SmsInbound record
 *   4. Returns acknowledgement (Twilio expects empty 200 response)
 *
 * Opt-out: if body matches STOP/UNSUBSCRIBE/etc, marks as OPTED_OUT and
 *          adds to suppression list.
 */
import { prisma } from '../lib/prisma';
import { badRequest } from '../lib/http';

// ── Types ─────────────────────────────────────────────────

export interface InboundSmsPayload {
  orgId: string;
  from: string;        // e.g. "+919876543210"
  to?: string;         // e.g. "+1234567890"
  body: string;
  /** External SMS provider message ID (for dedupe) */
  providerMessageId?: string;
  /** Provider metadata (Twilio SID, textbelt ID, etc.) */
  metadata?: Record<string, unknown>;
}

export interface SmsLeadResult {
  leadId: string;
  leadCreated: boolean;
  smsId: string;
  status: 'LEAD_CREATED' | 'DUPLICATE' | 'OPTED_OUT' | 'IGNORED';
  message?: string;
}

// ── Opt-out keywords ──────────────────────────────────────

const OPT_OUT_KEYWORDS = [
  'STOP', 'UNSUBSCRIBE', 'OPT OUT', 'OPT-OUT', 'QUIT', 'CANCEL',
  'END', 'REMOVE', 'LEAVE', 'DISCONTINUE', 'HALT', 'NO',
];

// ── Duplicate detection window ────────────────────────────

const DUPLICATE_WINDOW_HOURS = 24;

// ── Main handler ──────────────────────────────────────────

/**
 * Process an inbound SMS and create a lead if appropriate.
 */
export async function processInboundSms(payload: InboundSmsPayload): Promise<SmsLeadResult> {
  const { orgId, from, to, body, providerMessageId, metadata } = payload;

  // Normalize phone number
  const normalizedFrom = normalizePhone(from);
  if (!normalizedFrom) {
    return { leadId: '', leadCreated: false, smsId: '', status: 'IGNORED', message: 'Invalid phone number' };
  }

  // Check if opted out
  if (isOptOutMessage(body)) {
    const sms = await prisma.smsInbound.create({
      data: {
        orgId,
        fromNumber: normalizedFrom,
        toNumber: to || null,
        body: body.trim(),
        status: 'OPTED_OUT',
        metadata: metadata ? (metadata as any) : undefined,
      },
    });

    // Add to suppression list
    await prisma.suppressionEntry.upsert({
      where: { id: `sms-${orgId}-${normalizedFrom}` },
      create: {
        id: `sms-${orgId}-${normalizedFrom}`,
        orgId,
        type: 'PHONE',
        value: normalizedFrom,
        reason: 'UNSUBSCRIBE',
        source: 'INBOUND_SMS',
      },
      update: {},
    });

    // Unlink any existing lead
    return { leadId: '', leadCreated: false, smsId: sms.id, status: 'OPTED_OUT', message: 'User opted out' };
  }

  // Check for duplicate within window
  const windowStart = new Date(Date.now() - DUPLICATE_WINDOW_HOURS * 60 * 60 * 1000);
  const duplicate = await prisma.smsInbound.findFirst({
    where: {
      orgId,
      fromNumber: normalizedFrom,
      createdAt: { gte: windowStart },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (duplicate) {
    return { leadId: '', leadCreated: false, smsId: duplicate.id, status: 'DUPLICATE', message: 'Duplicate SMS within 24h window' };
  }

  // Find or create lead by phone number
  const existingLead = await prisma.lead.findFirst({
    where: {
      orgId,
      phone: normalizedFrom,
    },
  });

  let leadId: string;
  let leadCreated = false;

  if (existingLead) {
    // Link to existing lead
    leadId = existingLead.id;
  } else {
    // Create new lead from SMS
    const name = extractNameFromSms(body) || `SMS Lead ${normalizedFrom.slice(-4)}`;
    const lead = await prisma.lead.create({
      data: {
        orgId,
        name,
        phone: normalizedFrom,
        source: 'SMS',
        status: 'NEW',
        notes: `Inbound SMS: "${body.slice(0, 200)}"`,
        customFields: { originalMessage: body.slice(0, 500) } as any,
      },
    });
    leadId = lead.id;
    leadCreated = true;
  }

  // Create the SMS record
  const sms = await prisma.smsInbound.create({
    data: {
      orgId,
      leadId,
      fromNumber: normalizedFrom,
      toNumber: to || null,
      body: body.trim(),
      status: 'LEAD_CREATED',
      metadata: metadata ? (metadata as any) : undefined,
    },
  });

  return { leadId, leadCreated, smsId: sms.id, status: 'LEAD_CREATED' };
}

// ── Helpers ───────────────────────────────────────────────

function normalizePhone(phone: string): string | null {
  if (!phone) return null;
  // Remove all non-digit chars except leading +
  let normalized = phone.replace(/[^\d+]/g, '');
  // Ensure starts with +
  if (!normalized.startsWith('+')) {
    // Assume Indian number if 10 digits
    if (normalized.length === 10) normalized = `+91${normalized}`;
    else normalized = `+${normalized}`;
  }
  return normalized.length >= 10 ? normalized : null;
}

function isOptOutMessage(body: string): boolean {
  const clean = body.trim().toUpperCase();
  return OPT_OUT_KEYWORDS.some(kw => clean === kw || clean.startsWith(`${kw} `) || clean.endsWith(` ${kw}`));
}

function extractNameFromSms(body: string): string | null {
  // Try to extract name from "Hi, I'm <name>" or "My name is <name>"
  const patterns = [
    /(?:hi|hello|hey)[,!\s]+(?:i'm|this is|my name is)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
    /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:here|speaking)/,
  ];
  for (const pattern of patterns) {
    const match = body.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// ── Listing & Stats ───────────────────────────────────────

export async function listInboundSms(orgId: string, opts?: { status?: string; days?: number }) {
  const where: Record<string, unknown> = { orgId };
  if (opts?.status) where.status = opts.status;
  if (opts?.days) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - opts.days);
    where.createdAt = { gte: cutoff };
  }
  return prisma.smsInbound.findMany({ where, orderBy: { createdAt: 'desc' }, take: 200 });
}

export async function getSmsStats(orgId: string) {
  const [total, byStatus, todayCount] = await Promise.all([
    prisma.smsInbound.count({ where: { orgId } }),
    prisma.smsInbound.groupBy({ by: ['status'], where: { orgId }, _count: true }),
    prisma.smsInbound.count({
      where: { orgId, createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
    }),
  ]);

  return {
    total,
    today: todayCount,
    byStatus: Object.fromEntries(byStatus.map(s => [s.status, s._count])),
  };
}

/**
 * Bulk-create leads from a list of SMS numbers (for the "generate call" feature).
 * Returns a list of phone numbers ready for outbound calls.
 */
export async function getCallReadyLeads(orgId: string, opts?: { limit?: number }) {
  const limit = Math.min(opts?.limit || 50, 200);
  const leads = await prisma.lead.findMany({
    where: {
      orgId,
      phone: { not: null },
      status: { in: ['NEW', 'CONTACTED', 'QUALIFIED'] },
      deletedAt: null,
    },
    select: { id: true, name: true, phone: true, email: true, company: true, score: true },
    orderBy: { score: 'desc' },
    take: limit,
  });
  return leads;
}
