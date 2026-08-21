/**
 * Forms routes (Phase 11).
 *
 *   GET    /api/forms                — list forms
 *   POST   /api/forms                — create form
 *   GET    /api/forms/:id            — get form detail
 *   PATCH  /api/forms/:id            — update form
 *   DELETE /api/forms/:id            — delete form
 *   GET    /api/forms/:id/submissions — list submissions
 *   GET    /api/forms/:id/stats      — form statistics
 *   POST   /api/public/forms/:slug   — public submission (no auth)
 *   GET    /api/forms/:id/embed      — get embed code
 */
import { Router } from 'express';
import { asyncHandler, badRequest, notFound, ok, validate } from '../lib/http';
import { requireAuth, requirePermission, type AuthedRequest } from '../middleware/auth';
import { z } from 'zod';
import { audit } from '../lib/audit';
import {
  createForm, getForms, getForm, updateForm, deleteForm,
  submitForm, getFormSubmissions, getFormStats, generateEmbedCode,
} from '../services/forms';

const router = Router();
router.use(requireAuth);

const formSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  slug: z.string().max(100).optional(),
  fields: z.array(z.object({
    name: z.string(),
    label: z.string(),
    type: z.string(),
    required: z.boolean().optional(),
    placeholder: z.string().optional(),
    options: z.array(z.string()).optional(),
  })).min(1),
  submitAction: z.string().optional(),
  submitConfig: z.record(z.unknown()).optional(),
  captchaEnabled: z.boolean().optional(),
  utmTracking: z.boolean().optional(),
  theme: z.string().optional(),
  customCss: z.string().optional(),
});

router.get('/', requirePermission('automation.view'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const forms = await getForms(user.orgId);
  return ok(res, { forms });
}));

router.post('/', requirePermission('automation.manage'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const input = validate(formSchema, req.body);
  const form = await createForm(user.orgId, input);
  await audit({ orgId: user.orgId, userId: user.id, action: 'FORM_CREATED', entity: 'Form', entityId: form.id, req });
  return ok(res, { form }, 201);
}));

router.get('/:id', requirePermission('automation.view'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const form = await getForm(user.orgId, req.params.id);
  return ok(res, { form });
}));

router.patch('/:id', requirePermission('automation.manage'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const input = validate(formSchema.partial(), req.body);
  const form = await updateForm(user.orgId, req.params.id, input);
  await audit({ orgId: user.orgId, userId: user.id, action: 'FORM_UPDATED', entity: 'Form', entityId: form.id, req });
  return ok(res, { form });
}));

router.delete('/:id', requirePermission('automation.manage'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  await deleteForm(user.orgId, req.params.id);
  await audit({ orgId: user.orgId, userId: user.id, action: 'FORM_DELETED', entity: 'Form', entityId: req.params.id, req });
  return ok(res, { deleted: true });
}));

router.get('/:id/submissions', requirePermission('automation.view'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const result = await getFormSubmissions(user.orgId, req.params.id, {
    status: (req.query.status as string) || undefined,
    limit: Number(req.query.limit) || 50,
    offset: Number(req.query.offset) || 0,
  });
  return ok(res, result);
}));

router.get('/:id/stats', requirePermission('automation.view'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const stats = await getFormStats(user.orgId, req.params.id);
  return ok(res, { stats });
}));

router.get('/:id/embed', requirePermission('automation.view'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const form = await getForm(user.orgId, req.params.id);
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const embedCode = generateEmbedCode(form, baseUrl);
  return ok(res, { embedCode, formUrl: `${baseUrl}/api/public/forms/${form.slug}` });
}));

// ── Public submission (no auth) ─────────────────────────────

const publicRouter = Router();
publicRouter.post('/:slug', asyncHandler(async (req, res) => {
  const result = await submitForm(req.params.slug, req.body.data || req.body, {
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
    referer: req.get('referer'),
    utmSource: req.query.utm_source as string || req.body.utm_source,
    utmMedium: req.query.utm_medium as string || req.body.utm_medium,
    utmCampaign: req.query.utm_campaign as string || req.body.utm_campaign,
    utmContent: req.query.utm_content as string || req.body.utm_content,
  });
  return ok(res, result);
}));

export { publicRouter as publicFormRouter };
export default router;
