import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { asyncHandler, badRequest, ok, validate } from '../lib/http';
import { requireAuth, type AuthedRequest } from '../middleware/auth';
import { writeFollowUp, isAiReady } from '../services/ai-followup';
import { generateAssistantReply } from '../services/ai-chat';
import { aiFollowUpSchema, aiChatSchema } from '../validators/schemas';
import { sourceLabel } from '../constants';
import { getOrgSetting } from '../services/assignment';

const router = Router();

// Per-org AI settings: if the org stored its own key it takes priority,
// otherwise the global env config is used.
router.get(
  '/status',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const orgAi = await getOrgSetting(user.orgId, 'ai');
    const orgConfigured = Boolean((orgAi as any)?.apiKey || (orgAi as any)?.configured);
    return ok(res, { configured: isAiReady() || orgConfigured });
  })
);

router.post(
  '/follow-up',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const input = validate(aiFollowUpSchema, req.body);
    const lead = await prisma.lead.findFirst({
      where: { id: input.leadId, orgId: user.orgId, deletedAt: null },
      include: {
        activities: { orderBy: { createdAt: 'desc' }, take: 15 },
        tasks: { orderBy: { dueAt: 'desc' }, take: 3 },
      },
    });
    if (!lead) throw badRequest('Lead not found');
    if (user.role === 'SALES' && lead.ownerId !== user.id) throw badRequest('Lead not found');

    const stageName = lead.stageId
      ? (await prisma.pipelineStage.findUnique({ where: { id: lead.stageId } }))?.name
      : lead.status;
    const lastActivity = lead.activities[0];
    const activities = lead.activities
      .map((a) => {
        const who = a.userId === user.id ? 'You' : 'A colleague';
        return `${who} — ${a.title}: ${a.body || ''}`;
      })
      .reverse();

    const orgAi = (await getOrgSetting(user.orgId, 'ai')) || {};
    const aiKey = (orgAi as any).apiKey;
    const aiModel = (orgAi as any).model;

    // Org-level key overrides the global env config for this request
    if (aiKey) {
      const { setAiOverride } = await import('../ai/provider');
      setAiOverride({ apiKey: aiKey, model: aiModel || undefined });
    }

    const result = await writeFollowUp({
      customerName: lead.name,
      leadSource: sourceLabel(lead.source),
      stage: stageName || lead.status,
      priority: lead.priority,
      expectedValue: lead.expectedValue,
      productService: input.productService || lead.notes?.slice(0, 120),
      notes: lead.notes || '',
      lastContactDate: lead.lastContactedAt
        ? lead.lastContactedAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
        : undefined,
      lastActivity: lastActivity?.title || 'None',
      activities,
      objective: input.objective || 'continue the conversation and move the lead to the next stage',
      channel: input.channel || 'whatsapp',
      tone: input.tone || 'friendly',
      language: input.language || 'hinglish',
    });
    return ok(res, result);
  })
);

// ── Conversational CRM assistant ─────────────────────────────────
router.get(
  '/conversations',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const conversations = await prisma.aiConversation.findMany({
      where: { orgId: user.orgId, userId: user.id },
      orderBy: { updatedAt: 'desc' },
      take: 20,
      include: { messages: { orderBy: { createdAt: 'asc' }, take: 4 } },
    });
    return ok(res, {
      conversations: conversations.map((c) => ({
        id: c.id,
        topic: c.topic,
        updatedAt: c.updatedAt,
        preview: c.messages[c.messages.length - 1]?.content || '',
      })),
    });
  })
);

router.get(
  '/conversations/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const conversation = await prisma.aiConversation.findFirst({
      where: { id: req.params.id, orgId: user.orgId, userId: user.id },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!conversation) throw badRequest('Conversation not found');
    return ok(res, { conversation });
  })
);

/** Send a message; persists user + assistant turns, returns the assistant reply. */
router.post(
  '/chat',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const input = validate(aiChatSchema, req.body);

    let conversationId = input.conversationId || null;
    if (conversationId) {
      const existing = await prisma.aiConversation.findFirst({
        where: { id: conversationId, orgId: user.orgId, userId: user.id },
      });
      if (!existing) conversationId = null;
    }
    if (!conversationId) {
      const created = await prisma.aiConversation.create({
        data: { orgId: user.orgId, userId: user.id, topic: input.message.slice(0, 80) },
      });
      conversationId = created.id;
    }

    await prisma.aiMessage.create({
      data: { conversationId, role: 'user', content: input.message },
    });

    let reply: string;
    try {
      reply = await generateAssistantReply(
        { orgId: user.orgId, userId: user.id, role: user.role, userName: user.name },
        input.message
      );
    } catch (err: any) {
      // Persist a friendly failure so the user isn't left hanging.
      if (err?.status === 503) {
        await prisma.aiMessage.create({
          data: {
            conversationId,
            role: 'assistant',
            content: '⚠️ AI is not configured yet. Add an API key in Settings → AI to unlock the assistant.',
          },
        });
        return ok(res, { conversationId, reply: '', notConfigured: true });
      }
      throw err;
    }

    await prisma.aiMessage.create({
      data: { conversationId, role: 'assistant', content: reply },
    });
    await prisma.aiConversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });

    return ok(res, { conversationId, reply, notConfigured: false });
  })
);

export default router;
