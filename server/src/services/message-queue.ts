/**
 * Scheduled Messaging Queue — the core engine for deferred WhatsApp/email sends.
 *
 * Messages are enqueued with a `scheduledAt` timestamp and a processor
 * (setInterval-based, started at app boot) picks them up when due.
 * Failed messages are retried with exponential back-off up to `maxRetries`.
 *
 * Channels: WHATSAPP (via the existing WhatsApp provider abstraction) and
 * EMAIL (via nodemailer). SMS is a future channel stub.
 */
import { prisma } from '../lib/prisma';
import { resolveWhatsAppProvider } from '../whatsapp/provider';
import { badRequest, notFound } from '../lib/http';
import { notify } from '../lib/serializers';

// ── Types ─────────────────────────────────────────────────

export interface ScheduleMessageInput {
  orgId: string;
  userId?: string;
  channel: 'WHATSAPP' | 'EMAIL';
  type?: 'DIRECT' | 'SEQUENCE' | 'BROADCAST';
  recipientPhone?: string;
  recipientEmail?: string;
  recipientName?: string;
  leadId?: string;
  contactId?: string;
  conversationId?: string;
  subject?: string;
  body: string;
  templateName?: string;
  templateParams?: string[];
  templateLanguage?: string;
  scheduledAt?: Date; // default: now
  priority?: number;
  batchId?: string;
  source?: string;
  metadata?: Record<string, unknown>;
}

export interface QueueStats {
  total: number;
  pending: number;
  processing: number;
  sent: number;
  failed: number;
  cancelled: number;
  byChannel: Record<string, number>;
  byStatus: Record<string, number>;
  nextScheduledAt: Date | null;
}

// ── Schedule ──────────────────────────────────────────────

export async function scheduleMessage(input: ScheduleMessageInput) {
  if (!input.body && !input.templateName) {
    throw badRequest('Provide a message body or template.');
  }
  if (input.channel === 'WHATSAPP' && !input.recipientPhone) {
    throw badRequest('WhatsApp messages require a recipient phone number.');
  }
  if (input.channel === 'EMAIL' && !input.recipientEmail) {
    throw badRequest('Email messages require a recipient email address.');
  }

  const scheduledAt = input.scheduledAt || new Date();

  const message = await prisma.scheduledMessage.create({
    data: {
      orgId: input.orgId,
      userId: input.userId || null,
      channel: input.channel,
      type: input.type || 'DIRECT',
      recipientPhone: input.recipientPhone || null,
      recipientEmail: input.recipientEmail || null,
      recipientName: input.recipientName || null,
      leadId: input.leadId || null,
      contactId: input.contactId || null,
      conversationId: input.conversationId || null,
      subject: input.subject || null,
      body: input.body || null,
      templateName: input.templateName || null,
      templateParams: input.templateParams ? (input.templateParams as any) : undefined,
      templateLanguage: input.templateLanguage || null,
      scheduledAt,
      priority: input.priority ?? 100,
      batchId: input.batchId || null,
      source: input.source || null,
      metadata: input.metadata ? (input.metadata as any) : undefined,
      status: 'PENDING',
    },
  });

  // Log the scheduling event
  await prisma.scheduledMessageLog.create({
    data: {
      orgId: input.orgId,
      messageId: message.id,
      status: 'QUEUED',
    },
  });

  return message;
}

