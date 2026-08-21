/**
 * Scoring Rules — configurable lead scoring.
 *  - GET    /          list rules
 *  - POST   /          create
 *  - PATCH  /:id       update
 *  - DELETE /:id       remove
 *  - POST   /evaluate/:leadId   score a lead
 */
import { Router } from 'express';
import { asyncHandler, ok, validate } from '../lib/http';
import { requireAuth, requirePermission, type AuthedRequest } from '../middleware/auth';
import { createRule, updateRule, deleteRule, listRules, evaluateLeadScore, autoScoreLead } from '../services/scoring';
import { z } from 'zod';

const router = Router();
router.use(requireAuth);

router.get('/', requirePermission('contacts.view'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const rules = await listRules(user.orgId);
  return ok(res, { rules });
}));

router.post('/', requirePermission('contacts.edit'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const input = validate(ruleCreateSchema, req.body);
  const rule = await createRule({ orgId: user.orgId, ...input });
  return ok(res, { rule }, 201);
}));

router.patch('/:id', requirePermission('contacts.edit'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const input = validate(ruleUpdateSchema, req.body);
  const rule = await updateRule(req.params.id, user.orgId, input);
  return ok(res, { rule });
}));

router.delete('/:id', requirePermission('contacts.edit'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const result = await deleteRule(req.params.id, user.orgId);
  return ok(res, result);
}));

router.post('/evaluate/:leadId', requirePermission('contacts.view'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const score = await autoScoreLead(user.orgId, req.params.leadId);
  return ok(res, { score });
}));

const ruleCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().max(500).optional().nullable(),
  field: z.string().min(1).max(100),
  operator: z.enum(['eq', 'neq', 'in', 'nin', 'contains', 'gt', 'gte', 'lt', 'lte', 'exists']),
  value: z.unknown().optional(),
  points: z.coerce.number().int().min(-100).max(100),
  enabled: z.boolean().optional(),
  priority: z.coerce.number().int().min(0).max(100).optional(),
});

const ruleUpdateSchema = ruleCreateSchema.partial();

export default router;
