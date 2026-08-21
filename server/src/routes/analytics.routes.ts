/**
 * Analytics routes (Phase 12).
 *
 *   GET    /api/analytics/dashboard          — dashboard metrics
 *   GET    /api/analytics/reps               — rep performance
 *   GET    /api/analytics/pipeline           — pipeline analytics
 *   GET    /api/analytics/forecast           — revenue forecast
 *   POST   /api/analytics/snapshots          — generate snapshot
 *   GET    /api/analytics/snapshots          — get snapshots
 */
import { Router } from 'express';
import { asyncHandler, ok } from '../lib/http';
import { requireAuth, requirePermission, type AuthedRequest } from '../middleware/auth';
import { audit } from '../lib/audit';
import {
  getDashboardMetrics, getRepPerformance, getPipelineAnalytics,
  getRevenueForecast, generateSnapshot, getSnapshots,
} from '../services/analytics';

const router = Router();
router.use(requireAuth);

router.get('/dashboard', requirePermission('reports.view'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const metrics = await getDashboardMetrics(user.orgId, Number(req.query.days) || 30);
  return ok(res, { metrics });
}));

router.get('/reps', requirePermission('reports.view'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const performance = await getRepPerformance(user.orgId, Number(req.query.days) || 30);
  return ok(res, { performance });
}));

router.get('/pipeline', requirePermission('reports.view'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const analytics = await getPipelineAnalytics(user.orgId);
  return ok(res, { analytics });
}));

router.get('/forecast', requirePermission('reports.view'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const forecast = await getRevenueForecast(user.orgId);
  return ok(res, { forecast });
}));

router.post('/snapshots', requirePermission('reports.view'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const period = (req.body?.period as string) || 'DAILY';
  const snapshot = await generateSnapshot(user.orgId, period as any);
  await audit({ orgId: user.orgId, userId: user.id, action: 'ANALYTICS_SNAPSHOT_GENERATED', req });
  return ok(res, { snapshot }, 201);
}));

router.get('/snapshots', requirePermission('reports.view'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const snapshots = await getSnapshots(user.orgId, (req.query.period as string) || 'DAILY', Number(req.query.limit) || 30);
  return ok(res, { snapshots });
}));

export default router;