/** Schedule a batch of messages (e.g. for broadcast or sequence enrollment). */
export async function scheduleBatch(
  orgId: string,
  messages: Omit<ScheduleMessageInput, 'orgId'>[],
  batchOptions?: { scheduledAt?: Date; priority?: number; source?: string }
) {
  const batchId = `batch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const scheduledAt = batchOptions?.scheduledAt || new Date();

  const created = await prisma.$transaction(
    messages.map((m) =>
      prisma.scheduledMessage.create({
        data: {
          orgId,
          userId: m.userId || null,
          channel: m.channel,
          type: m.type || 'BROADCAST',
          recipientPhone: m.recipientPhone || null,
          recipientEmail: m.recipientEmail || null,
          recipientName: m.recipientName || null,
          leadId: m.leadId || null,
          contactId: m.contactId || null,
          conversationId: m.conversationId || null,
          subject: m.subject || null,
          body: m.body || null,
          templateName: m.templateName || null,
          templateParams: m.templateParams ? (m.templateParams as any) : undefined,
          templateLanguage: m.templateLanguage || null,
          scheduledAt,
          priority: batchOptions?.priority ?? 100,
          batchId,
          source: batchOptions?.source || m.source || null,
          metadata: m.metadata ? (m.metadata as any) : undefined,
          status: 'PENDING',
        },
      })
    )
  );

  // Create log entries for the batch
  await prisma.scheduledMessageLog.createMany({
    data: created.map((m) => ({
      orgId,
      messageId: m.id,
      status: 'QUEUED',
    })),
  });

  return { batchId, count: created.length, scheduledAt };
}

// ── Cancel / Retry ────────────────────────────────────────

export async function cancelMessage(messageId: string, orgId: string) {
  const msg = await prisma.scheduledMessage.findFirst({ where: { id: messageId, orgId } });
  if (!msg) throw notFound('Scheduled message not found');
  if (msg.status !== 'PENDING') {
    throw badRequest(`Cannot cancel a message with status "${msg.status}".`);
  }
  await prisma.scheduledMessage.update({
    where: { id: messageId },
    data: { status: 'CANCELLED' },
  });
  await prisma.scheduledMessageLog.create({
    data: { orgId, messageId, status: 'CANCELLED' },
  });
  return { cancelled: true };
}

export async function cancelBatch(batchId: string, orgId: string) {
  const result = await prisma.scheduledMessage.updateMany({
    where: { batchId, orgId, status: 'PENDING' },
    data: { status: 'CANCELLED' },
  });
  return { cancelled: result.count };
}

export async function retryMessage(messageId: string, orgId: string) {
  const msg = await prisma.scheduledMessage.findFirst({ where: { id: messageId, orgId } });
  if (!msg) throw notFound('Scheduled message not found');
  if (msg.status !== 'FAILED') {
    throw badRequest(`Can only retry failed messages. Current status: "${msg.status}".`);
  }
  await prisma.scheduledMessage.update({
    where: { id: messageId },
    data: {
      status: 'PENDING',
      retryCount: 0,
      lastError: null,
      nextRetryAt: null,
      failedAt: null,
      scheduledAt: new Date(),
    },
  });
  await prisma.scheduledMessageLog.create({
    data: { orgId, messageId, status: 'QUEUED' },
  });
  return { retried: true };
}

// ── Process ───────────────────────────────────────────────

/**
 * Pick up pending messages that are due and process them.
 * Called by the scheduler tick. Returns the number processed.
 */
export async function processDueMessages(batchSize = 20): Promise<number> {
  const now = new Date();

  // Find pending messages that are due (prioritize by priority ASC, then scheduledAt ASC)
  const dueMessages = await prisma.scheduledMessage.findMany({
    where: {
      status: 'PENDING',
      scheduledAt: { lte: now },
      OR: [
        { nextRetryAt: null },
        { nextRetryAt: { lte: now } },
      ],
    },
    orderBy: [{ priority: 'asc' }, { scheduledAt: 'asc' }],
    take: batchSize,
  });

  let processed = 0;
  for (const msg of dueMessages) {
    try {
      // Mark as processing
      await prisma.scheduledMessage.update({
        where: { id: msg.id },
        data: { status: 'PROCESSING', startedAt: new Date() },
      });

      await prisma.scheduledMessageLog.create({
        data: { orgId: msg.orgId, messageId: msg.id, status: 'PROCESSING' },
      });

      // Send based on channel
      const startTime = Date.now();
      let providerMessageId: string | null = null;
      let provider = msg.channel;

      if (msg.channel === 'WHATSAPP') {
        const result = await processWhatsAppMessage(msg);
        providerMessageId = result.waMessageId || null;
        provider = result.provider;
      } else if (msg.channel === 'EMAIL') {
        const result = await processEmailMessage(msg);
        providerMessageId = result.messageId || null;
        provider = result.provider;
      }

      const durationMs = Date.now() - startTime;

      // Mark as sent
      await prisma.scheduledMessage.update({
        where: { id: msg.id },
        data: {
          status: 'SENT',
          sentAt: new Date(),
          providerMessageId: providerMessageId || undefined,
        },
      });

      await prisma.scheduledMessageLog.create({
        data: {
          orgId: msg.orgId,
          messageId: msg.id,
          status: 'SENT',
          providerMessageId: providerMessageId || undefined,
          provider,
          durationMs,
        },
      });

      // Notify the user if this is a direct message from a specific user
      if (msg.userId) {
        await notify({
          orgId: msg.orgId,
          userId: msg.userId,
          type: 'SYSTEM',
          title: `Message sent via ${msg.channel}`,
          body: msg.channel === 'WHATSAPP'
            ? `WhatsApp sent to ${msg.recipientPhone || 'contact'}`
            : `Email sent to ${msg.recipientEmail || 'contact'}`,
        });
      }

      processed++;
    } catch (err: any) {
      const errorMsg = err instanceof Error ? err.message.slice(0, 300) : 'Send failed';
      const retryCount = msg.retryCount + 1;
      const shouldRetry = retryCount < msg.maxRetries;
      const newStatus = shouldRetry ? 'FAILED' : 'FAILED';

      // Calculate next retry with exponential back-off (1min, 5min, 15min, …)
      const backoffMs = Math.min(60000 * Math.pow(2, retryCount - 1), 3600000); // max 1 hour
      const nextRetryAt = shouldRetry ? new Date(Date.now() + backoffMs) : null;

      await prisma.scheduledMessage.update({
        where: { id: msg.id },
        data: {
          status: newStatus,
          retryCount,
          lastError: errorMsg,
          failedAt: shouldRetry ? null : new Date(),
          nextRetryAt,
        },
      });

      await prisma.scheduledMessageLog.create({
        data: {
          orgId: msg.orgId,
          messageId: msg.id,
          status: shouldRetry ? 'RETRYING' : 'FAILED',
          error: errorMsg,
          durationMs: Date.now() - (msg.startedAt?.getTime() || Date.now()),
        },
      });

      processed++;
    }
  }

  return processed;
}

// ── Channel Processors ────────────────────────────────────

async function processWhatsAppMessage(msg: {
  orgId: string;
  recipientPhone: string | null;
  body: string | null;
  templateName: string | null;
  templateParams: any;
  templateLanguage: string | null;
}): Promise<{ waMessageId: string; provider: string }> {
  const provider = await resolveWhatsAppProvider(msg.orgId);

  if (msg.templateName) {
    const result = await provider.sendTemplate({
      orgId: msg.orgId,
      to: msg.recipientPhone!,
      templateName: msg.templateName,
      language: msg.templateLanguage || 'en',
      params: Array.isArray(msg.templateParams) ? (msg.templateParams as string[]) : undefined,
    });
    return { waMessageId: result.waMessageId, provider: provider.name };
  }

  const result = await provider.sendText({
    orgId: msg.orgId,
    to: msg.recipientPhone!,
    body: msg.body || '',
  });
  return { waMessageId: result.waMessageId, provider: provider.name };
}

async function processEmailMessage(msg: {
  orgId: string;
  recipientEmail: string | null;
  subject: string | null;
  body: string | null;
}): Promise<{ messageId: string; provider: string }> {
  // Use nodemailer if configured, otherwise use the demo emailer
  const nodemailer = await import('nodemailer');

  // Read SMTP config from environment
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (smtpHost && smtpUser && smtpPass) {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass },
    });

    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || smtpUser,
      to: msg.recipientEmail!,
      subject: msg.subject || 'Message from PRIMELEAD AI',
      text: msg.body || '',
      html: msg.body ? msg.body.replace(/\n/g, '<br>') : '',
    });

    return { messageId: info.messageId, provider: 'smtp' };
  }

  // Demo mode — log to console and return a fake message ID
  const demoId = `demo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  console.log(`[DEMO EMAIL] To: ${msg.recipientEmail} | Subject: ${msg.subject} | Body: ${(msg.body || '').slice(0, 100)}`);
  return { messageId: demoId, provider: 'demo' };
}

