import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { asyncHandler, badRequest, notFound, ok, validate } from '../lib/http';
import { requireAuth, requirePermission, type AuthedRequest } from '../middleware/auth';
import { assertManagerOrAbove } from '../middleware/auth';
import { scopedWhere } from '../middleware/auth';
import { z } from 'zod';
import { paiseToRupees } from '../lib/money';

const router = Router();

const stageCreateSchema = z.object({
  name: z.string().trim().min(1).max(60),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  isWon: z.boolean().optional(),
  isLost: z.boolean().optional(),
  probability: z.coerce.number().int().min(0).max(100).optional(),
});

const stageUpdateSchema = stageCreateSchema.partial();

const stageOrderSchema = z.object({
  ids: z.array(z.string()).min(2),
});

const pipelineCreateSchema = z.object({
  name: z.string().trim().min(1, 'Pipeline name is required').max(60),
  stages: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(60),
        color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
        isWon: z.boolean().optional(),
        isLost: z.boolean().optional(),
        probability: z.coerce.number().int().min(0).max(100).optional(),
      })
    )
    .max(20)
    .optional(),
});

const pipelineUpdateSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  isDefault: z.boolean().optional(),
});

/** Resolve the pipeline being viewed — an explicit id, else the org's default (or first). */
async function resolvePipeline(orgId: string, pipelineId?: string | null) {
  if (pipelineId) {
    const pipeline = await prisma.pipeline.findFirst({ where: { id: pipelineId, orgId } });
    if (pipeline) return pipeline;
    throw notFound('Pipeline not found');
  }
  const pipeline =
    (await prisma.pipeline.findFirst({ where: { orgId, isDefault: true }, orderBy: { createdAt: 'asc' } })) ||
    (await prisma.pipeline.findFirst({ where: { orgId }, orderBy: { createdAt: 'asc' } }));
  return pipeline;
}

/** Derive the lead status a stage implies (won / lost), or null to keep current. */
function statusForStage(stage: { isWon: boolean; isLost: boolean }): string | null {
  if (stage.isWon) return 'WON';
  if (stage.isLost) return 'LOST';
  return null;
}

// ── Board: stages with their leads (Kanban) + pipeline selector ────
router.get(
  '/',
  requireAuth,
  requirePermission('pipeline.view'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const pipeline = await resolvePipeline(user.orgId, req.query.pipelineId as string | undefined);
    if (!pipeline) return ok(res, { stages: [], pipeline: null, pipelines: [], forecast: 0 });

    const [stages, pipelines] = await Promise.all([
      prisma.pipelineStage.findMany({
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
      }),
      prisma.pipeline.findMany({ where: { orgId: user.orgId }, orderBy: { createdAt: 'asc' }, include: { _count: { select: { stages: true } } } }),
    ]);

    // Per-stage value + weighted forecast (paise → rupees at the API boundary).
    let forecast = 0;
    const stagesOut = stages.map((stage) => {
      const value = stage.leads.reduce((s, l) => s + l.expectedValue, 0);
      const weighted = Math.round(value * (stage.probability / 100));
      if (!stage.isWon && !stage.isLost) forecast += weighted;
      return { ...stage, value: paiseToRupees(value), weightedValue: paiseToRupees(weighted) };
    });

    return ok(res, {
      stages: stagesOut,
      pipeline: { id: pipeline.id, name: pipeline.name, isDefault: pipeline.isDefault },
      pipelines: pipelines.map((p) => ({ id: p.id, name: p.name, isDefault: p.isDefault, stageCount: p._count.stages })),
      forecast: paiseToRupees(forecast),
    });
  })
);

// ── Create pipeline (manager+) ─────────────────────────────────────
router.post(
  '/',
  requireAuth,
  requirePermission('pipeline.edit'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    assertManagerOrAbove(user);
    const input = validate(pipelineCreateSchema, req.body);

    const existingCount = await prisma.pipeline.count({ where: { orgId: user.orgId } });
    const isDefault = existingCount === 0;

    const pipeline = await prisma.$transaction(async (tx) => {
      const created = await tx.pipeline.create({
        data: { orgId: user.orgId, name: input.name, isDefault },
      });
      if (input.stages?.length) {
        await tx.pipelineStage.createMany({
          data: input.stages.map((s, i) => ({
            pipelineId: created.id,
            orgId: user.orgId,
            name: s.name,
            color: s.color || '#64748b',
            isWon: s.isWon || false,
            isLost: s.isLost || false,
            probability: s.probability ?? 0,
            order: i,
          })),
        });
      }
      return created;
    });

    return ok(res, { pipeline }, 201);
  })
);

