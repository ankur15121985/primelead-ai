import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, badRequest, ok, validate } from '../lib/http';
import { requireAuth, requirePermission, type AuthedRequest } from '../middleware/auth';
import {
  scheduleMessage,
  scheduleBatch,
  cancelMessage,
  cancelBatch,
  retryMessage,
  getMessage,
  listMessages,
  getQueueStats,
  getMessageLogs,
} from '../services/message-queue';
import { triggerTick, isSchedulerRunning } from '../services/scheduler';

const router = Router();

// ── Zod schemas ────────────────────────────────────────────

const scheduleMessageSchema = z.object({
  channel: z.enum(['WHATSAPP', 'EMAIL']),
  type: z.enum(['DIRECT', 'SEQUENCE', 'BROADCAST']).optional(),
  recipientPhone: z.string().optional(),
  recipientEmail: z.string().email().optional(),
  recipientName: z.string().optional(),
  leadId: z.string().optional(),
  contactId: z.string().optional(),
  conversationId: z.string().optional(),
  subject: z.string().optional(),
  body: z.string().min(1),
  templateName: z.string().optional(),
  templateParams: z.array(z.string()).optional(),
  templateLanguage: z.string().optional(),
  scheduledAt: z.string().datetime().optional(),
  priority: z.number().int().min(0).max(1000).optional(),
  batchId: z.string().optional(),
  source: z.string().optional(),
});

const scheduleBatchSchema = z.object({
  messages: z.array(
    z.object({
      channel: z.enum(['WHATSAPP', 'EMAIL']),
      type: z.enum(['DIRECT', 'SEQUENCE', 'BROADCAST']).optional(),
      recipientPhone: z.string().optional(),
      recipientEmail: z.string().email().optional(),
      recipientName: z.string().optional(),
      leadId: z.string().optional(),
      contactId: z.string().optional(),
      conversationId: z.string().optional(),
      subject: z.string().optional(),
      body: z.string().min(1),
      templateName: z.string().optional(),
      templateParams: z.array(z.string()).optional(),
      templateLanguage: z.string().optional(),
    })
  ).min(1).max(500),
  scheduledAt: z.string().datetime().optional(),
  priority: z.number().int().min(0).max(1000).optional(),
  source: z.string().optional(),
});

// ── Queue stats ────────────────────────────────────────────

router.get(
  '/stats',
  requireAuth,
  requirePermission('leads.view'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const stats = await getQueueStats(user.orgId);
    return ok(res, { stats, scheduler: { running: isSchedulerRunning() } });
  })
);

// ── List messages ──────────────────────────────────────────

router.get(
  '/',
  requireAuth,
  requirePermission('leads.view'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const q = req.query as Record<string, string>;
    const result = await listMessages(user.orgId, {
      status: q.status,
      channel: q.channel,
      batchId: q.batchId,
      page: Number(q.page) || 1,
      limit: Number(q.limit) || 50,
    });
    return ok(res, result);
  })
);

// ── Get single message ─────────────────────────────────────

router.get(
  '/:id',
  requireAuth,
  requirePermission('leads.view'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const msg = await getMessage(req.params.id, user.orgId);
    return ok(res, { message: msg });
  })
);

// ── Get message logs ───────────────────────────────────────

router.get(
  '/:id/logs',
  requireAuth,
  requirePermission('leads.view'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const logs = await getMessageLogs(req.params.id, user.orgId);
    return ok(res, { logs });
  })
);

// ── Schedule a single message ──────────────────────────────

router.post(
  '/',
  requireAuth,
  requirePermission('leads.edit'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const input = validate(scheduleMessageSchema, req.body);

    const scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : undefined;

    const message = await scheduleMessage({
      orgId: user.orgId,
      userId: user.id,
      channel: input.channel,
      type: input.type,
      recipientPhone: input.recipientPhone,
      recipientEmail: input.recipientEmail,
      recipientName: input.recipientName,
      leadId: input.leadId,
      contactId: input.contactId,
      conversationId: input.conversationId,
      subject: input.subject,
      body: input.body,
      templateName: input.templateName,
      templateParams: input.templateParams,
      templateLanguage: input.templateLanguage,
      scheduledAt,
      priority: input.priority,
      batchId: input.batchId,
      source: input.source || 'API',
    });

    return ok(res, { message }, 201);
  })
);

// ── Schedule a batch ───────────────────────────────────────

router.post(
  '/batch',
  requireAuth,
  requirePermission('leads.edit'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const input = validate(scheduleBatchSchema, req.body);

    const scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : undefined;

    const result = await scheduleBatch(
      user.orgId,
      input.messages.map((m) => ({
        channel: m.channel,
        type: m.type,
        recipientPhone: m.recipientPhone,
        recipientEmail: m.recipientEmail,
        recipientName: m.recipientName,
        leadId: m.leadId,
        contactId: m.contactId,
        conversationId: m.conversationId,
        subject: m.subject,
        body: m.body,
        templateName: m.templateName,
        templateParams: m.templateParams,
        templateLanguage: m.templateLanguage,
      })),
      { scheduledAt, priority: input.priority, source: input.source || 'API' }
    );

    return ok(res, result, 201);
  })
);

// ── Cancel a message ───────────────────────────────────────

router.post(
  '/:id/cancel',
  requireAuth,
  requirePermission('leads.edit'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const result = await cancelMessage(req.params.id, user.orgId);
    return ok(res, result);
  })
);

// ── Cancel a batch ─────────────────────────────────────────

router.post(
  '/batch/:batchId/cancel',
  requireAuth,
  requirePermission('leads.edit'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const result = await cancelBatch(req.params.batchId, user.orgId);
    return ok(res, result);
  })
);

// ── Retry a failed message ─────────────────────────────────

router.post(
  '/:id/retry',
  requireAuth,
  requirePermission('leads.edit'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const result = await retryMessage(req.params.id, user.orgId);
    return ok(res, result);
  })
);

// ── Manual tick trigger (admin) ────────────────────────────

router.post(
  '/process/tick',
  requireAuth,
  requirePermission('leads.edit'),
  asyncHandler(async (req, res) => {
    // Manual trigger — process up to 50 messages
    const { processDueMessages } = await import('../services/message-queue');
    const processed = await processDueMessages(50);
    return ok(res, { processed });
  })
);

export default router;
