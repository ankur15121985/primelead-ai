import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { asyncHandler, ok, validate } from '../lib/http';
import { requireAuth, type AuthedRequest } from '../middleware/auth';
import { assertManagerOrAbove } from '../middleware/auth';
import { z } from 'zod';
import { scopedWhere } from '../middleware/auth';

const router = Router();

const stageCreateSchema = z.object({
  name: z.string().trim().min(1).max(60),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  isWon: z.boolean().optional(),
  isLost: z.boolean().optional(),
});

const stageOrderSchema = z.object({
  ids: z.array(z.string()).min(2),
});

// ── Board: stages with their leads (Kanban) ────────────────────────
router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const pipeline = await prisma.pipeline.findFirst({
      where: { orgId: user.orgId, isDefault: true },
      orderBy: { createdAt: 'asc' },
    });
    if (!pipeline) return ok(res, { stages: [], pipeline: null });
    const stages = await prisma.pipelineStage.findMany({
      where: { pipelineId: pipeline.id },
      orderBy: { order: 'asc' },
      include: {
        leads: {
          where: { ...scopedWhere(user, user.orgId), deletedAt: null } as any,
          orderBy: { updatedAt: 'desc' },
          take: 100,
          include: {
            owner: { select: { id: true, name: true } },
          },
        },
      },
    });
    return ok(res, { stages, pipeline: { id: pipeline.id, name: pipeline.name } });
  })
);

// ── Create stage (manager+) ────────────────────────────────────────
router.post(
  '/stages',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    assertManagerOrAbove(user);
    const input = validate(stageCreateSchema, req.body);
    const pipeline = await prisma.pipeline.findFirst({ where: { orgId: user.orgId, isDefault: true } });
    if (!pipeline) throw Object.assign(new Error('No pipeline found'), { status: 404 });
    const maxOrder = await prisma.pipelineStage.aggregate({
      where: { pipelineId: pipeline.id },
      _max: { order: true },
    });
    const stage = await prisma.pipelineStage.create({
      data: {
        pipelineId: pipeline.id,
        orgId: user.orgId,
        name: input.name,
        color: input.color || '#64748b',
        isWon: input.isWon || false,
        isLost: input.isLost || false,
        order: (maxOrder._max.order ?? -1) + 1,
      },
    });
    return ok(res, { stage }, 201);
  })
);

// ── Reorder stages (manager+) ──────────────────────────────────────
router.post(
  '/stages/reorder',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    assertManagerOrAbove(user);
    const input = validate(stageOrderSchema, req.body);
    await prisma.$transaction(
      input.ids.map((id, index) =>
        prisma.pipelineStage.updateMany({
          where: { id, orgId: user.orgId },
          data: { order: index },
        })
      )
    );
    return ok(res, { reordered: true });
  })
);

export default router;
