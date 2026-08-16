/**
 * WhatsApp service — the shared team inbox engine.
 *
 * Every inbound/outbound message flows through here regardless of provider,
 * so the demo simulator and a real Meta webhook behave identically:
 *
 *   inbound  → dedupe by waMessageId → find-or-create conversation (linked to
 *              a lead by phone) → bump unread/lastMessageAt → activity + notify
 *   outbound → create message → provider.send → status SENT (or FAILED)
 *   status   → SENT/DELIVERED/READ/FAILED applied by provider message id
 */
import { prisma } from '../lib/prisma';
import { notify } from '../lib/serializers';
import { resolveWhatsAppProvider, normalizeWaId } from '../whatsapp/provider';
import { badRequest, notFound } from '../lib/http';

export interface InboundMessageInput {
  orgId: string;
  from: string;
  waMessageId: string;
  body?: string | null;
  mediaUrl?: string | null;
  mediaType?: string | null;
  type?: 'TEXT' | 'MEDIA' | 'TEMPLATE';
  templateName?: string | null;
  timestamp?: number;
}

/** Create a conversation for a customer number, linking an org lead by phone. */
export async function findOrCreateConversation(orgId: string, waId: string, customerName?: string | null) {
  const normalized = normalizeWaId(waId);
  const existing = await prisma.conversation.findUnique({ where: { orgId_waId: { orgId, waId: normalized } } });
  if (existing) return existing;

  // Link to a lead whose phone matches (drop the 91 country prefix).
  let lead: { id: string; name: string } | null = null;
  const local = normalized.length === 12 && normalized.startsWith('91') ? normalized.slice(2) : normalized;
  if (local.length >= 10) {
    lead = await prisma.lead.findFirst({
      where: { orgId, deletedAt: null, phone: local.slice(-10) },
      select: { id: true, name: true },
    });
  }

  return prisma.conversation.create({
    data: {
      orgId,
      waId: normalized,
      leadId: lead?.id || null,
      customerName: customerName || lead?.name || 'WhatsApp contact',
    },
  });
}

/** Handle an inbound customer message (deduplicated by provider message id). */
export async function handleInboundMessage(input: InboundMessageInput) {
  // Idempotency: the provider message id is unique on the Message row.
  const dup = input.waMessageId
    ? await prisma.message.findUnique({ where: { waMessageId: input.waMessageId } })
    : null;
  if (dup) return { duplicate: true, conversationId: dup.conversationId };

  const conversation = await findOrCreateConversation(input.orgId, input.from);
  const body = input.body || (input.type === 'MEDIA' ? (input.mediaType || 'Media').toUpperCase() : '');
  const preview = (body || '').slice(0, 120);

  const message = await prisma.message.create({
    data: {
      orgId: input.orgId,
      conversationId: conversation.id,
      direction: 'INBOUND',
      type: input.type || 'TEXT',
      body,
      mediaUrl: input.mediaUrl || null,
      mediaType: input.mediaType || null,
      waMessageId: input.waMessageId || null,
      waTemplateName: input.templateName || null,
      status: 'SENT',
      sentAt: input.timestamp ? new Date(input.timestamp) : new Date(),
    },
  });

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: {
      status: 'OPEN',
      lastMessageAt: new Date(),
      lastMessagePreview: preview,
      unreadCount: { increment: 1 },
    },
  });

  // Reflect the conversation on the linked lead + log it on the timeline.
  if (conversation.leadId) {
    await prisma.lead.update({
      where: { id: conversation.leadId },
      data: { lastContactedAt: new Date() },
    });
    await prisma.activity.create({
      data: {
        orgId: input.orgId,
        leadId: conversation.leadId,
        userId: undefined,
        type: 'WHATSAPP',
        title: 'WhatsApp received',
        body: preview || 'Media message',
      },
    });
  }

  // Notify the assignee (or the lead owner when unassigned) once.
  const assigneeId = conversation.assigneeId;
  const ownerId = conversation.leadId
    ? (await prisma.lead.findUnique({ where: { id: conversation.leadId }, select: { ownerId: true } }))?.ownerId
    : null;
  const targetId = assigneeId || ownerId;
  if (targetId) {
    await notify({
      orgId: input.orgId,
      userId: targetId,
      type: 'SYSTEM',
      title: 'New WhatsApp message',
      body: `${conversation.customerName}: ${preview || 'Media message'}`,
      link: `/app/inbox?c=${conversation.id}`,
    });
  }

  return { duplicate: false, conversationId: conversation.id, messageId: message.id };
}

/** Apply a provider delivery/read status update (idempotent by message id). */
export async function handleStatusUpdate(opts: {
  orgId: string;
  waMessageId: string;
  status: 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
  error?: string;
  timestamp?: number;
}) {
  const message = await prisma.message.findFirst({
    where: { waMessageId: opts.waMessageId, orgId: opts.orgId },
    select: { id: true, status: true, conversationId: true },
  });
  if (!message) return { updated: false };

  const data: Record<string, unknown> = { status: opts.status };
  if (opts.status === 'DELIVERED' && !message.status.includes('DELIVERED') && !message.status.includes('READ')) data.deliveredAt = opts.timestamp ? new Date(opts.timestamp) : new Date();
  if (opts.status === 'READ') data.readAt = opts.timestamp ? new Date(opts.timestamp) : new Date();
  if (opts.status === 'FAILED') data.error = opts.error || 'delivery failed';
  // Don't downgrade a stronger status (READ > DELIVERED > SENT).
  const rank: Record<string, number> = { QUEUED: 0, SENT: 1, DELIVERED: 2, READ: 3 };
  const current = rank[message.status] ?? 0;
  const incoming = rank[opts.status] ?? 0;
  if (incoming >= current) {
    await prisma.message.update({ where: { id: message.id }, data });
  }
  return { updated: true, conversationId: message.conversationId };
}

