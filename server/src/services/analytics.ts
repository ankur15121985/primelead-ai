/**
 * Analytics Service (Phase 12, spec §53-55).
 *
 * Generates analytics snapshots (daily/weekly/monthly), computes dashboard
 * metrics, rep performance, pipeline analytics, and forecasting data.
 *
 * Snapshots are computed on-demand and cached in the AnalyticsSnapshot table.
 */
import { prisma } from '../lib/prisma';
import { OPEN_STATUSES } from '../constants';
import { paiseToRupees } from '../lib/money';

// ── Dashboard Metrics ───────────────────────────────────────

export async function getDashboardMetrics(orgId: string, days: number = 30) {
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [
    totalLeads, newLeads, openLeads, wonLeads, lostLeads,
    totalRevenue, pipelineValue,
    emailsSent, emailsOpened, emailsReplied, emailsBounced,
    callsMade, callsConnected,
    meetingsBooked, meetingsHeld,
    tasksCompleted, tasksPending, tasksOverdue,
    sequencesActive, sequencesEnrolled,
    websiteVisits, formSubmissions,
    bySource, byOwner, leadStages,
  ] = await Promise.all([
    prisma.lead.count({ where: { orgId, deletedAt: null } }),
    prisma.lead.count({ where: { orgId, deletedAt: null, createdAt: { gte: startDate } } }),
    prisma.lead.count({ where: { orgId, deletedAt: null, status: { in: [...OPEN_STATUSES] } } }),
    prisma.lead.count({ where: { orgId, deletedAt: null, status: 'WON' } }),
    prisma.lead.count({ where: { orgId, deletedAt: null, status: 'LOST' } }),
    prisma.lead.aggregate({ where: { orgId, deletedAt: null, status: 'WON' }, _sum: { expectedValue: true } }),
    prisma.lead.aggregate({ where: { orgId, deletedAt: null, status: { in: [...OPEN_STATUSES] } }, _sum: { expectedValue: true } }),
    prisma.sequenceEmailLog.count({ where: { orgId, sentAt: { gte: startDate } } }),
    prisma.sequenceEmailLog.count({ where: { orgId, openedAt: { not: null }, sentAt: { gte: startDate } } }),
    prisma.sequenceEmailLog.count({ where: { orgId, status: 'replied', sentAt: { gte: startDate } } }),
    prisma.sequenceEmailLog.count({ where: { orgId, status: 'bounced', sentAt: { gte: startDate } } }),
    prisma.call.count({ where: { orgId, createdAt: { gte: startDate } } }),
    prisma.call.count({ where: { orgId, status: 'CONNECTED', createdAt: { gte: startDate } } }),
    prisma.meeting.count({ where: { orgId, createdAt: { gte: startDate } } }),
    prisma.meeting.count({ where: { orgId, status: 'COMPLETED', createdAt: { gte: startDate } } }),
    prisma.task.count({ where: { orgId, status: 'DONE', updatedAt: { gte: startDate } } }),
    prisma.task.count({ where: { orgId, status: 'PENDING' } }),
    prisma.task.count({ where: { orgId, status: 'PENDING', dueAt: { lt: new Date() } } }),
    prisma.sequence.count({ where: { orgId, status: 'ACTIVE' } }),
    prisma.sequenceEnrollment.count({ where: { orgId, enrolledAt: { gte: startDate } } }),
    prisma.websiteVisit.count({ where: { orgId, visitedAt: { gte: startDate } } }),
    prisma.formSubmission.count({ where: { orgId, createdAt: { gte: startDate } } }),
    prisma.lead.groupBy({ by: ['source'], where: { orgId, deletedAt: null, createdAt: { gte: startDate } }, _count: { _all: true }, _sum: { expectedValue: true } }),
    prisma.lead.groupBy({ by: ['ownerId'], where: { orgId, deletedAt: null, createdAt: { gte: startDate } }, _count: { _all: true }, _sum: { expectedValue: true } }),
    prisma.lead.groupBy({ by: ['status'], where: { orgId, deletedAt: null }, _count: { _all: true } }),
  ]);

  // Get owner names
  const ownerIds = byOwner.map((o) => o.ownerId).filter(Boolean) as string[];
  const owners = ownerIds.length
    ? await prisma.user.findMany({ where: { id: { in: ownerIds }, orgId }, select: { id: true, name: true } })
    : [];
  const ownerMap = new Map(owners.map((o) => [o.id, o.name]));

  const winRate = (wonLeads + lostLeads) > 0 ? Math.round((wonLeads / (wonLeads + lostLeads)) * 100) : 0;
  const openRate = emailsSent > 0 ? Math.round((emailsOpened / emailsSent) * 100) : 0;
  const replyRate = emailsSent > 0 ? Math.round((emailsReplied / emailsSent) * 100) : 0;
  const connectionRate = callsMade > 0 ? Math.round((callsConnected / callsMade) * 100) : 0;
  const meetingRate = meetingsBooked > 0 ? Math.round((meetingsHeld / meetingsBooked) * 100) : 0;

  return {
    period: `${days}d`,
    // Leads
    totalLeads,
    newLeads,
    openLeads,
    wonLeads,
    lostLeads,
    winRate,
    // Revenue
    totalRevenue: paiseToRupees((totalRevenue._sum.expectedValue as number) || 0),
    pipelineValue: paiseToRupees((pipelineValue._sum.expectedValue as number) || 0),
    // Email
    emailsSent,
    emailsOpened,
    emailsReplied,
    emailsBounced,
    openRate,
    replyRate,
    bounceRate: emailsSent > 0 ? Math.round((emailsBounced / emailsSent) * 100) : 0,
    // Calls
    callsMade,
    callsConnected,
    connectionRate,
    // Meetings
    meetingsBooked,
    meetingsHeld,
    meetingRate,
    // Tasks
    tasksCompleted,
    tasksPending,
    tasksOverdue,
    // Sequences
    sequencesActive,
    sequencesEnrolled,
    // Inbound
    websiteVisits,
    formSubmissions,
    // Breakdowns
    bySource: bySource.map((s) => ({
      source: s.source,
      count: s._count._all,
      revenue: paiseToRupees((s._sum.expectedValue as number) || 0),
    })),
    byOwner: byOwner.map((o) => ({
      userId: o.ownerId,
      name: o.ownerId ? ownerMap.get(o.ownerId) || 'Unknown' : 'Unassigned',
      count: o._count._all,
      revenue: paiseToRupees((o._sum.expectedValue as number) || 0),
    })),
    byStage: leadStages.map((s) => ({
      status: s.status,
      count: s._count._all,
    })),
  };
}

