/**
 * Data Quality Center — scan for duplicates, stale data, missing fields.
 *  - GET    /report       full quality report
 *  - GET    /duplicates   list duplicate groups
 *  - GET    /stale        list stale records
 *  - POST   /merge        merge duplicate records
 */
import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { asyncHandler, badRequest, notFound, ok, validate } from '../lib/http';
import { requireAuth, requirePermission, type AuthedRequest } from '../middleware/auth';
import { generateQualityReport } from '../services/data-quality';
import { z } from 'zod';

const router = Router();
router.use(requireAuth);

router.get('/report', requirePermission('contacts.view'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const report = await generateQualityReport(user.orgId);
  return ok(res, { report });
}));

router.get('/duplicates', requirePermission('contacts.view'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const q = req.query as Record<string, string>;
  const entityType = q.type || 'company';

  if (entityType === 'company') {
    // Find companies with same domain
    const companies = await prisma.company.findMany({
      where: { orgId: user.orgId, deletedAt: null, domain: { not: null } },
      select: { id: true, name: true, domain: true, createdAt: true },
    });

    const domainMap = new Map<string, typeof companies>();
    for (const c of companies) {
      if (!c.domain) continue;
      const existing = domainMap.get(c.domain) || [];
      existing.push(c);
      domainMap.set(c.domain, existing);
    }

    const groups = Array.from(domainMap.entries())
      .filter(([, group]) => group.length > 1)
      .map(([domain, group]) => ({ domain, count: group.length, items: group }));

    return ok(res, { groups, total: groups.length });
  } else {
    // Find contacts with same email
    const contacts = await (prisma as any).companyContact.findMany({
      where: { orgId: user.orgId, deletedAt: null, email: { not: null } },
      select: { id: true, firstName: true, lastName: true, email: true, createdAt: true },
    });

    const emailMap = new Map<string, typeof contacts>();
    for (const c of contacts) {
      if (!c.email) continue;
      const existing = emailMap.get(c.email) || [];
      existing.push(c);
      emailMap.set(c.email, existing);
    }

    const groups = Array.from(emailMap.entries())
      .filter(([, group]) => group.length > 1)
      .map(([email, group]) => ({ email, count: group.length, items: group }));

    return ok(res, { groups, total: groups.length });
  }
}));

router.get('/stale', requirePermission('contacts.view'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const q = req.query as Record<string, string>;
  const days = Number(q.days) || 90;
  const entityType = q.type || 'contact';

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  if (entityType === 'company') {
    const stale = await prisma.company.findMany({
      where: { orgId: user.orgId, deletedAt: null, updatedAt: { lt: cutoff } },
      select: { id: true, name: true, domain: true, updatedAt: true },
      orderBy: { updatedAt: 'asc' },
      take: 100,
    });
    return ok(res, { records: stale, total: stale.length });
  } else {
    const stale = await (prisma as any).companyContact.findMany({
      where: { orgId: user.orgId, deletedAt: null, updatedAt: { lt: cutoff } },
      select: { id: true, firstName: true, lastName: true, email: true, updatedAt: true },
      orderBy: { updatedAt: 'asc' },
      take: 100,
    });
    return ok(res, { records: stale, total: stale.length });
  }
}));

router.post('/merge', requirePermission('contacts.edit'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const input = validate(z.object({
    entityType: z.enum(['company', 'contact']),
    keepId: z.string().min(1, 'ID to keep is required'),
    removeIds: z.array(z.string()).min(1).max(10),
  }), req.body);

  if (input.entityType === 'company') {
    // Verify all belong to org
    const keep = await prisma.company.findFirst({ where: { id: input.keepId, orgId: user.orgId, deletedAt: null } });
    if (!keep) throw notFound('Company to keep not found');

    // Soft-delete the duplicates
    await prisma.company.updateMany({
      where: { id: { in: input.removeIds }, orgId: user.orgId },
      data: { deletedAt: new Date() },
    });

    return ok(res, { merged: true, removed: input.removeIds.length });
  } else {
    const keep = await (prisma as any).companyContact.findFirst({ where: { id: input.keepId, orgId: user.orgId, deletedAt: null } });
    if (!keep) throw notFound('Contact to keep not found');

    await (prisma as any).companyContact.updateMany({
      where: { id: { in: input.removeIds }, orgId: user.orgId },
      data: { deletedAt: new Date() },
    });

    return ok(res, { merged: true, removed: input.removeIds.length });
  }
}));

export default router;
