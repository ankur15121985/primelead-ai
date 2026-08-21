/**
 * SMS Routes — inbound webhook + stats + call-ready leads.
 *
 * POST /webhooks/sms           — Twilio/textbelt inbound webhook (public)
 * GET  /api/sms                — list inbound SMS (auth required)
 * GET  /api/sms/stats          — SMS statistics
 * GET  /api/sms/call-ready     — leads with phone numbers ready for outbound calls
 */
import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, badRequest, ok, validate } from '../lib/http';
import { requireAuth, requirePermission, type AuthedRequest } from '../middleware/auth';
import * as smsLeads from '../services/sms-leads';

const router = Router();

// ── Webhook (public, no auth — validated by provider secret) ──

const inboundSmsSchema = z.object({
  From: z.string(),
  To: z.string().optional(),
  Body: z.string(),
  MessageSid: z.string().optional(),
});

/**
 * POST /webhooks/sms — Twilio-style inbound SMS webhook.
 * Returns empty 200 (Twilio expects this).
 */
router.post(
  '/webhooks/sms',
  asyncHandler(async (req, res) => {
    // Validate Twilio signature in production (check X-Twilio-Signature header)
    // For now, accept all POSTs with a valid body

    const input = validate(inboundSmsSchema, req.body);

    // Resolve orgId from the "To" number (in production, look up in a number→org mapping)
    // For demo, use the first org
    const { prisma } = await import('../lib/prisma');
    const org = await prisma.organization.findFirst();
    const orgId = org?.id || 'default';

    const result = await smsLeads.processInboundSms({
      orgId,
      from: input.From,
      to: input.To,
      body: input.Body,
      providerMessageId: input.MessageSid,
    });

    // Twilio expects empty 200 response
    res.status(200).type('text/plain').send('');
  })
);

// ── Authenticated API routes ──

/**
 * GET /api/sms — list inbound SMS messages
 */
router.get(
  '/',
  requireAuth,
  requirePermission('leads.view'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const { status, days } = req.query;
    const messages = await smsLeads.listInboundSms(user.orgId, {
      status: status as string,
      days: days ? parseInt(days as string) : undefined,
    });
    return ok(res, { messages, total: messages.length });
  })
);

/**
 * GET /api/sms/stats — SMS statistics
 */
router.get(
  '/stats',
  requireAuth,
  requirePermission('leads.view'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const stats = await smsLeads.getSmsStats(user.orgId);
    return ok(res, stats);
  })
);

/**
 * GET /api/sms/call-ready — leads with phone numbers, ready for outbound calls
 */
router.get(
  '/call-ready',
  requireAuth,
  requirePermission('leads.view'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const limit = parseInt(req.query.limit as string) || 50;
    const leads = await smsLeads.getCallReadyLeads(user.orgId, { limit });
    return ok(res, { leads, total: leads.length });
  })
);

export default router;
