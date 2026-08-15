import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { asyncHandler, ok } from '../lib/http';
import { requireAuth, type AuthedRequest } from '../middleware/auth';
import { scopedWhere } from '../middleware/auth';
import { OPEN_STATUSES } from '../constants';

const router = Router();

router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const scope = scopedWhere(user, user.orgId);
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalLeads, newLeads, qualifiedLeads, wonLeads, lostLeads,
      openLeads, weekLeads, monthLeads,
      pipelineValue, revenue,
      overdueCount, todayCount, upcomingCount,
    ] = await Promise.all([
      prisma.lead.count({ where: { ...scope, deletedAt: null } }),
      prisma.lead.count({ where: { ...scope, deletedAt: null, status: 'NEW' } }),
      prisma.lead.count({ where: { ...scope, deletedAt: null, status: 'QUALIFIED' } }),
      prisma.lead.count({ where: { ...scope, deletedAt: null, status: 'WON' } }),
      prisma.lead.count({ where: { ...scope, deletedAt: null, status: 'LOST' } }),
      prisma.lead.count({ where: { ...scope, deletedAt: null, status: { in: OPEN_STATUSES } } }),
      prisma.lead.count({ where: { ...scope, deletedAt: null, createdAt: { gte: weekAgo } } }),
      prisma.lead.count({ where: { ...scope, deletedAt: null, createdAt: { gte: monthAgo } } }),
      prisma.lead.aggregate({ where: { ...scope, deletedAt: null, status: { in: OPEN_STATUSES } }, _sum: { expectedValue: true } }),
      prisma.lead.aggregate({ where: { ...scope, deletedAt: null, status: 'WON' }, _sum: { expectedValue: true } }),
      prisma.task.count({ where: { orgId: user.orgId, status: 'PENDING', dueAt: { lt: now }, ...(user.role === 'SALES' ? { userId: user.id } : {}) } }),
      prisma.task.count({ where: { orgId: user.orgId, status: 'PENDING', dueAt: { gte: startOfToday, lt: endOfToday }, ...(user.role === 'SALES' ? { userId: user.id } : {}) } }),
      prisma.task.count({ where: { orgId: user.orgId, status: 'PENDING', dueAt: { gte: endOfToday }, ...(user.role === 'SALES' ? { userId: user.id } : {}) } }),
    ]);

    // Leads by source
    const bySourceRaw = (await (prisma.lead.groupBy as any)({
      by: ['source'],
      where: { ...scope, deletedAt: null },
      _count: { _all: true },
    })) as Array<{ source: string; _count: { _all: number } }>;
    const leadsBySource = bySourceRaw.map((r) => ({ source: r.source, count: r._count._all }));

    // Leads by owner
    const byOwnerRaw = (await (prisma.lead.groupBy as any)({
      by: ['ownerId'],
      where: { ...scope, deletedAt: null },
      _count: { _all: true },
    })) as Array<{ ownerId: string | null; _count: { _all: number } }>;
    const owners: Array<{ id: string; name: string; role: string }> = await prisma.user.findMany({
      where: { orgId: user.orgId, active: true },
      select: { id: true, name: true, role: true },
    });
    const leadsByOwner = byOwnerRaw
      .map((r) => ({
        name: owners.find((o) => o.id === r.ownerId)?.name || 'Unassigned',
        count: r._count._all,
      }))
      .sort((a, b) => b.count - a.count);

    // Last 14 days of lead creation + won for revenue trend
    const days: { date: string; label: string; leads: number; won: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
      const [leads, won] = await Promise.all([
        prisma.lead.count({ where: { ...scope, deletedAt: null, createdAt: { gte: dayStart, lt: dayEnd } } as any }),
        prisma.lead.count({ where: { ...scope, deletedAt: null, status: 'WON', createdAt: { gte: dayStart, lt: dayEnd } } as any }),
      ]);
      days.push({ date: dayStart.toISOString().slice(0, 10), label: dayStart.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }), leads, won });
    }

    // Conversion funnel
    const funnel = [
      { stage: 'New', value: newLeads },
      { stage: 'Contacted', value: await prisma.lead.count({ where: { ...scope, deletedAt: null, status: 'CONTACTED' } }) },
      { stage: 'Qualified', value: qualifiedLeads },
      { stage: 'Proposal', value: await prisma.lead.count({ where: { ...scope, deletedAt: null, status: 'PROPOSAL' } }) },
      { stage: 'Negotiation', value: await prisma.lead.count({ where: { ...scope, deletedAt: null, status: 'NEGOTIATION' } }) },
      { stage: 'Won', value: wonLeads },
    ];

    // Top salespeople by open leads + won value
    const topSalespeople = await Promise.all(
      owners.filter((o) => o.role === 'SALES').slice(0, 5).map(async (o) => {
        const open = await prisma.lead.count({ where: { orgId: user.orgId, ownerId: o.id, deletedAt: null, status: { in: OPEN_STATUSES } } });
        const won = await prisma.lead.aggregate({ where: { orgId: user.orgId, ownerId: o.id, deletedAt: null, status: 'WON' }, _sum: { expectedValue: true } });
        return { name: o.name, open, wonValue: won._sum.expectedValue || 0 };
      })
    );
    topSalespeople.sort((a, b) => b.wonValue - a.wonValue || b.open - a.open);

    // Recent leads + activity
    const recentLeads = await prisma.lead.findMany({
      where: { ...scope, deletedAt: null } as any,
      orderBy: { createdAt: 'desc' },
      take: 6,
      include: { owner: { select: { name: true } } },
    });
    const recentActivity = await prisma.activity.findMany({
      where: { orgId: user.orgId, ...(user.role === 'SALES' ? { userId: user.id } : {}) } as any,
      orderBy: { createdAt: 'desc' },
      take: 8,
      include: { user: { select: { name: true } }, lead: { select: { name: true } } },
    });

    // Today's + overdue follow-ups
    const [todaysTasks, overdueTasks] = await Promise.all([
      prisma.task.findMany({
        where: { orgId: user.orgId, status: 'PENDING', dueAt: { gte: startOfToday, lt: endOfToday }, ...(user.role === 'SALES' ? { userId: user.id } : {}) } as any,
        orderBy: { dueAt: 'asc' },
        include: { lead: { select: { id: true, name: true, phone: true } } },
      }),
      prisma.task.findMany({
        where: { orgId: user.orgId, status: 'MISSED', ...(user.role === 'SALES' ? { userId: user.id } : {}) } as any,
        orderBy: { dueAt: 'asc' },
        take: 10,
        include: { lead: { select: { id: true, name: true, phone: true } } },
      }),
    ]);

    const conversionRate = totalLeads > 0 ? Math.round((wonLeads / totalLeads) * 100) : 0;

    return ok(res, {
      cards: {
        totalLeads, newLeads, qualifiedLeads, wonLeads, openLeads,
        weekLeads, monthLeads,
        pipelineValue: pipelineValue._sum.expectedValue || 0,
        revenue: revenue._sum.expectedValue || 0,
        conversionRate,
        overdue: overdueCount,
        today: todayCount,
        upcoming: upcomingCount,
      },
      charts: {
        leadsBySource,
        leadsByOwner,
        trend: days,
        funnel,
        topSalespeople,
      },
      lists: {
        todaysTasks,
        overdueTasks,
        recentLeads,
        recentActivity,
      },
    });
  })
);

export default router;
