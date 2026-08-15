import { prisma } from '../lib/prisma';
import { conflict, badRequest } from '../lib/http';
import { computeLeadScore, sourceLabel, type Priority } from '../constants';
import { assignLeadOwner, recordAssignment } from './assignment';
import { notify } from '../lib/serializers';

export interface CreateLeadInput {
  orgId: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  company?: string | null;
  source?: string | null;
  campaignName?: string | null;
  campaignId?: string | null;
  priority?: Priority | string;
  expectedValue?: number;
  notes?: string | null;
  tags?: string[];
  customFields?: Record<string, string>;
  ownerId?: string | null;
  status?: string;
  stageId?: string | null;
  nextFollowUpAt?: Date | null;
  actorId?: string | null;
  createdVia?: string;
}

function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let p = phone.replace(/[^\d+]/g, '');
  if (p.startsWith('+91')) p = p.slice(3);
  if (p.length === 10 && /^[6-9]/.test(p)) return p;
  return p;
}

function normalizeEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  return email.trim().toLowerCase();
}

/** Duplicate detection by normalized phone or email within the org. */
export async function findDuplicate(orgId: string, phone?: string | null, email?: string | null) {
  const nPhone = normalizePhone(phone);
  const nEmail = normalizeEmail(email);
  if (!nPhone && !nEmail) return null;
  return prisma.lead.findFirst({
    where: {
      orgId,
      deletedAt: null,
      OR: [
        ...(nPhone ? [{ phone: nPhone }] : []),
        ...(nEmail ? [{ email: nEmail }] : []),
      ],
    },
  });
}

/**
 * The one function every lead-creation path goes through
 * (manual entry, QR form, webhooks, CSV, integrations).
 */
export async function createLead(input: CreateLeadInput) {
  const { orgId, actorId } = input;
  const nPhone = normalizePhone(input.phone);
  const nEmail = normalizeEmail(input.email);

  // Duplicate detection
  const dup = await findDuplicate(orgId, nPhone, nEmail);
  if (dup) {
    throw conflict(
      dup.phone === nPhone
        ? `A lead with this phone number already exists (${dup.name}).`
        : `A lead with this email already exists (${dup.name}).`
    );
  }

  const source = input.source || 'MANUAL';
  const priority: Priority = (input.priority as Priority) || 'MEDIUM';
  const expectedValue = input.expectedValue || 0;

  let ownerId = input.ownerId || null;
  let assignmentMode: string | null = null;

  if (!ownerId && input.createdVia !== 'manual-unassigned') {
    const assignment = await assignLeadOwner({ orgId, source, excludeUserId: actorId });
    ownerId = assignment.userId;
    assignmentMode = assignment.mode;
  }

  const score = computeLeadScore({
    priority,
    expectedValue,
    hasEmail: Boolean(nEmail),
    notes: Boolean(input.notes),
  });

  const lead = await prisma.lead.create({
    data: {
      orgId,
      name: input.name,
      phone: nPhone,
      email: nEmail,
      company: input.company || null,
      source,
      campaignName: input.campaignName || null,
      campaignId: input.campaignId || null,
      priority: priority as string,
      expectedValue,
      notes: input.notes || null,
      tags: input.tags?.length ? (input.tags as any) : undefined,
      customFields: input.customFields ? (input.customFields as any) : undefined,
      ownerId,
      status: input.status || 'NEW',
      stageId: input.stageId || null,
      nextFollowUpAt: input.nextFollowUpAt || null,
      score,
    },
    include: { owner: { select: { id: true, name: true } }, stage: true },
  });

  // Activity + audit
  await prisma.activity.create({
    data: {
      orgId,
      leadId: lead.id,
      userId: actorId || ownerId || undefined,
      type: 'LEAD_CREATED',
      title: 'Lead created',
      body: `Captured from ${sourceLabel(source)}${ownerId ? ' and auto-assigned' : ''}.`,
      metadata: { source, score },
    },
  });
  if (actorId) {
    const { audit } = await import('../lib/audit');
    await audit({ orgId, userId: actorId, action: 'LEAD_CREATED', entity: 'Lead', entityId: lead.id });
  }

  // Notify the owner
  if (ownerId && ownerId !== actorId) {
    await notify({
      orgId,
      userId: ownerId,
      type: 'NEW_LEAD',
      title: 'New lead received',
      body: `${lead.name} (${sourceLabel(source)}) was assigned to you.`,
      link: `/app/leads/${lead.id}`,
    });
  }
  if (ownerId && assignmentMode) {
    await recordAssignment({
      orgId,
      leadId: lead.id,
      leadName: lead.name,
      newOwnerId: ownerId,
      actorId: actorId || undefined,
      mode: assignmentMode,
    });
  }

  return lead;
}

export interface LeadQuery {
  orgId: string;
  scope: { orgId: string; ownerId?: string };
  search?: string;
  status?: string;
  source?: string;
  ownerId?: string;
  stageId?: string;
  priority?: string;
  minValue?: number;
  from?: string;
  to?: string;
  sort?: string;
  dir?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export function buildLeadWhere(q: LeadQuery) {
  const where: Record<string, unknown> = {
    ...q.scope,
    deletedAt: null,
  };
  if (q.status && q.status !== 'ALL') where.status = q.status;
  if (q.source && q.source !== 'ALL') where.source = q.source;
  if (q.ownerId && q.ownerId !== 'ALL') where.ownerId = q.ownerId;
  if (q.stageId && q.stageId !== 'ALL') where.stageId = q.stageId;
  if (q.priority && q.priority !== 'ALL') where.priority = q.priority;
  if (q.minValue) where.expectedValue = { gte: q.minValue };
  if (q.from || q.to) {
    where.createdAt = {
      ...(q.from ? { gte: new Date(q.from) } : {}),
      ...(q.to ? { lte: new Date(q.to) } : {}),
    };
  }
  if (q.search) {
    const s = q.search.trim();
    where.OR = [
      { name: { contains: s } },
      { phone: { contains: s } },
      { email: { contains: s } },
      { company: { contains: s } },
      { notes: { contains: s } },
    ];
  }
  return where;
}

const SAFE_SORTS = ['createdAt', 'name', 'expectedValue', 'score', 'nextFollowUpAt', 'lastContactedAt', 'updatedAt'];

export function leadOrderBy(q: { sort?: string; dir?: 'asc' | 'desc' }) {
  const field = SAFE_SORTS.includes(q.sort || '') ? (q.sort as string) : 'createdAt';
  return { [field]: q.dir === 'asc' ? 'asc' : 'desc' };
}

export function csvEscape(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function leadsToCsv(rows: Array<Record<string, unknown>>): string {
  const header = ['Name', 'Phone', 'Email', 'Company', 'Source', 'Status', 'Owner', 'Score', 'Expected Value', 'Next Follow-up', 'Created'];
  const lines = rows.map((r) =>
    [r.name, r.phone, r.email, r.company, r.source, r.status, r.owner, r.score, r.expectedValue, r.nextFollowUpAt, r.createdAt]
      .map(csvEscape)
      .join(',')
  );
  return [header.join(','), ...lines].join('\r\n');
}

export { normalizePhone, normalizeEmail };
