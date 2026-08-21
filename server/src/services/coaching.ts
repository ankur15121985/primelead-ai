/**
 * Phase 18 — Sales coaching engine.
 *
 * Generates coaching insights per rep based on activity data.
 * Provides strengths, improvement areas, and actionable recommendations.
 */
import { prisma } from '../lib/prisma';

/* ── Period helpers ──────────────────────────────────────────── */

function getPeriodKey(date: Date, type: string): string {
  const d = new Date(date);
  switch (type) {
    case 'WEEK': {
      const start = new Date(d);
      start.setDate(d.getDate() - d.getDay());
      return `${start.getFullYear()}-W${String(Math.ceil(((d.getTime() - start.getTime()) / 86400000 + 1) / 7)).padStart(2, '0')}`;
    }
    case 'QUARTER':
      return `${d.getFullYear()}-Q${Math.ceil((d.getMonth() + 1) / 3)}`;
    case 'MONTH':
    default:
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }
}

function getDateRange(period: string, type: string): { from: Date; to: Date } {
  const now = new Date();
  switch (type) {
    case 'WEEK': {
      const [, weekStr] = period.split('-W');
      const weekNum = parseInt(weekStr || '1');
      const year = parseInt(period.split('-')[0]);
      const from = new Date(year, 0, 1 + (weekNum - 1) * 7);
      const to = new Date(from);
      to.setDate(from.getDate() + 6);
      to.setHours(23, 59, 59);
      return { from, to };
    }
    case 'QUARTER': {
      const [yStr, qStr] = period.split('-Q');
      const year = parseInt(yStr || String(now.getFullYear()));
      const q = parseInt(qStr || '1');
      const from = new Date(year, (q - 1) * 3, 1);
      const to = new Date(year, q * 3, 0, 23, 59, 59);
      return { from, to };
    }
    case 'MONTH':
    default: {
      const [yStr, mStr] = period.split('-');
      const year = parseInt(yStr || String(now.getFullYear()));
      const month = parseInt(mStr || '1') - 1;
      const from = new Date(year, month, 1);
      const to = new Date(year, month + 1, 0, 23, 59, 59);
      return { from, to };
    }
  }
}

/* ── Generate coaching insights ─────────────────────────────── */

export interface CoachingMetrics {
  activityScore: number;
  callMetrics: { made: number; connected: number; avgDuration: number; bookings: number };
  emailMetrics: { sent: number; opened: number; replied: number; positiveReplies: number };
  meetingMetrics: { held: number; noShows: number; conversionRate: number };
  pipelineMetrics: { created: number; value: number; won: number; winRate: number };
}

