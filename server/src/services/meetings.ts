import { prisma } from '../lib/prisma';
import { notFound } from '../lib/http';

export interface CreateMeetingInput {
  orgId: string;
  leadId?: string | null;
  contactId?: string | null;
  hostId?: string | null;
  title: string;
  description?: string | null;
  meetingType?: string;
  startAt: Date;
  endAt: Date;
  durationMinutes?: number;
  timezone?: string;
  meetingUrl?: string | null;
  prepNotes?: string | null;
}

export async function createMeeting(input: CreateMeetingInput) {
  return prisma.meeting.create({
    data: {
      orgId: input.orgId,
      leadId: input.leadId || null,
      contactId: input.contactId || null,
      hostId: input.hostId || null,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      meetingType: input.meetingType || '1_1',
      startAt: input.startAt,
      endAt: input.endAt,
      durationMinutes: input.durationMinutes ?? Math.round((input.endAt.getTime() - input.startAt.getTime()) / 60000),
      timezone: input.timezone || 'Asia/Kolkata',
      meetingUrl: input.meetingUrl || null,
      prepNotes: input.prepNotes?.trim() || null,
    },
    include: { lead: { select: { id: true, name: true } } },
  });
}

export async function updateMeeting(id: string, orgId: string, data: {
  title?: string;
  description?: string | null;
  status?: string;
  startAt?: Date;
  endAt?: Date;
  durationMinutes?: number;
  meetingUrl?: string | null;
  prepNotes?: string | null;
  summary?: string | null;
  actionItems?: unknown;
}) {
  const existing = await prisma.meeting.findFirst({ where: { id, orgId } });
  if (!existing) throw notFound('Meeting not found');

  const updateData: Record<string, unknown> = {};
  if (data.title !== undefined) updateData.title = data.title.trim();
  if (data.description !== undefined) updateData.description = data.description?.trim() || null;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.startAt !== undefined) updateData.startAt = data.startAt;
  if (data.endAt !== undefined) updateData.endAt = data.endAt;
  if (data.durationMinutes !== undefined) updateData.durationMinutes = data.durationMinutes;
  if (data.meetingUrl !== undefined) updateData.meetingUrl = data.meetingUrl || null;
  if (data.prepNotes !== undefined) updateData.prepNotes = data.prepNotes?.trim() || null;
  if (data.summary !== undefined) updateData.summary = data.summary?.trim() || null;
  if (data.actionItems !== undefined) updateData.actionItems = data.actionItems ? JSON.parse(JSON.stringify(data.actionItems)) : undefined;

  return prisma.meeting.update({ where: { id }, data: updateData });
}

export async function getMeeting(id: string, orgId: string) {
  const meeting = await prisma.meeting.findFirst({
    where: { id, orgId },
    include: { lead: { select: { id: true, name: true, company: true, email: true } } },
  });
  if (!meeting) throw notFound('Meeting not found');
  return meeting;
}

export async function listMeetings(orgId: string, filters?: { hostId?: string; leadId?: string; status?: string; from?: Date; to?: Date }) {
  const where: Record<string, unknown> = { orgId };
  if (filters?.hostId) where.hostId = filters.hostId;
  if (filters?.leadId) where.leadId = filters.leadId;
  if (filters?.status) where.status = filters.status;
  if (filters?.from || filters?.to) {
    where.startAt = {};
    if (filters.from) (where.startAt as Record<string, unknown>).gte = filters.from;
    if (filters.to) (where.startAt as Record<string, unknown>).lte = filters.to;
  }

  return prisma.meeting.findMany({
    where,
    orderBy: { startAt: 'asc' },
    take: 200,
    include: { lead: { select: { id: true, name: true } } },
  });
}

export async function cancelMeeting(id: string, orgId: string) {
  const existing = await prisma.meeting.findFirst({ where: { id, orgId } });
  if (!existing) throw notFound('Meeting not found');
  return prisma.meeting.update({ where: { id }, data: { status: 'CANCELLED' } });
}

export async function completeMeeting(id: string, orgId: string, summary?: string, actionItems?: string[]) {
  const existing = await prisma.meeting.findFirst({ where: { id, orgId } });
  if (!existing) throw notFound('Meeting not found');
  return prisma.meeting.update({
    where: { id },
    data: {
      status: 'COMPLETED',
      summary: summary?.trim() || null,
      actionItems: actionItems ? JSON.parse(JSON.stringify(actionItems)) : undefined,
    },
  });
}

export async function deleteMeeting(id: string, orgId: string) {
  const existing = await prisma.meeting.findFirst({ where: { id, orgId } });
  if (!existing) throw notFound('Meeting not found');
  await prisma.meeting.delete({ where: { id } });
  return { deleted: true };
}

export async function getMeetingStats(orgId: string, hostId?: string) {
  const where: Record<string, unknown> = { orgId };
  if (hostId) where.hostId = hostId;

  const [total, byStatus, upcoming] = await Promise.all([
    prisma.meeting.count({ where }),
    prisma.meeting.groupBy({ by: ['status'], where, _count: true }),
    prisma.meeting.count({ where: { ...where, status: 'SCHEDULED', startAt: { gte: new Date() } } }),
  ]);

  return {
    total,
    upcoming,
    byStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count])),
  };
}
