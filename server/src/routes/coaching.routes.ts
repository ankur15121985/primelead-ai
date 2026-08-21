/**
 * Phase 18 — Sales coaching routes.
 *
 * Generate coaching insights per rep, view history, team summary.
 */
import { Router } from 'express';
import { requireAuth, requirePermission, type AuthedRequest } from '../middleware/auth';
import { asyncHandler, badRequest, ok, validate } from '../lib/http';
import { generateCoachingInsight, getCoachingInsights, getTeamCoachingSummary } from '../services/coaching';
import { z } from 'zod';

const router = Router();
router.use(requireAuth);

/**
 * POST /api/coaching/generate
 * Generate a coaching insight for a specific user and period.
 */
router.post('/generate', requirePermission('users.manage'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const input = validate(z.object({
    userId: z.string().min(1),
    period: z.string().min(1).max(20),
    periodType: z.enum(['WEEK', 'MONTH', 'QUARTER']).optional(),
  }), req.body);

  const insight = await generateCoachingInsight(user.orgId, input.userId, input.period, input.periodType);
  return ok(res, { insight });
}));

/**
 * GET /api/coaching/insights
 * List coaching insights. Optionally filter by userId.
 */
router.get('/insights', requirePermission('contacts.view'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const q = req.query as Record<string, string>;
  const insights = await getCoachingInsights(user.orgId, q.userId || undefined, Number(q.limit) || 20);
  return ok(res, { insights });
}));

/**
 * GET /api/coaching/summary
 * Team coaching summary for a given period.
 */
router.get('/summary', requirePermission('users.manage'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const q = req.query as Record<string, string>;
  if (!q.period) {
    return badRequest('period query param is required (e.g. 2024-01)');
  }
  const summary = await getTeamCoachingSummary(user.orgId, q.period);
  return ok(res, { summary });
}));

/**
 * GET /api/coaching/me
 * Get coaching insights for the current user.
 */
router.get('/me', requirePermission('contacts.view'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const insights = await getCoachingInsights(user.orgId, user.id, 12);
  return ok(res, { insights });
}));

export default router;
