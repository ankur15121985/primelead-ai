import { prisma } from '../lib/prisma';
import { notFound } from '../lib/http';

export interface CreateCallInput {
  orgId: string;
  leadId?: string | null;
  contactId?: string | null;
  userId?: string | null;
  direction?: string;
  status: string;
  fromNumber?: string | null;
  toNumber?: string | null;
  durationSeconds?: number;
  disposition?: string | null;
  notes?: string | null;
  recordingUrl?: string | null;
  recordingConsent?: boolean;
  startedAt?: Date | null;
  endedAt?: Date | null;
}

export async function logCall(input: CreateCallInput) {
  return prisma.call.create({
    data: {
      orgId: input.orgId,
      leadId: input.leadId || null,
      contactId: input.contactId || null,
      userId: input.userId || null,
      direction: input.direction || 'OUTBOUND',
      status: input.status,
      fromNumber: input.fromNumber || null,
      toNumber: input.toNumber || null,
      durationSeconds: input.durationSeconds ?? 0,
      disposition: input.disposition || null,
      notes: input.notes?.trim() || null,
      recordingUrl: input.recordingUrl || null,
      recordingConsent: input.recordingConsent ?? false,
      startedAt: input.startedAt || null,
      endedAt: input.endedAt || null,
    },
  });
}

export async function updateCall(id: string, orgId: string, data: {
  status?: string;
  disposition?: string | null;
  notes?: string | null;
  durationSeconds?: number;
  transcript?: string | null;
  summary?: string | null;
  sentiment?: string | null;
  actionItems?: unknown;
}) {
  const existing = await prisma.call.findFirst({ where: { id, orgId } });
  if (!existing) throw notFound('Call not found');

  const updateData: Record<string, unknown> = {};
  if (data.status !== undefined) updateData.status = data.status;
  if (data.disposition !== undefined) updateData.disposition = data.disposition;
  if (data.notes !== undefined) updateData.notes = data.notes;
  if (data.durationSeconds !== undefined) updateData.durationSeconds = data.durationSeconds;
  if (data.transcript !== undefined) updateData.transcript = data.transcript;
  if (data.summary !== undefined) updateData.summary = data.summary;
  if (data.sentiment !== undefined) updateData.sentiment = data.sentiment;
  if (data.actionItems !== undefined) updateData.actionItems = data.actionItems ? JSON.parse(JSON.stringify(data.actionItems)) : undefined;

  return prisma.call.update({ where: { id }, data: updateData });
}

export async function getCall(id: string, orgId: string) {
  const call = await prisma.call.findFirst({ where: { id, orgId } });
  if (!call) throw notFound('Call not found');
  return call;
}

export async function listCalls(orgId: string, filters?: { leadId?: string; userId?: string; status?: string; days?: number }) {
  const where: Record<string, unknown> = { orgId };
  if (filters?.leadId) where.leadId = filters.leadId;
  if (filters?.userId) where.userId = filters.userId;
  if (filters?.status) where.status = filters.status;
  if (filters?.days) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - filters.days);
    where.createdAt = { gte: cutoff };
  }
  return prisma.call.findMany({ where, orderBy: { createdAt: 'desc' }, take: 200 });
}

export async function deleteCall(id: string, orgId: string) {
  const existing = await prisma.call.findFirst({ where: { id, orgId } });
  if (!existing) throw notFound('Call not found');
  await prisma.call.delete({ where: { id } });
  return { deleted: true };
}

export async function getCallStats(orgId: string, userId?: string) {
  const where: Record<string, unknown> = { orgId };
  if (userId) where.userId = userId;

  const [total, byStatus, byDisposition, avgDuration] = await Promise.all([
    prisma.call.count({ where }),
    prisma.call.groupBy({ by: ['status'], where, _count: true }),
    prisma.call.groupBy({ by: ['disposition'], where, _count: true }),
    prisma.call.aggregate({ where, _avg: { durationSeconds: true } }),
  ]);

  return {
    total,
    byStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count])),
    byDisposition: Object.fromEntries(byDisposition.filter((d) => d.disposition).map((d) => [d.disposition, d._count])),
    avgDurationSeconds: Math.round(avgDuration._avg.durationSeconds || 0),
  };
}
