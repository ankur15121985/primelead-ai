import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { asyncHandler, ok, validate } from '../lib/http';
import { requireAuth, type AuthedRequest } from '../middleware/auth';
import { audit } from '../lib/audit';
import { publicOrg } from '../lib/serializers';
import { orgUpdateSchema } from '../validators/schemas';
import { getOrgSetting, setOrgSetting } from '../services/assignment';
import { z } from 'zod';

const router = Router();
const profileSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  phone: z.string().trim().max(20).optional(),
  title: z.string().max(80).optional(),
});  router.get(
    '/',
    requireAuth,
    asyncHandler(async (req, res) => {
      const user = (req as AuthedRequest).user;
      const [org, leadSources, sourceAssignments, ai] = await Promise.all([
        prisma.organization.findUnique({ where: { id: user.orgId } }),
        getOrgSetting(user.orgId, 'leadSources'),
        getOrgSetting(user.orgId, 'sourceAssignments'),
        getOrgSetting(user.orgId, 'ai'),
      ]);
      // NEVER return the stored API key to the client — only whether AI is configured.
      const aiPublic = ai
        ? {
            configured: Boolean((ai as any).apiKey || (ai as any).configured),
            provider: (ai as any).provider || null,
            model: (ai as any).model || null,
          }
        : null;
      return ok(res, { org: publicOrg(org!), leadSources, sourceAssignments, ai: aiPublic });
    })
  );

router.patch(
  '/org',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const input = validate(orgUpdateSchema, req.body);
    const org = await prisma.organization.update({
      where: { id: user.orgId },
      data: input,
    });
    await audit({ orgId: user.orgId, userId: user.id, action: 'ORG_UPDATED', entity: 'Organization', entityId: org.id, metadata: input });
    return ok(res, { org: publicOrg(org) });
  })
);

router.patch(
  '/profile',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const input = validate(profileSchema, req.body);
    const updated = await prisma.user.update({ where: { id: user.id }, data: input });
    return ok(res, { user: { id: updated.id, name: updated.name, phone: updated.phone, title: updated.title } });
  })
);  router.post(
    '/source-assignments',
    requireAuth,
    asyncHandler(async (req, res) => {
      const user = (req as AuthedRequest).user;
      const input = validate(z.object({ rules: z.record(z.string().nullable()) }), req.body);
      // Every rule target must be a member of the organisation.
      const targetIds = [...new Set(Object.values(input.rules).filter(Boolean) as string[])];
      if (targetIds.length) {
        const count = await prisma.user.count({ where: { id: { in: targetIds }, orgId: user.orgId } });
        if (count !== targetIds.length) throw Object.assign(new Error('One or more assigned users are not in your team.'), { status: 400 });
      }
      await setOrgSetting(user.orgId, 'sourceAssignments', input.rules);
    await audit({ orgId: user.orgId, userId: user.id, action: 'ASSIGNMENT_RULES_UPDATED', entity: 'Setting' });
    return ok(res, { saved: true });
  })
);

router.post(
  '/ai',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const input = validate(
      z.object({ apiKey: z.string().optional(), model: z.string().optional(), provider: z.string().optional() }),
      req.body
    );
    // API keys are stored in the org settings table server-side only; they are
    // never returned by any GET endpoint.
    const current = (await getOrgSetting(user.orgId, 'ai')) || {};
    await setOrgSetting(user.orgId, 'ai', {
      ...current,
      ...(input.apiKey ? { apiKey: input.apiKey } : {}),
      ...(input.model ? { model: input.model } : {}),
      ...(input.provider ? { provider: input.provider } : {}),
      configured: Boolean(input.apiKey || current.apiKey),
    });
    await audit({ orgId: user.orgId, userId: user.id, action: 'AI_SETTINGS_UPDATED', entity: 'Setting' });
    return ok(res, { saved: true, configured: Boolean(input.apiKey || current.apiKey) });
  })
);

export default router;
