/**
 * Super-admin dashboard routes — for the website handler / developer.
 * Gated by requireAuth + requireSuperAdmin (SUPER_ADMIN_EMAILS env).
 * These intentionally span ALL organizations.
 */
import { Router } from 'express';
import os from 'os';
import { prisma } from '../lib/prisma';
import { asyncHandler, badRequest, ok, validate } from '../lib/http';
import { requireAuth, type AuthedRequest } from '../middleware/auth';
import { requireSuperAdmin } from '../middleware/admin';
import { z } from 'zod';
import { recentErrors, uptimeSeconds, clearErrors } from '../lib/server-log';
import { OPEN_STATUSES } from '../constants';
import { audit } from '../lib/audit';
import { publicUser } from '../lib/serializers';

const router = Router();
router.use(requireAuth, requireSuperAdmin);

const orgStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
  plan: z.enum(['STARTER', 'GROWTH', 'BUSINESS']).optional(),
});

const userStatusSchema = z.object({
  active: z.boolean().optional(),
  role: z.enum(['OWNER', 'ADMIN', 'MANAGER', 'SALES']).optional(),
});

/** Counts + aggregates shared across overview and org list. */
async function orgStats(orgIds?: string[]) {
  const where = orgIds ? { orgId: { in: orgIds } } : {};
  const [userCounts, leadCounts, openLeadCounts, pipelineValue, overdue, qrCounts] = await Promise.all([
    prisma.user.groupBy({ by: ['orgId'], where, _count: { _all: true } }),
    prisma.lead.groupBy({ by: ['orgId'], where: { ...where, deletedAt: null }, _count: { _all: true } }),
    prisma.lead.groupBy({
      by: ['orgId'],
      where: { ...where, deletedAt: null, status: { in: [...OPEN_STATUSES] } },
      _count: { _all: true },
    }),
    prisma.lead.groupBy({
      by: ['orgId'],
      where: { ...where, deletedAt: null, status: { in: [...OPEN_STATUSES] } },
      _sum: { expectedValue: true },
    }),
    prisma.task.groupBy({ by: ['orgId'], where: { status: 'MISSED' }, _count: { _all: true } }),
    prisma.qrCode.groupBy({ by: ['orgId'], where, _count: { _all: true } }),
  ]);

  const index = <T extends { orgId: string }>(rows: T[]) => {
    const m = new Map<string, T>();
    for (const r of rows) m.set(r.orgId, r);
    return m;
  };
  const byUser = index(userCounts);
  const byLead = index(leadCounts);
  const byOpen = index(openLeadCounts);
  const byValue = index(pipelineValue);
  const byOverdue = index(overdue);
  const byQr = index(qrCounts);

  return (orgId: string) => ({
    users: byUser.get(orgId)?._count._all ?? 0,
    leads: byLead.get(orgId)?._count._all ?? 0,
    openLeads: byOpen.get(orgId)?._count._all ?? 0,
    pipelineValue: byValue.get(orgId)?._sum.expectedValue ?? 0,
    overdueTasks: byOverdue.get(orgId)?._count._all ?? 0,
    qrCodes: byQr.get(orgId)?._count._all ?? 0,
  });
}

router.get(
  '/overview',
  asyncHandler(async (_req, res) => {
    const [orgCount, activeOrgs, userCount, leadCount, wonCount, wonValue, qrCount, quotationCount, invoiceCount, errors, newOrgs] =
      await Promise.all([
        prisma.organization.count(),
        prisma.organization.count({ where: { status: 'ACTIVE' } }),
        prisma.user.count(),
        prisma.lead.count({ where: { deletedAt: null } }),
        prisma.lead.count({ where: { deletedAt: null, status: 'WON' } }),
        prisma.lead.aggregate({ where: { deletedAt: null, status: 'WON' }, _sum: { expectedValue: true } }),
        prisma.qrCode.count(),
        prisma.quotation.count(),
        prisma.invoice.count(),
        Promise.resolve(recentErrors(20)),
        prisma.organization.findMany({ orderBy: { createdAt: 'desc' }, take: 8, select: { id: true, name: true, plan: true, status: true, createdAt: true } }),
      ]);

    const orgs = await prisma.organization.findMany({
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, slug: true, plan: true, status: true, businessType: true, createdAt: true, updatedAt: true },
    });
    const stats = await orgStats(orgs.map((o) => o.id));

    return ok(res, {
      totals: {
        organizations: orgCount,
        activeOrganizations: activeOrgs,
        suspendedOrganizations: orgCount - activeOrgs,
        users: userCount,
        leads: leadCount,
        wonLeads: wonCount,
        wonValue: wonValue._sum.expectedValue ?? 0,
        qrCodes: qrCount,
        quotations: quotationCount,
        invoices: invoiceCount,
      },
      organizations: orgs.map((o) => ({ ...o, ...stats(o.id) })),
      recentOrganizations: newOrgs,
      recentErrors: errors,
    });
  })
);

