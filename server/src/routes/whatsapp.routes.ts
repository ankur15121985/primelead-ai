/**
 * WhatsApp shared team inbox routes.
 *
 *   GET    /api/whatsapp/conversations            — list (filters: status, assignee, mine, q)
 *   GET    /api/whatsapp/conversations/:id        — conversation + messages
 *   POST   /api/whatsapp/conversations/:id/messages — send outbound (text or template)
 *   PATCH  /api/whatsapp/conversations/:id        — assign / close / labels
 *   POST   /api/whatsapp/conversations/:id/read   — mark read
 *   GET    /api/whatsapp/templates                — org template catalog
 *   POST   /api/whatsapp/templates                — create template
 *   PATCH  /api/whatsapp/templates/:id            — pause / activate
 *   DELETE /api/whatsapp/templates/:id            — delete template
 *   GET    /api/whatsapp/settings                 — provider config (secrets write-only)
 *   PATCH  /api/whatsapp/settings                 — connect / update provider
 *   POST   /api/whatsapp/demo/inbound             — simulate an inbound customer message
 *
 * Inbound webhooks (Meta hub verification + signed events) live in
 * whatsapp-webhook.routes.ts, mounted with a raw body before JSON parsing.
 */
import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { asyncHandler, badRequest, notFound, ok, validate } from '../lib/http';
import { requireAuth, requirePermission, type AuthedRequest } from '../middleware/auth';
import {
  sendMessage,
  assignConversation,
  updateConversation,
  markConversationRead,
  handleInboundMessage,
  serializeConversation,
  serializeMessage,
} from '../services/whatsapp';
import { getWhatsAppConfig, normalizeWaId } from '../whatsapp/provider';
import { waSendSchema, waSettingsSchema, waTemplateSchema, waDemoInboundSchema } from '../validators/schemas';

const router = Router();

// ── List conversations ──────────────────────────────────────────────
router.get(
  '/conversations',
  requireAuth,
  requirePermission('inbox.view'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const status = String(req.query.status || 'OPEN');
    const q = String(req.query.q || '').trim();
    const mine = req.query.mine === '1' || req.query.mine === 'true';

    const where: Record<string, unknown> = { orgId: user.orgId };
    if (status === 'OPEN' || status === 'CLOSED') where.status = status;
    if (mine) where.assigneeId = user.id;
    if (q) {
      const digits = q.replace(/\D/g, '');
      where.OR = [
        { customerName: { contains: q, mode: 'insensitive' } },
        ...(digits.length >= 4 ? [{ waId: { contains: digits } }] : []),
        ...(digits.length >= 10 ? [{ waId: { contains: digits.slice(-10) } }] : []),
      ];
    }

    const conversations = await prisma.conversation.findMany({
      where,
      orderBy: [{ lastMessageAt: 'desc' }, { updatedAt: 'desc' }],
      take: 100,
      include: {
        lead: { select: { id: true, name: true, phone: true } },
        assignee: { select: { id: true, name: true } },
      },
    });

    const unread = await prisma.conversation.aggregate({
      where: { orgId: user.orgId, unreadCount: { gt: 0 } },
      _sum: { unreadCount: true },
    });

    return ok(res, {
      conversations: conversations.map(serializeConversation),
      unreadTotal: unread._sum.unreadCount || 0,
    });
  })
);

// ── Conversation detail + messages ─────────────────────────────────
router.get(
  '/conversations/:id',
  requireAuth,
  requirePermission('inbox.view'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const conversation = await prisma.conversation.findFirst({
      where: { id: req.params.id, orgId: user.orgId },
      include: {
        lead: { select: { id: true, name: true, phone: true, company: true, status: true } },
        assignee: { select: { id: true, name: true } },
      },
    });
    if (!conversation) throw notFound('Conversation not found');

    const messages = await prisma.message.findMany({
      where: { conversationId: conversation.id, orgId: user.orgId },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });

    return ok(res, { conversation: serializeConversation(conversation), messages: messages.map(serializeMessage) });
  })
);

// ── Send an outbound message ───────────────────────────────────────
router.post(
  '/conversations/:id/messages',
  requireAuth,
  requirePermission('inbox.send'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const input = validate(waSendSchema, req.body);
    const result = await sendMessage({
      orgId: user.orgId,
      conversationId: req.params.id,
      actorId: user.id,
      body: input.body || undefined,
      templateName: input.templateName || undefined,
      templateParams: input.templateParams,
      templateLanguage: input.templateLanguage,
    });
    return ok(res, { sent: result.status !== 'FAILED', ...result }, result.status === 'FAILED' ? 502 : 201);
  })
);