// ── Query ─────────────────────────────────────────────────

export async function getMessage(id: string, orgId: string) {
  const msg = await prisma.scheduledMessage.findFirst({
    where: { id, orgId },
    include: { logs: { orderBy: { createdAt: 'asc' } } },
  });
  if (!msg) throw notFound('Scheduled message not found');
  return msg;
}

export async function listMessages(
  orgId: string,
  opts: { status?: string; channel?: string; batchId?: string; page?: number; limit?: number } = {}
) {
  const page = opts.page || 1;
  const limit = Math.min(opts.limit || 50, 200);
  const where: Record<string, unknown> = { orgId };
  if (opts.status) where.status = opts.status;
  if (opts.channel) where.channel = opts.channel;
  if (opts.batchId) where.batchId = opts.batchId;

  const [messages, total] = await Promise.all([
    prisma.scheduledMessage.findMany({
      where,
      orderBy: [{ priority: 'asc' }, { scheduledAt: 'asc' }],
      skip: (page - 1) * limit,
      take: limit,
      include: { _count: { select: { logs: true } } },
    }),
    prisma.scheduledMessage.count({ where }),
  ]);

  return { messages, total, page, limit, pages: Math.ceil(total / limit) };
}

export async function getQueueStats(orgId: string): Promise<QueueStats> {
  const [total, byStatus, byChannel, nextMsg] = await Promise.all([
    prisma.scheduledMessage.count({ where: { orgId } }),
    prisma.scheduledMessage.groupBy({
      by: ['status'],
      where: { orgId },
      _count: true,
    }),
    prisma.scheduledMessage.groupBy({
      by: ['channel'],
      where: { orgId },
      _count: true,
    }),
    prisma.scheduledMessage.findFirst({
      where: { orgId, status: 'PENDING' },
      orderBy: [{ priority: 'asc' }, { scheduledAt: 'asc' }],
      select: { scheduledAt: true },
    }),
  ]);

  const statusMap = Object.fromEntries(byStatus.map((s) => [s.status, s._count]));
  const channelMap = Object.fromEntries(byChannel.map((c) => [c.channel, c._count]));

  return {
    total,
    pending: statusMap['PENDING'] || 0,
    processing: statusMap['PROCESSING'] || 0,
    sent: statusMap['SENT'] || 0,
    failed: statusMap['FAILED'] || 0,
    cancelled: statusMap['CANCELLED'] || 0,
    byChannel: channelMap,
    byStatus: statusMap as Record<string, number>,
    nextScheduledAt: nextMsg?.scheduledAt || null,
  };
}

export async function getMessageLogs(messageId: string, orgId: string) {
  const msg = await prisma.scheduledMessage.findFirst({ where: { id: messageId, orgId } });
  if (!msg) throw notFound('Scheduled message not found');
  return prisma.scheduledMessageLog.findMany({
    where: { messageId },
    orderBy: { createdAt: 'asc' },
  });
}
