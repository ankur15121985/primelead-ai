/**
 * Saved Searches — save, share, and alert on search results.
 *  - GET    /          list saved searches
 *  - POST   /          create
 *  - GET    /:id       one + execute
 *  - PATCH  /:id       update
 *  - DELETE /:id       remove
 *  - POST   /:id/execute   re-run and get fresh results
 */
import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { asyncHandler, notFound, ok, validate } from '../lib/http';
import { requireAuth, requirePermission, type AuthedRequest } from '../middleware/auth';
import { executeSearch, type SearchFilter } from '../services/search';
import { z } from 'zod';

const router = Router();
router.use(requireAuth);

router.get(
  '/',
  requirePermission('contacts.view'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const q = req.query as Record<string, string>;

    const where: Record<string, unknown> = { orgId: user.orgId };
    if (q.entityType) where.entityType = q.entityType;
    if (q.shared === 'true') where.isShared = true;
    else where.OR = [{ userId: user.id }, { isShared: true }];

    const searches = await (prisma as any).savedSearch.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });

    return ok(res, { searches });
  })
);

router.post(
  '/',
  requirePermission('contacts.view'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const input = validate(savedSearchCreateSchema, req.body);

    const search = await (prisma as any).savedSearch.create({
      data: {
        orgId: user.orgId,
        userId: user.id,
        name: input.name.trim(),
        description: input.description?.trim() || null,
        entityType: input.entityType,
        filters: input.filters,
        isShared: input.isShared || false,
        alertEnabled: input.alertEnabled || false,
      },
    });

    return ok(res, { search }, 201);
  })
);

router.get(
  '/:id',
  requirePermission('contacts.view'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const search = await (prisma as any).savedSearch.findFirst({
      where: { id: req.params.id, orgId: user.orgId },
    });
    if (!search) throw notFound('Saved search not found');
    return ok(res, { search });
  })
);

router.patch(
  '/:id',
  requirePermission('contacts.view'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const existing = await (prisma as any).savedSearch.findFirst({
      where: { id: req.params.id, orgId: user.orgId },
    });
    if (!existing) throw notFound('Saved search not found');

    const input = validate(savedSearchUpdateSchema, req.body);
    const search = await (prisma as any).savedSearch.update({
      where: { id: existing.id },
      data: {
        ...(input.name !== undefined && { name: input.name.trim() }),
        ...(input.description !== undefined && { description: input.description?.trim() || null }),
        ...(input.filters !== undefined && { filters: input.filters }),
        ...(input.isShared !== undefined && { isShared: input.isShared }),
        ...(input.alertEnabled !== undefined && { alertEnabled: input.alertEnabled }),
      },
    });

    return ok(res, { search });
  })
);

router.delete(
  '/:id',
  requirePermission('contacts.view'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const existing = await (prisma as any).savedSearch.findFirst({
      where: { id: req.params.id, orgId: user.orgId },
    });
    if (!existing) throw notFound('Saved search not found');
    await (prisma as any).savedSearch.delete({ where: { id: existing.id } });
    return ok(res, { deleted: true });
  })
);

// Re-execute a saved search and return fresh results
router.post(
  '/:id/execute',
  requirePermission('contacts.view'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const search = await (prisma as any).savedSearch.findFirst({
      where: { id: req.params.id, orgId: user.orgId },
    });
    if (!search) throw notFound('Saved search not found');

    const filters: SearchFilter[] = (search.filters as SearchFilter[]) || [];
    const result = await executeSearch(
      {
        entityType: search.entityType,
        filters,
        page: 1,
        pageSize: 100,
      },
      user.orgId,
    );

    // Update result count
    await (prisma as any).savedSearch.update({
      where: { id: search.id },
      data: { resultCount: result.total },
    });

    return ok(res, { search, results: result });
  })
);

// ── Schemas ──────────────────────────────────────────────────

const savedSearchCreateSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  description: z.string().trim().max(500).optional().nullable(),
  entityType: z.enum(['companies', 'contacts', 'leads']).default('companies'),
  filters: z.array(z.object({
    field: z.string(),
    operator: z.string(),
    value: z.unknown(),
  })),
  isShared: z.boolean().optional(),
  alertEnabled: z.boolean().optional(),
});

const savedSearchUpdateSchema = savedSearchCreateSchema.partial();

export default router;
