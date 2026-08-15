/**
 * Roles & permissions API (config-driven RBAC).
 *  - GET    /              org roles + the permission catalog
 *  - POST   /              create a custom role (roles.manage)
 *  - PATCH  /:id           rename / edit permissions (roles.manage)
 *  - DELETE /:id           delete a custom role (roles.manage)
 */
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { asyncHandler, badRequest, conflict, notFound, ok, validate } from '../lib/http';
import { requireAuth, requirePermission, type AuthedRequest } from '../middleware/auth';
import { orgRoles } from '../services/rbac';
import { PERMISSIONS } from '../constants/rbac';
import { audit } from '../lib/audit';

const router = Router();
router.use(requireAuth);

const roleSchema = z.object({
  name: z.string().trim().min(2, 'Role name is required').max(60),
  description: z.string().trim().max(200).optional().nullable(),
  permissions: z.array(z.string()).min(0).max(200),
});

function slugifyKey(name: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 30);
  return base || 'role';
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const roles = await orgRoles(user.orgId);
    return ok(res, {
      roles: roles.map((r) => ({
        id: r.id,
        key: r.key,
        name: r.name,
        description: r.description,
        isSystem: r.isSystem,
        permissions: (r.permissions as string[]) || [],
      })),
      catalog: PERMISSIONS,
    });
  })
);

router.post(
  '/',
  requirePermission('roles.manage'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const input = validate(roleSchema, req.body);
    const key = `CUSTOM_${slugifyKey(input.name)}`;
    const existing = await prisma.role.findUnique({ where: { orgId_key: { orgId: user.orgId, key } } });
    if (existing) throw conflict('A role with this name already exists.');

    const role = await prisma.role.create({
      data: {
        orgId: user.orgId,
        key,
        name: input.name,
        description: input.description || null,
        isSystem: false,
        permissions: input.permissions as any,
      },
    });
    await audit({ orgId: user.orgId, userId: user.id, action: 'ROLE_CREATED', entity: 'Role', entityId: role.id, metadata: { name: input.name }, req });
    return ok(res, { role }, 201);
  })
);

router.patch(
  '/:id',
  requirePermission('roles.manage'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const input = validate(roleSchema.partial(), req.body);
    const role = await prisma.role.findFirst({ where: { id: req.params.id, orgId: user.orgId } });
    if (!role) throw notFound('Role not found');
    if (role.key === 'OWNER') throw badRequest('The Owner role cannot be edited.');

    const updated = await prisma.role.update({
      where: { id: role.id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description || null } : {}),
        ...(input.permissions !== undefined ? { permissions: input.permissions as any } : {}),
      },
    });
    await audit({ orgId: user.orgId, userId: user.id, action: 'ROLE_UPDATED', entity: 'Role', entityId: role.id, req });
    return ok(res, { role: updated });
  })
);

router.delete(
  '/:id',
  requirePermission('roles.manage'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const role = await prisma.role.findFirst({ where: { id: req.params.id, orgId: user.orgId } });
    if (!role) throw notFound('Role not found');
    if (role.isSystem) throw badRequest('Built-in roles cannot be deleted.');
    const inUse = await prisma.user.count({ where: { orgId: user.orgId, role: role.key } });
    if (inUse > 0) throw badRequest(`This role is assigned to ${inUse} member(s). Reassign them first.`);

    await prisma.role.delete({ where: { id: role.id } });
    await audit({ orgId: user.orgId, userId: user.id, action: 'ROLE_DELETED', entity: 'Role', entityId: role.id, metadata: { name: role.name }, req });
    return ok(res, { deleted: true });
  })
);

export default router;
