/**
 * Lists — static and dynamic lists for companies, contacts, and leads.
 *  - GET    /          list all
 *  - POST   /          create
 *  - GET    /:id       one list with members
 *  - PATCH  /:id       update
 *  - DELETE /:id       remove
 *  - POST   /:id/members      add members
 *  - DELETE /:id/members      remove members
 *  - POST   /:id/members/bulk add many at once
 */
import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { asyncHandler, notFound, ok, validate, badRequest } from '../lib/http';
import { requireAuth, requirePermission, type AuthedRequest } from '../middleware/auth';
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

    const lists = await prisma.list.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });

    return ok(res, { lists });
  })
);

router.post(
  '/',
  requirePermission('contacts.create'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const input = validate(listCreateSchema, req.body);

    const list = await prisma.list.create({
      data: {
        orgId: user.orgId,
        name: input.name.trim(),
        description: input.description?.trim() || null,
        type: input.type || 'STATIC',
        entityType: input.entityType || 'companies',
        filters: input.filters ? JSON.parse(JSON.stringify(input.filters)) : undefined,
        tags: input.tags ? JSON.parse(JSON.stringify(input.tags)) : undefined,
      },
    });

    return ok(res, { list }, 201);
  })
);

router.get(
  '/:id',
  requirePermission('contacts.view'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const list = await prisma.list.findFirst({
      where: { id: req.params.id, orgId: user.orgId },
      include: {
        members: {
          take: 100,
          orderBy: { addedAt: 'desc' },
        },
      },
    });
    if (!list) throw notFound('List not found');
    return ok(res, { list });
  })
);

router.patch(
  '/:id',
  requirePermission('contacts.edit'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const existing = await prisma.list.findFirst({
      where: { id: req.params.id, orgId: user.orgId },
    });
    if (!existing) throw notFound('List not found');

    const input = validate(listUpdateSchema, req.body);
    const list = await prisma.list.update({
      where: { id: existing.id },
      data: {
        ...(input.name !== undefined && { name: input.name.trim() }),
        ...(input.description !== undefined && { description: input.description?.trim() || null }),
        ...(input.filters !== undefined && { filters: input.filters ? JSON.parse(JSON.stringify(input.filters)) : undefined }),
        ...(input.tags !== undefined && { tags: input.tags ? JSON.parse(JSON.stringify(input.tags)) : undefined }),
      },
    });

    return ok(res, { list });
  })
);

router.delete(
  '/:id',
  requirePermission('contacts.delete'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const existing = await prisma.list.findFirst({
      where: { id: req.params.id, orgId: user.orgId },
    });
    if (!existing) throw notFound('List not found');
    await prisma.list.delete({ where: { id: existing.id } });
    return ok(res, { deleted: true });
  })
);

// ── Add members ──────────────────────────────────────────────
router.post(
  '/:id/members',
  requirePermission('contacts.edit'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const list = await prisma.list.findFirst({
      where: { id: req.params.id, orgId: user.orgId },
    });
    if (!list) throw notFound('List not found');

    const input = validate(memberAddSchema, req.body);

    const member = await prisma.listMember.create({
      data: {
        orgId: user.orgId,
        listId: list.id,
        entityType: input.entityType,
        entityId: input.entityId,
      },
    });

    await prisma.list.update({
      where: { id: list.id },
      data: { memberCount: { increment: 1 } },
    });

    return ok(res, { member }, 201);
  })
);

// ── Bulk add members ─────────────────────────────────────────
router.post(
  '/:id/members/bulk',
  requirePermission('contacts.edit'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const list = await prisma.list.findFirst({
      where: { id: req.params.id, orgId: user.orgId },
    });
    if (!list) throw notFound('List not found');

    const input = validate(memberBulkSchema, req.body);

    let added = 0;
    let skipped = 0;

    for (const item of input.members) {
      try {
        await prisma.listMember.create({
          data: {
            orgId: user.orgId,
            listId: list.id,
            entityType: item.entityType,
            entityId: item.entityId,
          },
        });
        added++;
      } catch {
        skipped++; // duplicate or invalid
      }
    }

    await prisma.list.update({
      where: { id: list.id },
      data: { memberCount: { increment: added } },
    });

    return ok(res, { added, skipped });
  })
);

// ── Remove members ───────────────────────────────────────────
router.delete(
  '/:id/members',
  requirePermission('contacts.edit'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const list = await prisma.list.findFirst({
      where: { id: req.params.id, orgId: user.orgId },
    });
    if (!list) throw notFound('List not found');

    const input = validate(memberRemoveSchema, req.body);

    const result = await prisma.listMember.deleteMany({
      where: {
        listId: list.id,
        entityType: input.entityType,
        entityId: input.entityId,
      },
    });

    if (result.count > 0) {
      await prisma.list.update({
        where: { id: list.id },
        data: { memberCount: { decrement: result.count } },
      });
    }

    return ok(res, { removed: result.count });
  })
);

// ── Schemas ──────────────────────────────────────────────────

const listCreateSchema = z.object({
  name: z.string().trim().min(1, 'List name is required').max(120),
  description: z.string().trim().max(500).optional().nullable(),
  type: z.enum(['STATIC', 'DYNAMIC']).optional(),
  entityType: z.enum(['companies', 'contacts', 'leads']).optional(),
  filters: z.record(z.unknown()).optional().nullable(),
  tags: z.array(z.string().max(40)).max(20).optional().nullable(),
});

const listUpdateSchema = listCreateSchema.partial();

const memberAddSchema = z.object({
  entityType: z.enum(['COMPANY', 'CONTACT', 'LEAD']),
  entityId: z.string().min(1),
});

const memberBulkSchema = z.object({
  members: z.array(z.object({
    entityType: z.enum(['COMPANY', 'CONTACT', 'LEAD']),
    entityId: z.string().min(1),
  })).min(1).max(500),
});

const memberRemoveSchema = z.object({
  entityType: z.enum(['COMPANY', 'CONTACT', 'LEAD']),
  entityId: z.string().min(1),
});

export default router;