// ── Rename / set default (manager+) ────────────────────────────────
router.patch(
  '/:pipelineId',
  requireAuth,
  requirePermission('pipeline.edit'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    assertManagerOrAbove(user);
    const input = validate(pipelineUpdateSchema, req.body);
    const existing = await prisma.pipeline.findFirst({ where: { id: req.params.pipelineId, orgId: user.orgId } });
    if (!existing) throw notFound('Pipeline not found');

    if (input.isDefault) {
      // Only one default per org.
      await prisma.pipeline.updateMany({ where: { orgId: user.orgId, isDefault: true }, data: { isDefault: false } });
    }
    const pipeline = await prisma.pipeline.update({
      where: { id: existing.id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.isDefault !== undefined ? { isDefault: input.isDefault } : {}),
      },
    });
    return ok(res, { pipeline });
  })
);

// ── Delete pipeline (manager+) ─────────────────────────────────────
router.delete(
  '/:pipelineId',
  requireAuth,
  requirePermission('pipeline.edit'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    assertManagerOrAbove(user);
    const existing = await prisma.pipeline.findFirst({
      where: { id: req.params.pipelineId, orgId: user.orgId },
      include: { stages: { select: { id: true } } },
    });
    if (!existing) throw notFound('Pipeline not found');
    if (existing.isDefault) throw badRequest('The default pipeline cannot be deleted. Make another pipeline default first.');
    if (existing.stages.length) {
      // Unassign its leads rather than deleting them.
      await prisma.lead.updateMany({
        where: { orgId: user.orgId, stageId: { in: existing.stages.map((s) => s.id) } },
        data: { stageId: null },
      });
    }
    await prisma.pipeline.delete({ where: { id: existing.id } });
    return ok(res, { deleted: true });
  })
);

// ── Create stage (manager+) ────────────────────────────────────────
router.post(
  '/stages',
  requireAuth,
  requirePermission('pipeline.edit'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    assertManagerOrAbove(user);
    const input = validate(stageCreateSchema, req.body);
    const pipeline = await resolvePipeline(user.orgId, (req.body as { pipelineId?: string }).pipelineId);
    if (!pipeline) throw notFound('No pipeline found — create one first.');
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
        probability: input.probability ?? 0,
        order: (maxOrder._max.order ?? -1) + 1,
      },
    });
    return ok(res, { stage }, 201);
  })
);

// ── Edit stage (manager+) ──────────────────────────────────────────
router.patch(
  '/stages/:id',
  requireAuth,
  requirePermission('pipeline.edit'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    assertManagerOrAbove(user);
    const input = validate(stageUpdateSchema, req.body);
    const existing = await prisma.pipelineStage.findFirst({ where: { id: req.params.id, orgId: user.orgId } });
    if (!existing) throw notFound('Stage not found');

    const data: Record<string, unknown> = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.color !== undefined) data.color = input.color;
    if (input.probability !== undefined) data.probability = input.probability;
    if (input.isWon !== undefined) data.isWon = input.isWon;
    if (input.isLost !== undefined) data.isLost = input.isLost;
    if (input.isWon === true) data.isLost = false;
    if (input.isLost === true) data.isWon = false;

    const stage = await prisma.pipelineStage.update({ where: { id: existing.id }, data });
    return ok(res, { stage });
  })
);

// ── Delete stage (manager+) ────────────────────────────────────────
router.delete(
  '/stages/:id',
  requireAuth,
  requirePermission('pipeline.edit'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    assertManagerOrAbove(user);
    const existing = await prisma.pipelineStage.findFirst({ where: { id: req.params.id, orgId: user.orgId } });
    if (!existing) throw notFound('Stage not found');
    // Unassign the stage's leads (they stay on the board as unassigned, never deleted).
    await prisma.lead.updateMany({ where: { stageId: existing.id }, data: { stageId: null } });
    await prisma.pipelineStage.delete({ where: { id: existing.id } });
    return ok(res, { deleted: true });
  })
);

// ── Reorder stages (manager+) ──────────────────────────────────────
router.post(
  '/stages/reorder',
  requireAuth,
  requirePermission('pipeline.edit'),
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
export { statusForStage };
