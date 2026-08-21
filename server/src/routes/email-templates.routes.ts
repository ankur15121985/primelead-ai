import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, badRequest, ok, validate } from '../lib/http';
import { requireAuth, requirePermission, type AuthedRequest } from '../middleware/auth';
import * as templates from '../services/email-templates';

const router = Router();

const createTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  category: z.enum(['MARKETING', 'TRANSACTIONAL', 'FOLLOW_UP', 'SEQUENCE', 'NEWSLETTER', 'OTHER']).default('OTHER'),
  subject: z.string().min(1).max(200),
  htmlContent: z.string().min(1),
  textContent: z.string().optional(),
  variables: z.array(z.object({
    name: z.string(),
    label: z.string(),
    type: z.enum(['text', 'number', 'date', 'boolean']),
    required: z.boolean().optional(),
    defaultValue: z.string().optional(),
  })).optional(),
  fromName: z.string().optional(),
  fromEmail: z.string().email().optional(),
  replyTo: z.string().email().optional(),
  tags: z.array(z.string()).optional(),
});

const previewSchema = z.object({
  data: z.record(z.union([z.string(), z.number(), z.boolean()])),
});

/** List email templates */
router.get(
  '/',
  requireAuth,
  requirePermission('settings.view'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const { category, search } = req.query;
    const result = await templates.listTemplates(user.orgId, {
      category: category as string,
      search: search as string,
    });
    return ok(res, { templates: result, total: result.length });
  })
);

/** Get template statistics */
router.get(
  '/stats',
  requireAuth,
  requirePermission('settings.view'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const stats = await templates.getTemplateStats(user.orgId);
    return ok(res, stats);
  })
);

/** Get template examples */
router.get(
  '/examples',
  requireAuth,
  requirePermission('settings.view'),
  asyncHandler(async (_req, res) => {
    return ok(res, { examples: templates.TEMPLATE_EXAMPLES });
  })
);

/** Get a single template */
router.get(
  '/:id',
  requireAuth,
  requirePermission('settings.view'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const template = await templates.getTemplate(user.orgId, req.params.id);
    return ok(res, template);
  })
);

/** Create a template */
router.post(
  '/',
  requireAuth,
  requirePermission('settings.edit'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const input = validate(createTemplateSchema, req.body);
    const template = await templates.createTemplate(user.orgId, user.id, input as templates.CreateTemplateInput);
    return ok(res, template, 201);
  })
);

/** Update a template */
router.patch(
  '/:id',
  requireAuth,
  requirePermission('settings.edit'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const input = validate(createTemplateSchema.partial(), req.body);
    const template = await templates.updateTemplate(user.orgId, req.params.id, input as Partial<templates.CreateTemplateInput>);
    return ok(res, template);
  })
);

/** Delete a template */
router.delete(
  '/:id',
  requireAuth,
  requirePermission('settings.edit'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const result = await templates.deleteTemplate(user.orgId, req.params.id);
    return ok(res, result);
  })
);

/** Preview a template with data */
router.post(
  '/:id/preview',
  requireAuth,
  requirePermission('settings.view'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const { data } = validate(previewSchema, req.body);
    const preview = await templates.previewTemplate(user.orgId, req.params.id, data);
    return ok(res, preview);
  })
);

/** Duplicate a template */
router.post(
  '/:id/duplicate',
  requireAuth,
  requirePermission('settings.edit'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const { name } = req.body;
    const template = await templates.duplicateTemplate(user.orgId, user.id, req.params.id, name);
    return ok(res, template, 201);
  })
);

export default router;