router.get(
  '/orgs',
  asyncHandler(async (_req, res) => {
    const orgs = await prisma.organization.findMany({
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, slug: true, plan: true, status: true, businessType: true, logoUrl: true, createdAt: true, updatedAt: true },
    });
    const stats = await orgStats(orgs.map((o) => o.id));
    return ok(res, { organizations: orgs.map((o) => ({ ...o, ...stats(o.id) })) });
  })
);

router.get(
  '/orgs/:id',
  asyncHandler(async (req, res) => {
    const org = await prisma.organization.findUnique({ where: { id: req.params.id } });
    if (!org) throw badRequest('Organization not found.');

    const [users, leads, recentActivity, sub, stats] = await Promise.all([
      prisma.user.findMany({ where: { orgId: org.id }, orderBy: { createdAt: 'asc' } }),
      // (users sanitized below via publicUser)
      prisma.lead.findMany({
        where: { orgId: org.id, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 15,
        include: { owner: { select: { name: true } } },
      }),
      prisma.activity.findMany({ where: { orgId: org.id }, orderBy: { createdAt: 'desc' }, take: 15, include: { user: { select: { name: true } }, lead: { select: { name: true } } } }),
      prisma.subscription.findUnique({ where: { orgId: org.id }, include: { plan: true } }),
      orgStats([org.id]),
    ]);

    return ok(res, {
      org,
      users: users.map(publicUser),
      recentLeads: leads,
      recentActivity,
      subscription: sub,
      stats: stats(org.id),
    });
  })
);

router.patch(
  '/orgs/:id',
  asyncHandler(async (req, res) => {
    const actor = (req as AuthedRequest).user;
    const input = validate(orgStatusSchema, req.body);
    const org = await prisma.organization.findUnique({ where: { id: req.params.id } });
    if (!org) throw badRequest('Organization not found.');

    const updated = await prisma.organization.update({
      where: { id: org.id },
      data: {
        status: input.status ?? undefined,
        plan: input.plan ?? undefined,
      },
    });

    await audit({
      orgId: org.id,
      userId: actor.id,
      action: input.status ? `ORG_${input.status}` : 'ORG_PLAN_CHANGED',
      entity: 'Organization',
      entityId: org.id,
      metadata: { ...input, by: actor.email },
      req,
    });

    return ok(res, { org: updated });
  })
);

router.get(
  '/users',
  asyncHandler(async (_req, res) => {
    const users = await prisma.user.findMany({
      orderBy: [{ active: 'desc' }, { createdAt: 'desc' }],
      include: { org: { select: { id: true, name: true, plan: true, status: true } } },
      take: 500,
    });
    return ok(res, {
      users: users.map((u) => ({ ...publicUser(u), org: u.org })),
    });
  })
);

router.patch(
  '/users/:id',
  asyncHandler(async (req, res) => {
    const actor = (req as AuthedRequest).user;
    const input = validate(userStatusSchema, req.body);
    const user = await prisma.user.findUnique({ where: { id: req.params.id }, include: { org: true } });
    if (!user) throw badRequest('User not found.');

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { active: input.active ?? undefined, role: input.role ?? undefined },
    });

    await audit({
      orgId: user.orgId,
      userId: actor.id,
      action: input.active === false ? 'USER_DEACTIVATED' : input.active === true ? 'USER_ACTIVATED' : 'USER_ROLE_CHANGED',
      entity: 'User',
      entityId: user.id,
      metadata: { ...input, by: actor.email },
      req,
    });

    return ok(res, { user: publicUser(updated) });
  })
);

router.get(
  '/system',
  asyncHandler(async (_req, res) => {
    const dbOk = await prisma.$queryRawUnsafe('SELECT 1').catch(() => null);
    const [errorCount] = await Promise.all([Promise.resolve(recentErrors(50).length)]);
    return ok(res, {
      uptimeSeconds: uptimeSeconds(),
      startedAt: new Date(Date.now() - uptimeSeconds() * 1000).toISOString(),
      node: process.version,
      platform: `${process.platform} ${process.arch}`,
      memory: {
        rss: process.memoryUsage().rss,
        heapUsed: process.memoryUsage().heapUsed,
        heapTotal: process.memoryUsage().heapTotal,
        external: process.memoryUsage().external,
      },
      loadAvg: os.loadavg(),
      cpus: os.cpus().length,
      database: dbOk ? { connected: true, provider: 'sqlite' } : { connected: false },
      recentErrorCount: errorCount,
      env: {
        NODE_ENV: process.env.NODE_ENV || 'development',
        APP_URL: process.env.APP_URL || 'http://localhost:5173',
        AI_PROVIDER: process.env.AI_PROVIDER || '',
        AI_MODEL: process.env.AI_MODEL || '',
        superAdminEmails: process.env.SUPER_ADMIN_EMAILS || '(not set)',
      },
    });
  })
);

router.post('/system/clear-errors', asyncHandler(async (_req, res) => {
  clearErrors();
  return ok(res, { cleared: true });
}));

export default router;
