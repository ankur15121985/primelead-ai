import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { asyncHandler, notFound, ok, validate } from '../lib/http';
import { requireAuth, type AuthedRequest } from '../middleware/auth';
import { createFollowUp, completeFollowUp, syncOverdue, bucketTasks } from '../services/followups';
import { taskCreateSchema, taskUpdateSchema } from '../validators/schemas';
import { assertManagerOrAbove } from '../middleware/auth';

const router = Router();

// ── List with view buckets ─────────────────────────────────────────
router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const view = String(req.query.view || 'today');
    const userId = user.role === 'SALES' ? user.id : (req.query.userId as string | undefined);

    // Keep the engine honest even on read paths.
    await syncOverdue(user.orgId);

    const where: Record<string, unknown> = {
      orgId: user.orgId,
      ...(userId && userId !== 'ALL' ? { userId } : {}),
    };
    const all = await prisma.task.findMany({
      where,
      orderBy: { dueAt: 'asc' },
      take: 200,
      include: {
        lead: { select: { id: true, name: true, phone: true } },
        user: { select: { id: true, name: true } },
      },
    });

    const buckets = bucketTasks(all);
    const selected =
      view === 'overdue' ? buckets.overdue :
      view === 'upcoming' ? buckets.upcoming :
      view === 'done' ? buckets.done :
      view === 'missed' ? buckets.missed :
      view === 'all' ? all :
      buckets.today;
    return ok(res, { tasks: selected, counts: {
      overdue: buckets.overdue.length,
      today: buckets.today.length,
      upcoming: buckets.upcoming.length,
      done: buckets.done.length,
      missed: buckets.missed.length,
    } });
  })
);

// ── Create ─────────────────────────────────────────────────────────
router.post(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const input = validate(taskCreateSchema, req.body);
    const targetUserId = input.userId || user.id;
    if (input.userId && !assertManagerOrAboveSafe(user)) {
      const { forbidden } = await import('../lib/http');
      throw forbidden();
    }
    await createFollowUp({
      orgId: user.orgId,
      leadId: input.leadId || undefined,
      userId: targetUserId,
      title: input.title,
      kind: (input.kind as any) || 'FOLLOW_UP',
      dueAt: new Date(input.dueAt),
      notes: input.notes || undefined,
      actorId: user.id,
    });
    return ok(res, { created: true }, 201);
  })
);

// ── Update (complete / edit) ───────────────────────────────────────
router.patch(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const input = validate(taskUpdateSchema, req.body);
    const task = await prisma.task.findFirst({ where: { id: req.params.id, orgId: user.orgId } });
    if (!task) throw notFound('Task not found');

    const data: Record<string, unknown> = {};
    if (input.status === 'DONE') data.status = 'DONE', data.completedAt = new Date();
    if (input.status === 'CANCELLED') data.status = 'CANCELLED';
    if (input.status === 'PENDING') { data.status = 'PENDING'; data.completedAt = null; }
    if (input.title !== undefined) data.title = input.title;
    if (input.dueAt !== undefined) data.dueAt = new Date(input.dueAt);
    if (input.notes !== undefined) data.notes = input.notes;

    await prisma.task.update({ where: { id: task.id }, data });
    if (input.status === 'DONE' && task.leadId) {
      await prisma.activity.create({
        data: {
          orgId: user.orgId,
          leadId: task.leadId,
          userId: user.id,
          type: 'FOLLOW_UP',
          title: 'Follow-up completed',
          body: task.title,
        },
      });
    }
    return ok(res, { updated: true });
  })
);

// ── Delete ─────────────────────────────────────────────────────────
router.delete(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const task = await prisma.task.findFirst({ where: { id: req.params.id, orgId: user.orgId } });
    if (!task) throw notFound('Task not found');
    if (task.userId !== user.id && !assertManagerOrAboveSafe(user)) {
      const { forbidden } = await import('../lib/http');
      throw forbidden();
    }
    await prisma.task.delete({ where: { id: task.id } });
    return ok(res, { deleted: true });
  })
);

// ── Force overdue sync ─────────────────────────────────────────────
router.post(
  '/sync',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const result = await syncOverdue(user.orgId);
    return ok(res, result);
  })
);

function assertManagerOrAboveSafe(user: { role: string }): boolean {
  try {
    assertManagerOrAbove(user);
    return true;
  } catch {
    return false;
  }
}

export default router;
