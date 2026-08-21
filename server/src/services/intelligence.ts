import { prisma } from '../lib/prisma';
import { notFound } from '../lib/http';

export interface CreateAnalysisInput {
  orgId: string;
  callId?: string | null;
  meetingId?: string | null;
  contactId?: string | null;
  companyId?: string | null;
  type: string;
  summary?: string | null;
  topics?: string[] | null;
  objections?: { objection: string; response?: string; resolved?: boolean }[] | null;
  competitors?: string[] | null;
  pricingDiscussed?: boolean;
  buyingSignals?: string[] | null;
  nextSteps?: string[] | null;
  sentiment?: string | null;
  riskLevel?: string | null;
  sentimentScore?: number | null;
  metadata?: Record<string, unknown> | null;
}

function toJson(val: unknown): unknown {
  return val !== undefined && val !== null ? JSON.parse(JSON.stringify(val)) : undefined;
}

export async function createAnalysis(input: CreateAnalysisInput) {
  return (prisma as any).conversationAnalysis.create({
    data: {
      orgId: input.orgId,
      callId: input.callId || null,
      meetingId: input.meetingId || null,
      contactId: input.contactId || null,
      companyId: input.companyId || null,
      type: input.type,
      summary: input.summary?.trim() || null,
      topics: toJson(input.topics),
      objections: toJson(input.objections),
      competitors: toJson(input.competitors),
      pricingDiscussed: input.pricingDiscussed ?? false,
      buyingSignals: toJson(input.buyingSignals),
      nextSteps: toJson(input.nextSteps),
      sentiment: input.sentiment || null,
      riskLevel: input.riskLevel || null,
      sentimentScore: input.sentimentScore ?? null,
      metadata: toJson(input.metadata),
    },
  });
}

export async function getAnalysis(id: string, orgId: string) {
  const analysis = await (prisma as any).conversationAnalysis.findFirst({ where: { id, orgId } });
  if (!analysis) throw notFound('Analysis not found');
  return analysis;
}

export async function listAnalyses(orgId: string, filters?: { callId?: string; meetingId?: string; contactId?: string; companyId?: string; type?: string }) {
  const where: Record<string, unknown> = { orgId };
  if (filters?.callId) where.callId = filters.callId;
  if (filters?.meetingId) where.meetingId = filters.meetingId;
  if (filters?.contactId) where.contactId = filters.contactId;
  if (filters?.companyId) where.companyId = filters.companyId;
  if (filters?.type) where.type = filters.type;

  return (prisma as any).conversationAnalysis.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
}

export async function deleteAnalysis(id: string, orgId: string) {
  const existing = await (prisma as any).conversationAnalysis.findFirst({ where: { id, orgId } });
  if (!existing) throw notFound('Analysis not found');
  await (prisma as any).conversationAnalysis.delete({ where: { id } });
  return { deleted: true };
}

/**
 * Get conversation intelligence summary for a contact.
 */
export async function getContactIntelligence(orgId: string, contactId: string) {
  const [analyses, calls, meetings] = await Promise.all([
    (prisma as any).conversationAnalysis.findMany({
      where: { orgId, contactId },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.call.findMany({
      where: { orgId, contactId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    prisma.meeting.findMany({
      where: { orgId, contactId },
      orderBy: { startAt: 'desc' },
      take: 10,
    }),
  ]);

  // Aggregate topics
  const allTopics = new Set<string>();
  const allObjections: { objection: string; response?: string; resolved?: boolean }[] = [];
  const allCompetitors = new Set<string>();
  const allBuyingSignals = new Set<string>();
  let sentimentCounts = { POSITIVE: 0, NEUTRAL: 0, NEGATIVE: 0 };

  for (const a of analyses) {
    if (a.topics) for (const t of a.topics as string[]) allTopics.add(t);
    if (a.objections) allObjections.push(...(a.objections as { objection: string; response?: string; resolved?: boolean }[]));
    if (a.competitors) for (const c of a.competitors as string[]) allCompetitors.add(c);
    if (a.buyingSignals) for (const s of a.buyingSignals as string[]) allBuyingSignals.add(s);
    if (a.sentiment && sentimentCounts[a.sentiment as keyof typeof sentimentCounts] !== undefined) {
      sentimentCounts[a.sentiment as keyof typeof sentimentCounts]++;
    }
  }

  const dominantSentiment = Object.entries(sentimentCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'NEUTRAL';

  return {
    totalInteractions: analyses.length + calls.length + meetings.length,
    analyses: analyses.length,
    calls: calls.length,
    meetings: meetings.length,
    topics: Array.from(allTopics),
    objections: allObjections,
    competitors: Array.from(allCompetitors),
    buyingSignals: Array.from(allBuyingSignals),
    sentiment: dominantSentiment,
    recentCalls: calls.slice(0, 5),
    recentMeetings: meetings.slice(0, 5),
    recentAnalyses: analyses.slice(0, 5),
  };
}

/**
 * Get sales coaching insights for a user.
 */
export async function getCoachingInsights(orgId: string, userId: string) {
  const [calls, meetings, analyses] = await Promise.all([
    prisma.call.findMany({ where: { orgId, userId }, orderBy: { createdAt: 'desc' }, take: 50 }),
    prisma.meeting.findMany({ where: { orgId, hostId: userId }, orderBy: { startAt: 'desc' }, take: 50 }),
    (prisma as any).conversationAnalysis.findMany({ where: { orgId }, orderBy: { createdAt: 'desc' }, take: 50 }),
  ]);

  const totalCalls = calls.length;
  const connectedCalls = calls.filter((c) => c.status === 'CONNECTED').length;
  const meetingBooked = calls.filter((c) => c.disposition === 'MEETING_BOOKED').length;
  const totalMeetings = meetings.length;
  const completedMeetings = meetings.filter((m) => m.status === 'COMPLETED').length;

  const avgCallDuration = totalCalls > 0
    ? Math.round(calls.reduce((sum, c) => sum + c.durationSeconds, 0) / totalCalls)
    : 0;

  const positiveSentiment = analyses.filter((a: { sentiment?: string }) => a.sentiment === 'POSITIVE').length;
  const negativeSentiment = analyses.filter((a: { sentiment?: string }) => a.sentiment === 'NEGATIVE').length;

  const insights: string[] = [];
  if (totalCalls > 0 && connectedCalls / totalCalls < 0.3) {
    insights.push('Your connection rate is low. Consider calling during business hours or trying different times.');
  }
  if (totalCalls > 0 && meetingBooked / totalCalls < 0.1) {
    insights.push('Meeting booking rate is low. Focus on value propositions and clear CTAs.');
  }
  if (avgCallDuration < 60) {
    insights.push('Average call duration is very short. Work on building rapport and qualifying leads.');
  }
  if (negativeSentiment > positiveSentiment) {
    insights.push('More negative sentiment detected. Review objection handling and messaging.');
  }
  if (insights.length === 0 && totalCalls > 0) {
    insights.push('Good performance! Keep up the consistent activity.');
  }

  return {
    stats: {
      totalCalls,
      connectedCalls,
      connectionRate: totalCalls > 0 ? Math.round((connectedCalls / totalCalls) * 100) : 0,
      meetingsBooked: meetingBooked,
      bookingRate: totalCalls > 0 ? Math.round((meetingBooked / totalCalls) * 100) : 0,
      totalMeetings,
      completedMeetings,
      avgCallDuration,
      sentimentBreakdown: { positive: positiveSentiment, neutral: analyses.length - positiveSentiment - negativeSentiment, negative: negativeSentiment },
    },
    insights,
  };
}
