/**
 * Phase 13 — Consent tracking + suppression list.
 *
 * Tracks GDPR/CCPA consent per contact and enforces suppression lists
 * for email/call/SMS campaigns.
 */
import { prisma } from '../lib/prisma';

/* ── Consent Records ────────────────────────────────────────── */

export interface ConsentInput {
  contactId?: string;
  companyId?: string;
  type: string;
  status: string;
  source?: string;
  sourceRef?: string;
  evidence?: string;
  ipAddress?: string;
  userAgent?: string;
  lawfulBasis?: string;
  version?: string;
  expiresAt?: Date;
}

export async function recordConsent(orgId: string, input: ConsentInput) {
  return prisma.consentRecord.create({
    data: {
      orgId,
      contactId: input.contactId || null,
      companyId: input.companyId || null,
      type: input.type,
      status: input.status,
      source: input.source || null,
      sourceRef: input.sourceRef || null,
      evidence: input.evidence || null,
      ipAddress: input.ipAddress || null,
      userAgent: input.userAgent || null,
      lawfulBasis: input.lawfulBasis || null,
      version: input.version || null,
      expiresAt: input.expiresAt || null,
      grantedAt: input.status === 'GRANTED' ? new Date() : null,
      verifiedAt: input.status === 'GRANTED' ? new Date() : null,
    },
  });
}

export async function getConsentHistory(orgId: string, contactId?: string) {
  return prisma.consentRecord.findMany({
    where: {
      orgId,
      ...(contactId ? { contactId } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
}

export async function hasValidConsent(orgId: string, contactId: string, type: string): Promise<boolean> {
  const consent = await prisma.consentRecord.findFirst({
    where: {
      orgId,
      contactId,
      type,
      status: 'GRANTED',
    },
    orderBy: { createdAt: 'desc' },
  });
  if (!consent) return false;
  // Check expiry
  if (consent.expiresAt && consent.expiresAt < new Date()) return false;
  // Check for subsequent withdrawal
  const laterWithdrawal = await prisma.consentRecord.findFirst({
    where: {
      orgId,
      contactId,
      type,
      status: 'WITHDRAWN',
      createdAt: { gt: consent.createdAt },
    },
  });
  return !laterWithdrawal;
}

/* ── Suppression List ───────────────────────────────────────── */

export interface SuppressionInput {
  type: string;
  value: string;
  contactId?: string;
  companyId?: string;
  reason: string;
  reasonDetail?: string;
  source?: string;
  sourceRef?: string;
  isGlobal?: boolean;
  expiresAt?: Date;
}

export async function addSuppression(orgId: string, input: SuppressionInput) {
  return prisma.suppressionEntry.upsert({
    where: { orgId_type_value: { orgId, type: input.type, value: input.value } },
    create: {
      orgId,
      type: input.type,
      value: input.value,
      contactId: input.contactId || null,
      companyId: input.companyId || null,
      reason: input.reason,
      reasonDetail: input.reasonDetail || null,
      source: input.source || null,
      sourceRef: input.sourceRef || null,
      isGlobal: input.isGlobal || false,
      expiresAt: input.expiresAt || null,
    },
    update: {
      reason: input.reason,
      reasonDetail: input.reasonDetail || undefined,
      source: input.source || undefined,
      isGlobal: input.isGlobal ?? undefined,
    },
  });
}

export async function isSuppressed(orgId: string, type: string, value: string): Promise<boolean> {
  const entry = await prisma.suppressionEntry.findFirst({
    where: {
      orgId,
      type,
      value,
      removedAt: null,
    },
  });
  if (!entry) return false;
  // Check expiry
  if (entry.expiresAt && entry.expiresAt < new Date()) return false;
  return true;
}

export async function getSuppressions(orgId: string, type?: string) {
  return prisma.suppressionEntry.findMany({
    where: {
      orgId,
      removedAt: null,
      ...(type ? { type } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 500,
  });
}

export async function removeSuppression(orgId: string, id: string, removedBy: string) {
  return prisma.suppressionEntry.update({
    where: { id },
    data: { removedAt: new Date(), removedBy },
  });
}

export async function getSuppressionStats(orgId: string) {
  const [total, byType, recentAdds] = await Promise.all([
    prisma.suppressionEntry.count({ where: { orgId, removedAt: null } }),
    prisma.suppressionEntry.groupBy({
      by: ['type', 'reason'],
      where: { orgId, removedAt: null },
      _count: { _all: true },
    }),
    prisma.suppressionEntry.findMany({
      where: { orgId, removedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
  ]);

  return {
    total,
    byType: byType.map((r) => ({ type: r.type, reason: r.reason, count: r._count._all })),
    recent: recentAdds,
  };
}

/* ── Bulk suppression check (for campaign enrollment) ────────── */

export async function filterSuppressedContacts(
  orgId: string,
  type: 'EMAIL' | 'PHONE',
  values: string[]
): Promise<{ allowed: string[]; suppressed: Array<{ value: string; reason: string }> }> {
  if (values.length === 0) return { allowed: [], suppressed: [] };

  const entries = await prisma.suppressionEntry.findMany({
    where: {
      orgId,
      type,
      value: { in: values },
      removedAt: null,
    },
  });

  const now = new Date();
  const suppressedMap = new Map<string, string>();
  for (const entry of entries) {
    if (entry.expiresAt && entry.expiresAt < now) continue;
    suppressedMap.set(entry.value, entry.reason);
  }

  return {
    allowed: values.filter((v) => !suppressedMap.has(v)),
    suppressed: values
      .filter((v) => suppressedMap.has(v))
      .map((v) => ({ value: v, reason: suppressedMap.get(v)! })),
  };
}