export async function generateCoachingInsight(orgId: string, userId: string, period: string, periodType: string = 'MONTH') {
  const { from, to } = getDateRange(period, periodType);

  // Gather metrics in parallel
  const [calls, emailLogs, meetings, tasks, leads] = await Promise.all([
    prisma.call.findMany({
      where: { orgId, userId, createdAt: { gte: from, lte: to } },
      select: { status: true, durationSeconds: true, disposition: true },
    }),
    prisma.sequenceEmailLog.findMany({
      where: {
        orgId,
        sentAt: { gte: from, lte: to },
      },
      select: { status: true, openedAt: true, bouncedAt: true, deliveredAt: true },
    }),
    prisma.meeting.findMany({
      where: { orgId, hostId: userId, startAt: { gte: from, lte: to } },
      select: { status: true },
    }),
    prisma.task.findMany({
      where: { orgId, userId: userId, createdAt: { gte: from, lte: to } },
      select: { status: true, kind: true },
    }),
    prisma.lead.findMany({
      where: { orgId, ownerId: userId, deletedAt: null, createdAt: { gte: from, lte: to } },
      select: { status: true, score: true, expectedValue: true },
    }),
  ]);

  // Call metrics
  const callsMade = calls.length;
  const callsConnected = calls.filter((c) => c.status === 'COMPLETED').length;
  const avgDuration = callsMade > 0 ? Math.round(calls.reduce((sum, c) => sum + (c.durationSeconds || 0), 0) / callsMade) : 0;
  const bookings = calls.filter((c) => c.disposition === 'MEETING_BOOKED').length;

  // Email metrics (SequenceEmailLog uses status, openedAt, bouncedAt, deliveredAt)
  const emailsSent = emailLogs.filter((e) => e.status === 'SENT' || e.deliveredAt).length;
  const emailsOpened = emailLogs.filter((e) => e.openedAt).length;
  const emailsReplied = emailLogs.filter((e) => e.status === 'REPLIED').length;
  const positiveReplies = emailLogs.filter((e) => e.status === 'REPLIED_POSITIVE').length;

  // Meeting metrics
  const meetingsHeld = meetings.filter((m) => m.status === 'COMPLETED').length;
  const meetingsNoShow = meetings.filter((m) => m.status === 'NO_SHOW').length;
  const totalMeetings = meetings.length;
  const meetingConversion = totalMeetings > 0 ? Math.round((meetingsHeld / totalMeetings) * 100) : 0;

  // Pipeline metrics
  const leadsCreated = leads.length;
  const pipelineValue = leads.reduce((sum, l) => sum + (l.expectedValue || 0), 0);
  const leadsWon = leads.filter((l) => l.status === 'WON').length;
  const winRate = leadsCreated > 0 ? Math.round((leadsWon / leadsCreated) * 100) : 0;

  // Activity score (0-100)
  let activityScore = 0;
  if (callsMade >= 20) activityScore += 30;
  else if (callsMade >= 10) activityScore += 20;
  else if (callsMade >= 5) activityScore += 10;
  if (emailsSent >= 50) activityScore += 25;
  else if (emailsSent >= 20) activityScore += 15;
  else if (emailsSent >= 10) activityScore += 10;
  if (meetingsHeld >= 8) activityScore += 25;
  else if (meetingsHeld >= 4) activityScore += 15;
  else if (meetingsHeld >= 1) activityScore += 10;
  if (tasks.length > 0) activityScore += 20;

  // Generate insights
  const strengths: string[] = [];
  const improvements: string[] = [];
  const recommendations: string[] = [];

  if (callsConnected > 0 && (callsConnected / Math.max(callsMade, 1)) > 0.4) {
    strengths.push('Strong connection rate on calls');
  }
  if (callsMade < 10) {
    improvements.push('Low call volume — aim for at least 20 calls per period');
    recommendations.push('Block 2 hours daily for prospecting calls');
  }
  if (emailsOpened > 0 && emailsSent > 0 && (emailsOpened / emailsSent) > 0.3) {
    strengths.push('Good email open rates');
  }
  if (emailsReplied === 0 && emailsSent > 10) {
    improvements.push('No email replies received — review subject lines and personalization');
    recommendations.push('A/B test different email subject lines');
  }
  if (meetingsHeld >= 5) {
    strengths.push(`Strong meeting cadence — ${meetingsHeld} meetings this period`);
  }
  if (meetingsNoShow > 2) {
    improvements.push(`${meetingsNoShow} meeting no-shows — implement reminder sequences`);
    recommendations.push('Send calendar reminders 24h and 1h before meetings');
  }
  if (winRate > 20) {
    strengths.push(`Above-average win rate at ${winRate}%`);
  }
  if (winRate < 10 && leadsCreated > 5) {
    improvements.push(`Low win rate at ${winRate}% — review qualification criteria`);
    recommendations.push('Review ICP fit before adding leads to pipeline');
  }
  if (pipelineValue === 0 && leadsCreated > 0) {
    improvements.push('Pipeline value is zero — focus on qualifying leads');
  }

  const summary = [
    `${callsMade} calls (${callsConnected} connected), ${emailsSent} emails (${emailsReplied} replied), ${meetingsHeld} meetings held.`,
    winRate > 0 ? `Win rate: ${winRate}%.` : '',
    strengths.length > 0 ? `Strengths: ${strengths.join('; ')}.` : '',
    improvements.length > 0 ? `Areas to improve: ${improvements.join('; ')}.` : '',
  ].filter(Boolean).join(' ');

  const metrics: CoachingMetrics = {
    activityScore,
    callMetrics: { made: callsMade, connected: callsConnected, avgDuration, bookings },
    emailMetrics: { sent: emailsSent, opened: emailsOpened, replied: emailsReplied, positiveReplies },
    meetingMetrics: { held: meetingsHeld, noShows: meetingsNoShow, conversionRate: meetingConversion },
    pipelineMetrics: { created: leadsCreated, value: pipelineValue, won: leadsWon, winRate },
  };

  // Upsert coaching insight
  const insight = await prisma.coachingInsight.upsert({
    where: { orgId_userId_period: { orgId, userId, period } },
    update: {
      activityScore,
      callMetrics: metrics.callMetrics as any,
      emailMetrics: metrics.emailMetrics as any,
      meetingMetrics: metrics.meetingMetrics as any,
      pipelineMetrics: metrics.pipelineMetrics as any,
      strengths: JSON.stringify(strengths),
      improvements: JSON.stringify(improvements),
      recommendations: JSON.stringify(recommendations),
      summary,
    },
    create: {
      orgId,
      userId,
      period,
      periodType,
      activityScore,
      callMetrics: metrics.callMetrics as any,
      emailMetrics: metrics.emailMetrics as any,
      meetingMetrics: metrics.meetingMetrics as any,
      pipelineMetrics: metrics.pipelineMetrics as any,
      strengths: JSON.stringify(strengths),
      improvements: JSON.stringify(improvements),
      recommendations: JSON.stringify(recommendations),
      summary,
    },
  });

  return { ...insight, metrics };
}

export async function getCoachingInsights(orgId: string, userId?: string, limit: number = 20) {
  return prisma.coachingInsight.findMany({
    where: { orgId, ...(userId ? { userId } : {}) },
    orderBy: [{ period: 'desc' }, { activityScore: 'desc' }],
    take: limit,
    include: { user: { select: { id: true, name: true, email: true } } },
  });
}

export async function getTeamCoachingSummary(orgId: string, period: string) {
  const insights = await prisma.coachingInsight.findMany({
    where: { orgId, period },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { activityScore: 'desc' },
  });

  if (insights.length === 0) return null;

  const avgScore = Math.round(insights.reduce((s, i) => s + i.activityScore, 0) / insights.length);
  const topPerformer = insights[0];
  const needsHelp = insights.filter((i) => i.activityScore < 40);

  return {
    period,
    repCount: insights.length,
    averageScore: avgScore,
    topPerformer: topPerformer ? { name: topPerformer.user?.name, score: topPerformer.activityScore } : null,
    needsHelp: needsHelp.map((i) => ({ name: i.user?.name, score: i.activityScore, improvements: JSON.parse(i.improvements || '[]') as string[] })),
    insights,
  };
}
