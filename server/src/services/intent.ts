import { prisma } from '../lib/prisma';
import { notFound } from '../lib/http';

// ── Intent Signals ──────────────────────────────────────────

export interface CreateIntentInput {
  orgId: string;
  companyId?: string | null;
  contactId?: string | null;
  type: string;
  topic?: string | null;
  source: string;
  confidence?: number;
  metadata?: Record<string, unknown> | null;
}

export async function recordIntent(input: CreateIntentInput) {
  return (prisma as any).intentSignal.create({
    data: {
      orgId: input.orgId,
      companyId: input.companyId || null,
      contactId: input.contactId || null,
      type: input.type,
      topic: input.topic || null,
      source: input.source,
      confidence: input.confidence ?? 0.5,
      metadata: input.metadata ? JSON.parse(JSON.stringify(input.metadata)) : undefined,
      lastSeenAt: new Date(),
    },
  });
}

export async function getIntentSignals(orgId: string, filters?: { companyId?: string; contactId?: string; type?: string }) {
  const where: Record<string, unknown> = { orgId };
  if (filters?.companyId) where.companyId = filters.companyId;
  if (filters?.contactId) where.contactId = filters.contactId;
  if (filters?.type) where.type = filters.type;

  return (prisma as any).intentSignal.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
}

export async function getCompanyIntentSummary(orgId: string, companyId: string) {
  const signals = await (prisma as any).intentSignal.findMany({
    where: { orgId, companyId },
    orderBy: { createdAt: 'desc' },
  });

  const byType: Record<string, number> = {};
  let totalConfidence = 0;
  for (const s of signals) {
    byType[s.type] = (byType[s.type] || 0) + 1;
    totalConfidence += s.confidence;
  }

  return {
    totalSignals: signals.length,
    byType,
    avgConfidence: signals.length > 0 ? totalConfidence / signals.length : 0,
    latestTopic: signals[0]?.topic || null,
    signals: signals.slice(0, 20),
  };
}

// ── Company Signals ─────────────────────────────────────────

export interface CreateCompanySignalInput {
  orgId: string;
  companyId: string;
  type: string;
  title: string;
  description?: string | null;
  source: string;
  confidence?: number;
  evidence?: unknown[] | null;
  metadata?: Record<string, unknown> | null;
}

export async function recordCompanySignal(input: CreateCompanySignalInput) {
  return (prisma as any).companySignal.create({
    data: {
      orgId: input.orgId,
      companyId: input.companyId,
      type: input.type,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      source: input.source,
      confidence: input.confidence ?? 0.5,
      evidence: input.evidence ? JSON.parse(JSON.stringify(input.evidence)) : undefined,
      metadata: input.metadata ? JSON.parse(JSON.stringify(input.metadata)) : undefined,
      detectedAt: new Date(),
    },
  });
}

export async function getCompanySignals(orgId: string, companyId: string) {
  return (prisma as any).companySignal.findMany({
    where: { orgId, companyId },
    orderBy: { detectedAt: 'desc' },
    take: 100,
  });
}

export async function getAllSignals(orgId: string, filters?: { type?: string; days?: number }) {
  const where: Record<string, unknown> = { orgId };
  if (filters?.type) where.type = filters.type;
  if (filters?.days) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - filters.days);
    where.detectedAt = { gte: cutoff };
  }

  return (prisma as any).companySignal.findMany({
    where,
    orderBy: { detectedAt: 'desc' },
    take: 200,
  });
}

export async function deleteSignal(id: string, orgId: string) {
  const existing = await (prisma as any).companySignal.findFirst({ where: { id, orgId } });
  if (!existing) throw notFound('Signal not found');
  await (prisma as any).companySignal.delete({ where: { id } });
  return { deleted: true };
}