// ── Rep Performance ─────────────────────────────────────────

export async function getRepPerformance(orgId: string, days: number = 30) {
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const users = await prisma.user.findMany({
    where: { orgId, active: true },
    select: { id: true, name: true, role: true },
  });

  const performance = await Promise.all(
    users.map(async (user) => {
      const [leads, wonLeads, tasks, calls, emails, meetings] = await Promise.all([
        prisma.lead.count({ where: { orgId, ownerId: user.id, deletedAt: null, createdAt: { gte: startDate } } }),
        prisma.lead.count({ where: { orgId, ownerId: user.id, deletedAt: null, status: 'WON', createdAt: { gte: startDate } } }),
        prisma.task.count({ where: { orgId, userId: user.id, status: 'DONE', updatedAt: { gte: startDate } } }),
        prisma.call.count({ where: { orgId, userId: user.id, createdAt: { gte: startDate } } }),
        prisma.sequenceEmailLog.count({ where: { orgId, sentAt: { gte: startDate } } }),
        prisma.meeting.count({ where: { orgId, hostId: user.id, createdAt: { gte: startDate } } }),
      ]);

      const revenue = await prisma.lead.aggregate({
        where: { orgId, ownerId: user.id, deletedAt: null, status: 'WON', createdAt: { gte: startDate } },
        _sum: { expectedValue: true },
      });

      return {
        userId: user.id,
        name: user.name,
        role: user.role,
        leads,
        wonLeads,
        winRate: leads > 0 ? Math.round((wonLeads / leads) * 100) : 0,
        tasks,
        calls,
        emails,
        meetings,
        revenue: paiseToRupees((revenue._sum.expectedValue as number) || 0),
      };
    })
  );

  return performance.sort((a, b) => b.revenue - a.revenue);
}

// ── Pipeline Analytics ──────────────────────────────────────

