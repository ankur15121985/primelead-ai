import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { asyncHandler, badRequest, conflict, notFound, ok, validate } from '../lib/http';
import { requireAuth, type AuthedRequest } from '../middleware/auth';
import { assertAdminOrAbove, assertManagerOrAbove } from '../middleware/auth';
import { hashPassword } from '../lib/passwords';
import { randomToken, hashToken } from '../lib/crypto';
import { sendMail, layoutMail } from '../lib/mailer';
import { audit } from '../lib/audit';
import { config } from '../config';
import { publicUser } from '../lib/serializers';
import { teamInviteSchema, teamUpdateSchema } from '../validators/schemas';
import { canManage, ROLES } from '../constants';

const router = Router();

router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const users = await prisma.user.findMany({
      where: { orgId: user.orgId },
      orderBy: { createdAt: 'asc' },
    });
    return ok(res, { users: users.map(publicUser) });
  })
);

// Manager+ can add members. Role is restricted by hierarchy.
router.post(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    assertManagerOrAbove(user);
    const input = validate(teamInviteSchema, req.body);
    if (!canManage(user.role as any, input.role as any)) {
      return badRequest('You cannot create a user with this role.');
    }
    const email = input.email.toLowerCase();
    const exists = await prisma.user.findUnique({ where: { orgId_email: { orgId: user.orgId, email } } });
    if (exists) throw conflict('A team member with this email already exists.');

    const password = input.password || randomToken(10);
    const member = await prisma.user.create({
      data: {
        orgId: user.orgId,
        name: input.name,
        email,
        passwordHash: await hashPassword(password),
        role: input.role,
      },
    });
    if (!input.password) {
      // No password chosen by the admin → email the member a set-password link.
      const token = randomToken();
      await prisma.resetToken.create({
        data: { userId: member.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000) },
      });
      const link = `${config.appUrl}/reset-password?token=${token}`;
      await sendMail({
        to: email,
        subject: `You've been added to a team on LeadFlow AI`,
        html: layoutMail(
          'Set your password',
          `<p>Hi ${input.name}, you've been added as a ${input.role.toLowerCase()} on LeadFlow AI.</p>
           <p><a href="${link}" style="background:#4f46e5;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;display:inline-block">Set your password</a></p>
           <p style="color:#94a3b8;font-size:12px">Or open: ${link} (valid for 72 hours)</p>`
        ),
      });
    }
    await audit({ orgId: user.orgId, userId: user.id, action: 'USER_ADDED', entity: 'User', entityId: member.id, metadata: { email } });
    return ok(res, { user: publicUser(member) }, 201);
  })
);

router.patch(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const input = validate(teamUpdateSchema, req.body);
    const target = await prisma.user.findFirst({ where: { id: req.params.id, orgId: user.orgId } });
    if (!target) throw notFound('Team member not found');
    if (target.id === user.id && (input.role || input.active === false)) {
      throw badRequest('You cannot change your own role or deactivate yourself.');
    }
    if (input.role && !canManage(user.role as any, input.role as any)) {
      throw badRequest('You cannot assign this role.');
    }
    if (input.role && target.role === 'OWNER') {
      throw badRequest('The owner role cannot be changed.');
    }
    assertAdminOrAbove(user);

    const updated = await prisma.user.update({
      where: { id: target.id },
      data: {
        ...(input.role ? { role: input.role } : {}),
        ...(input.active !== undefined ? { active: input.active } : {}),
        ...(input.title !== undefined ? { title: input.title } : {}),
      },
    });
    await audit({ orgId: user.orgId, userId: user.id, action: 'USER_UPDATED', entity: 'User', entityId: target.id, metadata: input });
    return ok(res, { user: publicUser(updated) });
  })
);

router.delete(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const target = await prisma.user.findFirst({ where: { id: req.params.id, orgId: user.orgId } });
    if (!target) throw notFound('Team member not found');
    if (target.id === user.id) throw badRequest('You cannot remove yourself.');
    if (target.role === 'OWNER') throw badRequest('The owner cannot be removed.');
    if (!['OWNER', 'ADMIN'].includes(user.role)) throw badRequest('Only admins can remove team members.');

    // Reassign their leads to unassigned before removal
    await prisma.lead.updateMany({
      where: { orgId: user.orgId, ownerId: target.id },
      data: { ownerId: null },
    });
    await prisma.user.delete({ where: { id: target.id } });
    await audit({ orgId: user.orgId, userId: user.id, action: 'USER_REMOVED', entity: 'User', entityId: target.id });
    return ok(res, { removed: true });
  })
);

export default router;