export interface OutboundMessageInput {
  orgId: string;
  conversationId: string;
  actorId: string;
  body?: string;
  templateName?: string;
  templateParams?: string[];
  templateLanguage?: string;
}

/** Send an outbound message via the org's provider. */
export async function sendMessage(input: OutboundMessageInput) {
  const conversation = await prisma.conversation.findFirst({
    where: { id: input.conversationId, orgId: input.orgId },
    include: { lead: { select: { id: true, name: true } } },
  });
  if (!conversation) throw notFound('Conversation not found');
  if (!input.body && !input.templateName) throw badRequest('Write a message or pick a template.');

  const provider = await resolveWhatsAppProvider(input.orgId);

  const message = await prisma.message.create({
    data: {
      orgId: input.orgId,
      conversationId: conversation.id,
      direction: 'OUTBOUND',
      type: input.templateName ? 'TEMPLATE' : 'TEXT',
      body: input.body || null,
      waTemplateName: input.templateName || null,
      status: 'QUEUED',
      metadata: input.templateParams ? { params: input.templateParams, language: input.templateLanguage || 'en' } : undefined,
    },
  });

  let status: string;
  let waMessageId: string | null = null;
  let error: string | null = null;
  try {
    const result = input.templateName
      ? await provider.sendTemplate({
          orgId: input.orgId,
          to: conversation.waId,
          templateName: input.templateName,
          language: input.templateLanguage || 'en',
          params: input.templateParams,
        })
      : await provider.sendText({ orgId: input.orgId, to: conversation.waId, body: input.body || '' });
    waMessageId = result.waMessageId;
    status = 'SENT';
  } catch (err: any) {
    status = 'FAILED';
    error = err instanceof Error ? err.message.slice(0, 300) : 'send failed';
  }

  await prisma.message.update({
    where: { id: message.id },
    data: {
      status,
      waMessageId: waMessageId || undefined,
      error,
      sentAt: status === 'SENT' ? new Date() : null,
    },
  });

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: {
      lastMessageAt: new Date(),
      lastMessagePreview: (input.body || input.templateName || '').slice(0, 120),
    },
  });

  if (conversation.leadId) {
    await prisma.activity.create({
      data: {
        orgId: input.orgId,
        leadId: conversation.leadId,
        userId: input.actorId,
        type: 'WHATSAPP',
        title: 'WhatsApp sent',
        body: input.body || `Template: ${input.templateName}`,
      },
    });
  }

  return { messageId: message.id, status, error };
}

/** Assign / unassign a conversation. */
export async function assignConversation(orgId: string, conversationId: string, assigneeId: string | null) {
  const conversation = await prisma.conversation.findFirst({ where: { id: conversationId, orgId } });
  if (!conversation) throw notFound('Conversation not found');
  if (assigneeId) {
    const target = await prisma.user.findFirst({ where: { id: assigneeId, orgId, active: true } });
    if (!target) throw badRequest('The assigned user is not part of your team.');
  }
  return prisma.conversation.update({ where: { id: conversationId }, data: { assigneeId } });
}

/** Open / close / label a conversation. */
export async function updateConversation(
  orgId: string,
  conversationId: string,
  data: { status?: 'OPEN' | 'CLOSED'; labels?: string[] }
) {
  const conversation = await prisma.conversation.findFirst({ where: { id: conversationId, orgId } });
  if (!conversation) throw notFound('Conversation not found');
  const update: Record<string, unknown> = {};
  if (data.status) update.status = data.status;
  if (data.labels) update.labels = data.labels as any;
  return prisma.conversation.update({ where: { id: conversationId }, data: update });
}

export async function markConversationRead(orgId: string, conversationId: string) {
  const conversation = await prisma.conversation.findFirst({ where: { id: conversationId, orgId } });
  if (!conversation) throw notFound('Conversation not found');
  return prisma.conversation.update({ where: { id: conversationId }, data: { unreadCount: 0 } });
}

/** Serializer — paise-free, hides nothing sensitive beyond what the UI needs. */
export function serializeConversation(c: any) {
  return {
    id: c.id,
    leadId: c.leadId,
    lead: c.lead ? { id: c.lead.id, name: c.lead.name, phone: c.lead.phone } : null,
    waId: c.waId,
    customerName: c.customerName,
    channel: c.channel,
    status: c.status,
    assigneeId: c.assigneeId,
    assignee: c.assignee ? { id: c.assignee.id, name: c.assignee.name } : null,
    labels: c.labels || [],
    lastMessageAt: c.lastMessageAt,
    lastMessagePreview: c.lastMessagePreview,
    unreadCount: c.unreadCount,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

export function serializeMessage(m: any) {
  return {
    id: m.id,
    conversationId: m.conversationId,
    direction: m.direction,
    channel: m.channel,
    type: m.type,
    body: m.body,
    mediaUrl: m.mediaUrl,
    mediaType: m.mediaType,
    waTemplateName: m.waTemplateName,
    status: m.status,
    error: m.error,
    sentAt: m.sentAt,
    deliveredAt: m.deliveredAt,
    readAt: m.readAt,
    createdAt: m.createdAt,
  };
}