// ── Assign / close / label ─────────────────────────────────────────
router.patch(
  '/conversations/:id',
  requireAuth,
  requirePermission('inbox.assign'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const body = (req.body || {}) as Record<string, unknown>;
    let conversation;
    if (body.assigneeId !== undefined) {
      conversation = await assignConversation(user.orgId, req.params.id, body.assigneeId as string | null);
    } else if (body.status || body.labels) {
      conversation = await updateConversation(user.orgId, req.params.id, {
        status: body.status as 'OPEN' | 'CLOSED' | undefined,
        labels: body.labels as string[] | undefined,
      });
    } else {
      throw badRequest('Nothing to update.');
    }
    return ok(res, { updated: true, conversation: serializeConversation(conversation) });
  })
);

// ── Mark read ──────────────────────────────────────────────────────
router.post(
  '/conversations/:id/read',
  requireAuth,
  requirePermission('inbox.view'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    await markConversationRead(user.orgId, req.params.id);
    return ok(res, { updated: true });
  })
);

// ── Templates ──────────────────────────────────────────────────────
router.get(
  '/templates',
  requireAuth,
  requirePermission('inbox.view'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const templates = await prisma.waTemplate.findMany({ where: { orgId: user.orgId }, orderBy: { name: 'asc' } });
    return ok(res, { templates });
  })
);

router.post(
  '/templates',
  requireAuth,
  requirePermission('inbox.manage'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const input = validate(waTemplateSchema, req.body);
    const template = await prisma.waTemplate.create({
      data: {
        orgId: user.orgId,
        name: input.name,
        category: input.category || 'UTILITY',
        language: input.language || 'en',
        body: input.body,
        status: input.status || 'ACTIVE',
      },
    });
    return ok(res, { template }, 201);
  })
);

router.patch(
  '/templates/:id',
  requireAuth,
  requirePermission('inbox.manage'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const existing = await prisma.waTemplate.findFirst({ where: { id: req.params.id, orgId: user.orgId } });
    if (!existing) throw notFound('Template not found');
    const body = (req.body || {}) as Record<string, unknown>;
    const data: Record<string, unknown> = {};
    if (body.status === 'ACTIVE' || body.status === 'PAUSED') data.status = body.status;
    if (typeof body.body === 'string') data.body = body.body;
    const template = await prisma.waTemplate.update({ where: { id: existing.id }, data });
    return ok(res, { template });
  })
);

router.delete(
  '/templates/:id',
  requireAuth,
  requirePermission('inbox.manage'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const existing = await prisma.waTemplate.findFirst({ where: { id: req.params.id, orgId: user.orgId } });
    if (!existing) throw notFound('Template not found');
    await prisma.waTemplate.delete({ where: { id: existing.id } });
    return ok(res, { deleted: true });
  })
);

// ── Provider settings ──────────────────────────────────────────────
router.get(
  '/settings',
  requireAuth,
  requirePermission('inbox.manage'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    return ok(res, { settings: await getWhatsAppConfig(user.orgId) });
  })
);

router.patch(
  '/settings',
  requireAuth,
  requirePermission('inbox.manage'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const input = validate(waSettingsSchema, req.body);

    const existing = await prisma.orgSetting.findUnique({ where: { orgId_key: { orgId: user.orgId, key: 'whatsapp' } } });
    const current = (existing?.value as any) || {};

    const next: Record<string, unknown> = { ...current };
    if (input.enabled !== undefined) next.enabled = input.enabled;
    if (input.provider) next.provider = input.provider;
    if (input.phoneNumberId !== undefined) next.phoneNumberId = input.phoneNumberId || null;
    if (input.verifyToken !== undefined) next.verifyToken = input.verifyToken || null;
    // Token is write-only: an empty string means "keep", and it is never echoed.
    if (input.token) next.token = input.token;

    await prisma.orgSetting.upsert({
      where: { orgId_key: { orgId: user.orgId, key: 'whatsapp' } },
      create: { orgId: user.orgId, key: 'whatsapp', value: next as any },
      update: { value: next as any },
    });

    return ok(res, { settings: await getWhatsAppConfig(user.orgId) });
  })
);

// ── Demo inbound simulator ─────────────────────────────────────────
// Drives the exact same service the real Meta webhook uses, so the shared
// inbox is fully testable without external credentials.
router.post(
  '/demo/inbound',
  requireAuth,
  requirePermission('inbox.send'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const input = validate(waDemoInboundSchema, req.body);
    const result = await handleInboundMessage({
      orgId: user.orgId,
      from: input.from,
      body: input.body,
      mediaUrl: input.mediaUrl || null,
      mediaType: input.mediaType || null,
      type: input.type || (input.mediaUrl ? 'MEDIA' : 'TEXT'),
      waMessageId: `demo_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
    });
    // Normalize the customer's number for the response, never leak internals.
    return ok(res, { received: !result.duplicate, conversationId: result.conversationId, normalizedFrom: normalizeWaId(input.from) }, 201);
  })
);

export default router;
