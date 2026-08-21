/**
 * Phase 18 — Revenue forecasting routes.
 *
 * Calculate, save, and view revenue forecasts.
 */
import { Router } from 'express';
import { requireAuth, requirePermission, type AuthedRequest } from '../middleware/auth';
import { asyncHandler, badRequest, ok, validate } from '../lib/http';
import { calculateForecast, saveForecast, getForecasts, getForecastSummary } from '../services/forecasting';
import { z } from 'zod';

const router = Router();
router.use(requireAuth);

/**
 * POST /api/forecast/calculate
 * Calculate forecast from current pipeline data.
 */
router.post('/calculate', requirePermission('contacts.view'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const input = validate(z.object({
    period: z.string().optional(),
    periodType: z.enum(['WEEK', 'MONTH', 'QUARTER']).optional(),
    userId: z.string().optional(),
    territoryId: z.string().optional(),
  }), req.body);

  const forecast = await calculateForecast(user.orgId, input);
  return ok(res, { forecast });
}));

/**
 * POST /api/forecast/save
 * Save a forecast entry (with optional manual overrides).
 */
router.post('/save', requirePermission('contacts.edit'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const input = validate(z.object({
    period: z.string().min(1).max(20),
    periodType: z.enum(['WEEK', 'MONTH', 'QUARTER']).optional(),
    userId: z.string().optional(),
    territoryId: z.string().optional(),
    manualCommit: z.number().int().min(0).optional(),
    manualBestCase: z.number().int().min(0).optional(),
    manualPipeline: z.number().int().min(0).optional(),
    isLocked: z.boolean().optional(),
  }), req.body);

  const entry = await saveForecast(user.orgId, input);
  return ok(res, { entry });
}));

/**
 * GET /api/forecast
 * List forecast entries.
 */
router.get('/', requirePermission('contacts.view'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const q = req.query as Record<string, string>;
  const forecasts = await getForecasts(user.orgId, q.period || undefined, q.userId || undefined);
  return ok(res, { forecasts });
}));

/**
 * GET /api/forecast/summary
 * Get aggregated forecast summary for a period.
 */
router.get('/summary', requirePermission('contacts.view'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const q = req.query as Record<string, string>;
  if (!q.period) return badRequest('period query param is required');
  const summary = await getForecastSummary(user.orgId, q.period);
  return ok(res, { summary });
}));

export default router;
