/**
 * Inbound Routing routes (Phase 11).
 *
 *   GET    /api/inbound/rules          — list rules
 *   POST   /api/inbound/rules          — create rule
 *   PATCH  /api/inbound/rules/:id      — update rule
 *   DELETE /api/inbound/rules/:id      — delete rule
 *   POST   /api/inbound/route          — manually route a lead
 *   GET    /api/inbound/visitors       — list website visitors
 *   GET    /api/inbound/visitors/stats — visitor statistics
 *   POST   /api/inbound/visitors/track — track a visit (public)
 *   POST   /api/inbound/visitors/identify — identify anonymous visitor
 */
import { Router } from 'express';
import { asyncHandler, badRequest, ok, validate } from '../lib/http';
import { requireAuth, requirePermission, type AuthedRequest } from '../middleware/auth';
import { z } from 'zod';
import { audit } from '../lib/audit';
import {
  createInboundRule, getInboundRules, updateInboundRule, deleteInboundRule,
  routeInboundLead, serializeRule,
} from '../services/inbound-routing';
import { trackVisit, getVisits, getVisitorStats, identifyVisitor } from '../services/visitors';

const router = Router();
router.use(requireAuth);

// ── Rules ───────────────────────────────────────────────────

const ruleSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  conditions: z.record(z.unknown()),
  actions: z.record(z.unknown()),
  priority: z.number().min(0).max(10000).optional(),
});

router.get('/rules', requirePermission('automation.view'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const rules = await getInboundRules(user.orgId);
  return ok(res, { rules: rules.map(serializeRule) });
}));

router.post('/rules', requirePermission('automation.manage'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const input = validate(ruleSchema, req.body);
  const rule = await createInboundRule(user.orgId, input);
  await audit({ orgId: user.orgId, userId: user.id, action: 'INBOUND_RULE_CREATED', entity: 'InboundRule', entityId: rule.id, req });
  return ok(res, { rule: serializeRule(rule) }, 201);
}));

router.patch('/rules/:id', requirePermission('automation.manage'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const input = validate(ruleSchema.partial(), req.body);
  const rule = await updateInboundRule(user.orgId, req.params.id, input);
  await audit({ orgId: user.orgId, userId: user.id, action: 'INBOUND_RULE_UPDATED', entity: 'InboundRule', entityId: rule.id, req });
  return ok(res, { rule: serializeRule(rule) });
}));

router.delete('/rules/:id', requirePermission('automation.manage'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  await deleteInboundRule(user.orgId, req.params.id);
  await audit({ orgId: user.orgId, userId: user.id, action: 'INBOUND_RULE_DELETED', entity: 'InboundRule', entityId: req.params.id, req });
  return ok(res, { deleted: true });
}));

router.post('/route', requirePermission('leads.manage'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const { leadId, context } = req.body as { leadId: string; context: any };
  if (!leadId) throw badRequest('leadId is required');
  const result = await routeInboundLead(user.orgId, leadId, context || {});
  return ok(res, result);
}));

// ── Visitors ────────────────────────────────────────────────

router.get('/visitors', requirePermission('automation.view'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const result = await getVisits(user.orgId, {
    companyId: (req.query.companyId as string) || undefined,
    isIdentified: req.query.identified === 'true' ? true : req.query.identified === 'false' ? false : undefined,
    minScore: Number(req.query.minScore) || undefined,
    limit: Number(req.query.limit) || 50,
    offset: Number(req.query.offset) || 0,
  });
  return ok(res, result);
}));

router.get('/visitors/stats', requirePermission('automation.view'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const stats = await getVisitorStats(user.orgId, Number(req.query.days) || 30);
  return ok(res, { stats });
}));

router.post('/visitors/track', asyncHandler(async (req, res) => {
  // Public — no auth required for tracking pixel/script
  const { orgId, ...data } = req.body;
  if (!orgId || !data.anonymousId || !data.pageUrl) {
    throw badRequest('orgId, anonymousId, and pageUrl are required');
  }
  const visit = await trackVisit(orgId, data);
  return ok(res, { visitId: visit.id, score: visit.visitScore });
}));

router.post('/visitors/identify', requirePermission('automation.view'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const { anonymousId, leadId, contactId, companyId } = req.body;
  if (!anonymousId) throw badRequest('anonymousId is required');
  const result = await identifyVisitor(user.orgId, anonymousId, { leadId, contactId, companyId });
  return ok(res, result);
}));

export default router;
