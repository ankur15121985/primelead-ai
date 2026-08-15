/**
 * Teams (Org → Team → User).
 *  - GET    /            list teams + member counts
 *  - POST   /            create a team (teams.manage)
 *  - PATCH  /:id         rename / edit (teams.manage)
 *  - DELETE /:id         delete (members are unassigned, not removed)
 */
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { asyncHandler, conflict, notFound, ok, validate } from '../lib/http';
import { requireAuth, requirePermission, type AuthedRequest } from '../middleware/auth';
import { audit } from '../lib/audit';

const router = Router();
router.use(requireAuth);

const teamSchema = z.object({
  name: z.string().trim().min(1, 'Team name is required').max(60),
  description: z.string().trim().max(200).optional().nullable(),
});

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const teams = await prisma.team.findMany({
      where: { orgId: user.orgId },
      orderBy: { createdAt: 'asc' },
      include: { users: { select: { id: true, name: true, email: true, role: true } } },
    });
    return ok(res, {
      teams: teams.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        memberCount: t.users.length,
        members: t.users,
        createdAt: t.createdAt,
      })),
    });
  })
);

router.post(
  '/',
  requirePermission('teams.manage'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const input = validate(teamSchema, req.body);
    const existing = await prisma.team.findFirst({ where: { orgId: user.orgId, name: input.name } });
    if (existing) throw conflict('A team with this name already exists.');
    const team = await prisma.team.create({
      data: { orgId: user.orgId, name: input.name, description: input.description || null },
    });
    await audit({ orgId: user.orgId, userId: user.id, action: 'TEAM_CREATED', entity: 'Team', entityId: team.id, metadata: { name: input.name }, req });
    return ok(res, { team }, 201);
  })
);

router.patch(
  '/:id',
  requirePermission('teams.manage'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const input = validate(teamSchema.partial(), req.body);
    const team = await prisma.team.findFirst({ where: { id: req.params.id, orgId: user.orgId } });
    if (!team) throw notFound('Team not found');
    if (input.name) {
      const dup = await prisma.team.findFirst({ where: { orgId: user.orgId, name: input.name, id: { not: team.id } } });
      if (dup) throw conflict('A team with this name already exists.');
    }
    const updated = await prisma.team.update({
      where: { id: team.id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description || null } : {}),
      },
    });
    await audit({ orgId: user.orgId, userId: user.id, action: 'TEAM_UPDATED', entity: 'Team', entityId: team.id, req });
    return ok(res, { team: updated });
  })
);

router.delete(
  '/:id',
  requirePermission('teams.manage'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const team = await prisma.team.findFirst({ where: { id: req.params.id, orgId: user.orgId } });
    if (!team) throw notFound('Team not found');
    // Members are unassigned from the team, never removed from the org.
    await prisma.$transaction([
      prisma.user.updateMany({ where: { orgId: user.orgId, teamId: team.id }, data: { teamId: null } }),
      prisma.team.delete({ where: { id: team.id } }),
    ]);
    await audit({ orgId: user.orgId, userId: user.id, action: 'TEAM_DELETED', entity: 'Team', entityId: team.id, req });
    return ok(res, { deleted: true });
  })
);

export default router;
