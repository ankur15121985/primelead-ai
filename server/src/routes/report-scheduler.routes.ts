import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, badRequest, ok, validate } from '../lib/http';
import { requireAuth, requirePermission, type AuthedRequest } from '../middleware/auth';
import * as scheduler from '../services/report-scheduler';

const router = Router();

const createScheduledReportSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  reportConfig: z.object({
    entity: z.string(),
    metrics: z.array(z.string()),
    dimensions: z.array(z.string()),
    filters: z.record(z.string()).optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
    limit: z.number().optional(),
  }),
  schedule: z.object({
    frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']),
    dayOfWeek: z.number().min(0).max(6).optional(),
    dayOfMonth: z.number().min(1).max(31).optional(),
    hour: z.number().min(0).max(23).optional(),
    timezone: z.string().optional(),
  }),
  recipients: z.array(z.string().email()).optional(),
  webhookUrl: z.string().url().optional(),
  format: z.enum(['CSV', 'JSON']).default('CSV'),
  enabled: z.boolean().optional(),
});

/** List scheduled reports */
router.get(
  '/',
  requireAuth,
  requirePermission('settings.view'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const reports = await scheduler.listScheduledReports(user.orgId);
    return ok(res, { reports, total: reports.length });
  })
);

/** Get a scheduled report */
router.get(
  '/:id',
  requireAuth,
  requirePermission('settings.view'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const report = await scheduler.getScheduledReport(user.orgId, req.params.id);
    return ok(res, report);
  })
);

/** Create a scheduled report */
router.post(
  '/',
  requireAuth,
  requirePermission('settings.edit'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const input = validate(createScheduledReportSchema, req.body);
    const report = await scheduler.createScheduledReport(user.orgId, user.id, input as scheduler.ScheduleReportInput);
    return ok(res, report, 201);
  })
);

/** Update a scheduled report */
router.patch(
  '/:id',
  requireAuth,
  requirePermission('settings.edit'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const input = validate(createScheduledReportSchema.partial(), req.body);
    const report = await scheduler.updateScheduledReport(user.orgId, req.params.id, input as Partial<scheduler.ScheduleReportInput>);
    return ok(res, report);
  })
);

/** Delete a scheduled report */
router.delete(
  '/:id',
  requireAuth,
  requirePermission('settings.edit'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const result = await scheduler.deleteScheduledReport(user.orgId, req.params.id);
    return ok(res, result);
  })
);

/** Manually run a scheduled report now */
router.post(
  '/:id/run',
  requireAuth,
  requirePermission('settings.edit'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const result = await scheduler.runScheduledReport(user.orgId, req.params.id);
    return ok(res, result);
  })
);

/** Get run history for a scheduled report */
router.get(
  '/:id/history',
  requireAuth,
  requirePermission('settings.view'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const limit = parseInt(req.query.limit as string) || 50;
    const history = await scheduler.getReportRunHistory(user.orgId, req.params.id, limit);
    return ok(res, { history, total: history.length });
  })
);

/** Process all due reports (admin trigger) */
router.post(
  '/process/tick',
  requireAuth,
  requirePermission('settings.edit'),
  asyncHandler(async (_req, res) => {
    const processed = await scheduler.processDueReports();
    return ok(res, { processed });
  })
);

export default router;