export async function getPipelineAnalytics(orgId: string) {
  const [pipelines, stageDistribution, dealAges, staleDeals] = await Promise.all([
    prisma.pipeline.findMany({
      where: { orgId },
      include: { stages: { include: { leads: { where: { deletedAt: null }, select: { id: true, expectedValue: true, createdAt: true, status: true, stageId: true } } } } },
    }),
    prisma.lead.groupBy({
      by: ['stageId'],
      where: { orgId, deletedAt: null, status: { in: [...OPEN_STATUSES] } },
      _count: { _all: true },
      _sum: { expectedValue: true },
    }),
    prisma.lead.findMany({
      where: { orgId, deletedAt: null, status: { in: [...OPEN_STATUSES] }, stageId: { not: null } },
      select: { id: true, name: true, expectedValue: true, createdAt: true, stageId: true, ownerId: true },
    }),
    prisma.lead.findMany({
      where: {
        orgId, deletedAt: null, status: { in: [...OPEN_STATUSES] },
        OR: [{ lastContactedAt: null }, { lastContactedAt: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } }],
      },
      select: { id: true, name: true, expectedValue: true, lastContactedAt: true },
      orderBy: { lastContactedAt: 'asc' },
      take: 10,
    }),
  ]);

  // Compute deal ages
  const avgDealAge = dealAges.length > 0
    ? Math.round(dealAges.reduce((sum, d) => sum + (Date.now() - new Date(d.createdAt).getTime()) / (24 * 60 * 60 * 1000), 0) / dealAges.length)
    : 0;

  return {
    pipelines: pipelines.map((p) => {
      const allLeads = p.stages.flatMap((s: any) => s.leads || []);
      return {
        id: p.id,
        name: p.name,
        totalDeals: allLeads.length,
        totalValue: allLeads.reduce((sum: number, l: any) => sum + (l.expectedValue || 0), 0),
        stages: p.stages.map((s: any) => ({
          id: s.id,
          name: s.name,
          order: s.order,
          leads: (s.leads || []).length,
          value: (s.leads || []).reduce((sum: number, l: any) => sum + (l.expectedValue || 0), 0),
        })),
      };
    }),
    stageDistribution: stageDistribution.map((s) => ({
      stageId: s.stageId,
      count: s._count._all,
      value: paiseToRupees((s._sum.expectedValue as number) || 0),
    })),
    avgDealAge,
    staleDeals: staleDeals.map((d) => ({
      id: d.id,
      name: d.name,
      value: paiseToRupees(d.expectedValue),
      daysSinceContact: d.lastContactedAt
        ? Math.floor((Date.now() - d.lastContactedAt.getTime()) / (24 * 60 * 60 * 1000))
        : 999,
    })),
  };
}

// ── Analytics Snapshot ──────────────────────────────────────

