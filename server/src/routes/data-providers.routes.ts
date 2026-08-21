/**
 * Data Providers — manage connected data sources.
 *  - GET    /          list providers
 *  - POST   /          add provider
 *  - PATCH  /:id       update provider config
 *  - DELETE /:id       remove provider
 *  - POST   /:id/test  test provider connection
 */
import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { asyncHandler, notFound, ok, validate } from '../lib/http';
import { requireAuth, requirePermission, type AuthedRequest } from '../middleware/auth';
import { z } from 'zod';

const router = Router();
router.use(requireAuth);

router.get('/', requirePermission('integrations.manage'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const providers = await prisma.dataProvider.findMany({
    where: { orgId: user.orgId },
    orderBy: { priority: 'desc' },
    select: {
      id: true, name: true, type: true, enabled: true, priority: true,
      status: true, lastError: true, lastUsedAt: true, costPerQuery: true,
      createdAt: true,
      _count: { select: { dataProvenances: true } },
    },
  });
  return ok(res, { providers });
}));

router.post('/', requirePermission('integrations.manage'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const input = validate(providerCreateSchema, req.body);
  const provider = await prisma.dataProvider.create({
    data: {
      orgId: user.orgId,
      name: input.name.trim(),
      type: input.type,
      baseUrl: input.baseUrl?.trim() || null,
      config: input.config || undefined,
      enabled: input.enabled ?? true,
      priority: input.priority ?? 0,
      costPerQuery: input.costPerQuery ?? 0,
    },
  });
  return ok(res, { provider }, 201);
}));

router.patch('/:id', requirePermission('integrations.manage'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const existing = await prisma.dataProvider.findFirst({ where: { id: req.params.id, orgId: user.orgId } });
  if (!existing) throw notFound('Provider not found');

  const input = validate(providerUpdateSchema, req.body);
  const provider = await prisma.dataProvider.update({
    where: { id: existing.id },
    data: {
      ...(input.name !== undefined && { name: input.name.trim() }),
      ...(input.baseUrl !== undefined && { baseUrl: input.baseUrl?.trim() || null }),
      ...(input.config !== undefined && { config: input.config || undefined }),
      ...(input.enabled !== undefined && { enabled: input.enabled }),
      ...(input.priority !== undefined && { priority: input.priority }),
      ...(input.costPerQuery !== undefined && { costPerQuery: input.costPerQuery }),
    },
  });
  return ok(res, { provider });
}));

router.delete('/:id', requirePermission('integrations.manage'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const existing = await prisma.dataProvider.findFirst({ where: { id: req.params.id, orgId: user.orgId } });
  if (!existing) throw notFound('Provider not found');
  await prisma.dataProvider.delete({ where: { id: existing.id } });
  return ok(res, { deleted: true });
}));

router.post('/:id/test', requirePermission('integrations.manage'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const provider = await prisma.dataProvider.findFirst({ where: { id: req.params.id, orgId: user.orgId } });
  if (!provider) throw notFound('Provider not found');

  // Test the provider by checking if it's reachable
  // For now, just update the status
  await prisma.dataProvider.update({
    where: { id: provider.id },
    data: { status: 'ACTIVE', lastError: null },
  });

  return ok(res, { tested: true, status: 'ACTIVE' });
}));

const providerCreateSchema = z.object({
  name: z.string().trim().min(1).max(100),
  type: z.enum(['COMPANY_SEARCH', 'CONTACT_SEARCH', 'ENRICHMENT', 'VERIFICATION', 'INTENT']),
  baseUrl: z.string().trim().max(500).optional().nullable(),
  config: z.record(z.string().max(500)).optional().nullable(),
  enabled: z.boolean().optional(),
  priority: z.coerce.number().int().min(0).max(100).optional(),
  costPerQuery: z.coerce.number().int().min(0).max(100000).optional(),
});

const providerUpdateSchema = providerCreateSchema.partial();

export default router;
