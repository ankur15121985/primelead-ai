/**
 * SMS Outbound Routes — send SMS replies to leads.
 *
 * POST   /api/sms-outbound/send   — send an SMS
 * GET    /api/sms-outbound/history — send history
 * GET    /api/sms-outbound/status  — provider status
 */
import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, ok, validate } from '../lib/http';
import { requireAuth, requirePermission, type AuthedRequest } from '../middleware/auth';
import * as smsProvider from '../services/sms-provider';

const router = Router();

const sendSmsSchema = z.object({
  to: z.string().min(10).max(20),
  body: z.string().min(1).max(1600),
  leadId: z.string().optional(),
  fromNumber: z.string().optional(),
});

/**
 * POST /api/sms-outbound/send — send an SMS reply
 */
router.post(
  '/send',
  requireAuth,
  requirePermission('calls.edit'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const input = validate(sendSmsSchema, req.body);
    const result = await smsProvider.sendSms({
      orgId: user.orgId,
      userId: user.id,
      ...input,
    });
    return ok(res, result);
  })
);

/**
 * GET /api/sms-outbound/history — send history
 */
router.get(
  '/history',
  requireAuth,
  requirePermission('calls.view'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const { leadId, days } = req.query;
    const history = await smsProvider.getSmsHistory(user.orgId, {
      leadId: leadId as string,
      days: days ? parseInt(days as string) : undefined,
    });
    return ok(res, { history, total: history.length });
  })
);

/**
 * GET /api/sms-outbound/status — provider status
 */
router.get(
  '/status',
  requireAuth,
  requirePermission('settings.view'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const status = await smsProvider.getProviderStatus(user.orgId);
    return ok(res, status);
  })
);

export default router;