export async function generateSnapshot(orgId: string, period: 'DAILY' | 'WEEKLY' | 'MONTHLY') {
  const date = new Date();
  date.setHours(0, 0, 0, 0);

  const days = period === 'DAILY' ? 1 : period === 'WEEKLY' ? 7 : 30;
  const startDate = new Date(date.getTime() - days * 24 * 60 * 60 * 1000);

  const [
    newLeads, dealsCreated, dealsWon, dealsLost,
    emailsSent, emailsOpened, emailsReplied, emailsBounced,
    callsMade, callsConnected,
    meetingsBooked, meetingsHeld,
    tasksCompleted, websiteVisits, formSubmissions,
    revenueWon, pipelineValue,
  ] = await Promise.all([
    prisma.lead.count({ where: { orgId, deletedAt: null, createdAt: { gte: startDate } } }),
    prisma.lead.count({ where: { orgId, deletedAt: null, createdAt: { gte: startDate }, stageId: { not: null } } }),
    prisma.lead.count({ where: { orgId, deletedAt: null, status: 'WON', updatedAt: { gte: startDate } } }),
    prisma.lead.count({ where: { orgId, deletedAt: null, status: 'LOST', updatedAt: { gte: startDate } } }),
    prisma.sequenceEmailLog.count({ where: { orgId, sentAt: { gte: startDate } } }),
    prisma.sequenceEmailLog.count({ where: { orgId, openedAt: { not: null }, sentAt: { gte: startDate } } }),
    prisma.sequenceEmailLog.count({ where: { orgId, status: 'replied', sentAt: { gte: startDate } } }),
    prisma.sequenceEmailLog.count({ where: { orgId, status: 'bounced', sentAt: { gte: startDate } } }),
    prisma.call.count({ where: { orgId, createdAt: { gte: startDate } } }),
    prisma.call.count({ where: { orgId, status: 'CONNECTED', createdAt: { gte: startDate } } }),
    prisma.meeting.count({ where: { orgId, createdAt: { gte: startDate } } }),
    prisma.meeting.count({ where: { orgId, status: 'COMPLETED', createdAt: { gte: startDate } } }),
    prisma.task.count({ where: { orgId, status: 'DONE', updatedAt: { gte: startDate } } }),
    prisma.websiteVisit.count({ where: { orgId, visitedAt: { gte: startDate } } }),
    prisma.formSubmission.count({ where: { orgId, createdAt: { gte: startDate } } }),
    prisma.lead.aggregate({ where: { orgId, deletedAt: null, status: 'WON', updatedAt: { gte: startDate } }, _sum: { expectedValue: true } }),
    prisma.lead.aggregate({ where: { orgId, deletedAt: null, status: { in: [...OPEN_STATUSES] } }, _sum: { expectedValue: true } }),
  ]);

  // Check if snapshot already exists for this period+date
  const existing = await prisma.analyticsSnapshot.findFirst({
    where: { orgId, period, date },
  });

  const snapshotData = {
    orgId, period, date,
    newLeads, dealsCreated, dealsWon, dealsLost,
    revenueWon: (revenueWon._sum.expectedValue as number) || 0,
    pipelineValue: (pipelineValue._sum.expectedValue as number) || 0,
    emailsSent, emailsOpened, emailsReplied, emailsBounced,
    callsMade, callsConnected,
    meetingsBooked, meetingsHeld,
    tasksCompleted,
    websiteVisits, formSubmissions,
  };

  if (existing) {
    return prisma.analyticsSnapshot.update({ where: { id: existing.id }, data: snapshotData });
  }
  return prisma.analyticsSnapshot.create({ data: snapshotData });
}

export async function getSnapshots(orgId: string, period: string, limit: number = 30) {
  return prisma.analyticsSnapshot.findMany({
    where: { orgId, period },
    orderBy: { date: 'desc' },
    take: limit,
  });
}

// ── Revenue Forecast ────────────────────────────────────────

export async function getRevenueForecast(orgId: string) {
  const openLeads = await prisma.lead.findMany({
    where: { orgId, deletedAt: null, status: { in: [...OPEN_STATUSES] }, expectedValue: { gt: 0 } },
    select: { id: true, name: true, expectedValue: true, stageId: true, createdAt: true, ownerId: true, priority: true },
  });

  const wonLeads30d = await prisma.lead.count({
    where: { orgId, deletedAt: null, status: 'WON', updatedAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
  });

  const totalLeads30d = await prisma.lead.count({
    where: { orgId, deletedAt: null, updatedAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
  });

  const historicalWinRate = totalLeads30d > 0 ? wonLeads30d / totalLeads30d : 0.2;

  // Stage-based probability mapping (convention: higher stage = closer to close)
  const stageWeights: Record<string, number> = {};
  const stages = await prisma.pipelineStage.findMany({ where: { orgId }, orderBy: { order: 'asc' } });
  stages.forEach((s, i) => { stageWeights[s.id] = 0.2 + (i / Math.max(stages.length - 1, 1)) * 0.6; });

  let bestCase = 0;
  let commit = 0;
  let pipeline = 0;

  for (const lead of openLeads) {
    const value = paiseToRupees(lead.expectedValue);
    pipeline += value;
    const stageProb = lead.stageId ? (stageWeights[lead.stageId] || 0.3) : 0.3;
    const prob = stageProb * historicalWinRate;
    bestCase += value;
    commit += value * prob;
  }

  return {
    pipelineValue: pipeline,
    bestCase: Math.round(bestCase),
    commit: Math.round(commit),
    historicalWinRate: Math.round(historicalWinRate * 100),
    openDeals: openLeads.length,
    avgDealSize: openLeads.length > 0 ? Math.round(pipeline / openLeads.length) : 0,
    risks: openLeads
      .filter((l) => l.priority === 'LOW' || !stageWeights[l.stageId || ''])
      .map((l) => ({ id: l.id, name: l.name, value: paiseToRupees(l.expectedValue), reason: 'Low priority or unknown stage' })),
  };
}
