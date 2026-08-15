/**
 * Reports & analytics.
 *  - GET /            aggregated report for a date range (default: last 30 days)
 *  - GET /export      same data as CSV
 *
 * Every aggregation is org-scoped; SALES users only see their own leads.
 */
import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { asyncHandler, ok } from '../lib/http';
import { requireAuth, requirePermission, scopedWhere, type AuthedRequest } from '../middleware/auth';
import { sourceLabel } from '../constants';
import { csvEscape } from '../services/leads';
import { paiseToRupees } from '../lib/money';

const router = Router();
router.use(requireAuth);

function dateRange(q: Record<string, string>) {
  const now = new Date();
  let from = q.from ? new Date(q.from) : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  let to = q.to ? new Date(q.to) : now;
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) throw new Error('Invalid date range');
  // Cap the window at 366 days so huge ranges can't balloon the trend array.
  const MAX_SPAN = 366 * 24 * 60 * 60 * 1000;
  if (to.getTime() - from.getTime() > MAX_SPAN) from = new Date(to.getTime() - MAX_SPAN);
  return { from, to };
}

/** Bucket a count per calendar day within the range (all zero-filled). */
function fillDays(from: Date, to: Date, points: Array<{ day: string; count: number }>) {
  const map = new Map(points.map((p) => [p.day, p.count]));
  const out: Array<{ day: string; count: number }> = [];
  const cursor = new Date(from);
  cursor.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(23, 59, 59, 999);
  while (cursor <= end) {
    const day = cursor.toISOString().slice(0, 10);
    out.push({ day, count: map.get(day) || 0 });
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

router.get(
  '/',
  requirePermission('reports.view'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const q = req.query as Record<string, string>;
    const { from, to } = dateRange(q);
    const scope = scopedWhere(user, user.orgId);

    const created = { gte: from, lte: to };
    const leadWhere = { ...scope, deletedAt: null, createdAt: created };
    const activityWhere = { ...scope, createdAt: created };

    const [
      leadsCreated,
      leadsWon,
      leadsLost,
      bySource,
      byOwner,
      byStatus,
      byStage,
      trend,
      tasksDone,
      tasksMissed,
      quotationsCount,
      quotationValue,
      invoicesCount,
      invoiceValue,
      revenue,
      activityCount,
    ] = await Promise.all([
      prisma.lead.count({ where: leadWhere }),
      prisma.lead.count({ where: { ...leadWhere, status: 'WON' } }),
      prisma.lead.count({ where: { ...leadWhere, status: 'LOST' } }),
      prisma.lead.groupBy({ by: ['source'], where: leadWhere, _count: { _all: true } }),
      prisma.lead.groupBy({ by: ['ownerId'], where: leadWhere, _count: { _all: true } }),
      prisma.lead.groupBy({ by: ['status'], where: leadWhere, _count: { _all: true } }),
      prisma.lead.groupBy({ by: ['stageId'], where: leadWhere, _count: { _all: true } }),
      prisma.lead.groupBy({
        by: ['createdAt'],
        where: leadWhere,
        _count: { _all: true },
      }),
      prisma.task.count({ where: { ...scope, status: 'DONE', completedAt: { gte: from, lte: to } } }),
      prisma.task.count({ where: { ...scope, status: 'MISSED', dueAt: { gte: from, lte: to } } }),
      prisma.quotation.count({ where: { ...scope, createdAt: created } }),
      prisma.quotation.aggregate({ where: { ...scope, createdAt: created }, _sum: { total: true } }),
      prisma.invoice.count({ where: { ...scope, createdAt: created } }),
      prisma.invoice.aggregate({ where: { ...scope, createdAt: created }, _sum: { total: true } }),
      prisma.invoice.aggregate({ where: { ...scope, status: 'PAID', createdAt: created }, _sum: { total: true } }),
      prisma.activity.count({ where: activityWhere }),
    ]);

    // owner names
    const ownerIds = byOwner.map((o) => o.ownerId).filter(Boolean) as string[];
    const owners = ownerIds.length
      ? await prisma.user.findMany({ where: { id: { in: ownerIds }, orgId: user.orgId }, select: { id: true, name: true } })
      : [];
    const ownerName = new Map(owners.map((o) => [o.id, o.name]));

    // stage names
    const stageIds = byStage.map((s) => s.stageId).filter(Boolean) as string[];
    const stages = stageIds.length
      ? await prisma.pipelineStage.findMany({ where: { id: { in: stageIds } }, select: { id: true, name: true } })
      : [];
    const stageName = new Map(stages.map((s) => [s.id, s.name]));

    const sourceData = bySource.map((s) => ({ source: s.source, label: sourceLabel(s.source || 'MANUAL'), count: s._count._all })).sort((a, b) => b.count - a.count);
    const ownerData = byOwner.map((o) => ({ name: (o.ownerId && ownerName.get(o.ownerId)) || 'Unassigned', count: o._count._all })).sort((a, b) => b.count - a.count);
    const statusData = byStatus.map((s) => ({ status: s.status || 'NEW', count: s._count._all }));
    const stageData = byStage.map((s) => ({ name: (s.stageId && stageName.get(s.stageId)) || 'No stage', count: s._count._all }));
    const trendData = fillDays(
      from,
      to,
      (trend as Array<{ createdAt: Date; _count: { _all: number } }>).map((t) => ({ day: t.createdAt.toISOString().slice(0, 10), count: t._count._all }))
    );

    const closed = leadsWon + leadsLost;

    return ok(res, {
      range: { from: from.toISOString(), to: to.toISOString() },
      cards: {
        leadsCreated,
        leadsWon,
        leadsLost,
        conversionRate: leadsCreated ? Math.round((leadsWon / leadsCreated) * 100) : 0,
        winRate: closed ? Math.round((leadsWon / closed) * 100) : 0,
        openLeads: leadsCreated - (leadsWon + leadsLost),
        tasksDone,
        tasksMissed,
        quotationsCount,
        quotationValue: paiseToRupees(quotationValue._sum.total || 0),
        invoicesCount,
        invoiceValue: paiseToRupees(invoiceValue._sum.total || 0),
        revenue: paiseToRupees(revenue._sum.total || 0),
        activityCount,
      },
      charts: {
        bySource: sourceData,
        byOwner: ownerData,
        byStatus: statusData,
        byStage: stageData,
        trend: trendData,
      },
    });
  })
);

router.get(
  '/export',
  requirePermission('reports.export'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const q = req.query as Record<string, string>;
    const { from, to } = dateRange(q);
    const scope = scopedWhere(user, user.orgId);
    const leadWhere = { ...scope, deletedAt: null, createdAt: { gte: from, lte: to } };

    const [bySource, byStatus] = await Promise.all([
      prisma.lead.groupBy({ by: ['source'], where: leadWhere, _count: { _all: true } }),
      prisma.lead.groupBy({ by: ['status'], where: leadWhere, _count: { _all: true } }),
    ]);

    const lines = [
      ['Report', 'Value'],
      ['Generated', new Date().toISOString()],
      ['From', from.toISOString().slice(0, 10)],
      ['To', to.toISOString().slice(0, 10)],
      [],
      ['Leads by source', 'Count'],
      ...bySource.map((s) => [sourceLabel(s.source || 'MANUAL'), String(s._count._all)]),
      [],
      ['Leads by status', 'Count'],
      ...byStatus.map((s) => [s.status || 'NEW', String(s._count._all)]),
    ];
    const csv = lines.map((row) => row.map(csvEscape).join(',')).join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="report-${from.toISOString().slice(0, 10)}-${to.toISOString().slice(0, 10)}.csv"`);
    return res.send(csv);
  })
);

export default router;
