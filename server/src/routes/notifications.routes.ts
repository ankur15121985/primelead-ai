import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { asyncHandler, ok } from '../lib/http';
import { requireAuth, type AuthedRequest } from '../middleware/auth';

const router = Router();

router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const [unread, items] = await Promise.all([
      prisma.notification.count({ where: { userId: user.id, orgId: user.orgId, readAt: null } }),
      prisma.notification.findMany({
        where: { userId: user.id, orgId: user.orgId },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
    ]);
    return ok(res, { items, unread });
  })
);

router.patch(
  '/:id/read',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    await prisma.notification.updateMany({
      where: { id: req.params.id, userId: user.id, orgId: user.orgId },
      data: { readAt: new Date() },
    });
    return ok(res, { read: true });
  })
);

router.post(
  '/read-all',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    await prisma.notification.updateMany({
      where: { userId: user.id, orgId: user.orgId, readAt: null },
      data: { readAt: new Date() },
    });
    return ok(res, { readAll: true });
  })
);

export default router;
