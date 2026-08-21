/**
 * Deliverability Center — email health monitoring.
 *  - GET    /report       full deliverability report
 *  - POST   /metrics      record daily metrics
 *  - GET    /domains      domain breakdown
 */
import { Router } from 'express';
import { asyncHandler, ok, validate } from '../lib/http';
import { requireAuth, requirePermission, type AuthedRequest } from '../middleware/auth';
import { generateDeliverabilityReport, recordDailyMetrics } from '../services/deliverability';
import { z } from 'zod';

const router = Router();
router.use(requireAuth);

router.get('/report', requirePermission('contacts.view'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const q = req.query as Record<string, string>;

  const to = new Date();
  const from = new Date();
  const days = Number(q.days) || 30;
  from.setDate(from.getDate() - days);

  const report = await generateDeliverabilityReport(user.orgId, from, to);
  return ok(res, { report });
}));

router.post('/metrics', requirePermission('contacts.edit'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const input = validate(metricsSchema, req.body);
  const metric = await recordDailyMetrics(user.orgId, input.domain, {
    sent: input.sent,
    delivered: input.delivered,
    bounced: input.bounced,
    opened: input.opened,
    clicked: input.clicked,
    replied: input.replied,
    unsubscribed: input.unsubscribed,
    spamComplaints: input.spamComplaints,
  });
  return ok(res, { metric });
}));

router.get('/domains', requirePermission('contacts.view'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const q = req.query as Record<string, string>;
  const days = Number(q.days) || 30;
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - days);

  const report = await generateDeliverabilityReport(user.orgId, from, to);
  return ok(res, { domains: report.domainBreakdown, healthScore: report.healthScore, reputationScore: report.reputationScore });
}));

const metricsSchema = z.object({
  domain: z.string().min(1).max(200),
  sent: z.coerce.number().int().min(0),
  delivered: z.coerce.number().int().min(0),
  bounced: z.coerce.number().int().min(0),
  opened: z.coerce.number().int().min(0),
  clicked: z.coerce.number().int().min(0),
  replied: z.coerce.number().int().min(0),
  unsubscribed: z.coerce.number().int().min(0),
  spamComplaints: z.coerce.number().int().min(0),
});

export default router;
