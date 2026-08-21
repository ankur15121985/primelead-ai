/**
 * Meta WhatsApp Business Platform adapter (official Graph API).
 *
 * Webhook layer (GET verification + POST event parsing with
 * X-Hub-Signature-256 verification) is implemented and testable.
 * Outbound sends use the Graph API:
 *   POST /{phone_number_id}/messages
 *   Authorization: Bearer <access_token>
 * They require WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID env vars
 * (or per-org settings). When unconfigured, errors clearly name the missing
 * credentials so nothing is faked.
 */
import { config } from '../config';
import { prisma } from '../lib/prisma';
import { getHeader, hmacSha256Hex, safeEqual, type SendResult, type WaInboundEvent, type WhatsAppProvider } from './provider';

const GRAPH = 'https://graph.facebook.com/v21.0';

function verifySig(headers: Record<string, string | string[] | undefined>, rawBody: Buffer): boolean {
  const sig = getHeader(headers, 'x-hub-signature-256');
  if (!sig) return false;
  const expected = `sha256=${hmacSha256Hex(config.payments.webhookSecret, rawBody)}`;
  return safeEqual(expected, sig);
}

/**
 * Resolve the org's Meta WhatsApp credentials from org settings.
 * Falls back to global env vars.
 */
async function getMetaCredentials(orgId: string): Promise<{ accessToken: string; phoneNumberId: string } | null> {
  // Per-org settings take priority
  const settings = await prisma.orgSetting.findUnique({ where: { orgId_key: { orgId, key: 'whatsapp' } } });
  const cfg = (settings?.value as any) || {};
  const accessToken = cfg.token || process.env.WHATSAPP_ACCESS_TOKEN || '';
  const phoneNumberId = cfg.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID || '';
  if (!accessToken || !phoneNumberId) return null;
  return { accessToken, phoneNumberId };
}

/**
 * POST a message payload to the WhatsApp Graph API.
 * Returns the first message ID from the response.
 */
async function graphSend(phoneNumberId: string, accessToken: string, body: Record<string, unknown>): Promise<SendResult> {
  const url = `${GRAPH}/${phoneNumberId}/messages`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const json: any = await res.json();

  if (!res.ok) {
    const errCode = json?.error?.code || res.status;
    const errMsg = json?.error?.message || `HTTP ${res.status}`;
    throw new Error(`WhatsApp API error ${errCode}: ${errMsg}`);
  }

  const msgId: string = json?.messages?.[0]?.id;
  if (!msgId) throw new Error('WhatsApp API returned no message ID');
  return { waMessageId: msgId };
}

export const metaProvider: WhatsAppProvider = {
  name: 'meta',
  configured: Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID),

  /**
   * Send a plain text message via the WhatsApp Graph API.
   * Requires WHATSAPP_ACCESS_TOKEN + WHATSAPP_PHONE_NUMBER_ID (env or org settings).
   */
  async sendText(opts: { orgId: string; to: string; body: string }): Promise<SendResult> {
    const creds = await getMetaCredentials(opts.orgId);
    if (!creds) {
      throw new Error(
        'Meta WhatsApp is not configured. Set WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID in server/.env ' +
        'or in Inbox → Provider Settings for your organization.'
      );
    }

    return graphSend(creds.phoneNumberId, creds.accessToken, {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: opts.to,
      type: 'text',
      text: {
        preview_url: false,
        body: opts.body,
      },
    });
  },

  /**
   * Send a pre-approved template message with optional parameter substitution.
   * Requires WHATSAPP_ACCESS_TOKEN + WHATSAPP_PHONE_NUMBER_ID (env or org settings).
   */
  async sendTemplate(opts: {
    orgId: string;
    to: string;
    templateName: string;
    language?: string;
    params?: string[];
  }): Promise<SendResult> {
    const creds = await getMetaCredentials(opts.orgId);
    if (!creds) {
      throw new Error(
        'Meta WhatsApp is not configured. Set WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID in server/.env ' +
        'or in Inbox → Provider Settings for your organization.'
      );
    }

    const langCode = opts.language || 'en';

    // Build components: if params are provided, add a body component with substitutions
    const components: any[] = [];
    if (opts.params && opts.params.length > 0) {
      components.push({
        type: 'body',
        parameters: opts.params.map((p) => ({ type: 'text', text: p })),
      });
    }

    const payload: Record<string, unknown> = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: opts.to,
      type: 'template',
      template: {
        name: opts.templateName,
        language: { code: langCode },
      },
    };

    if (components.length > 0) {
      (payload.template as any).components = components;
    }

    return graphSend(creds.phoneNumberId, creds.accessToken, payload);
  },

  parseWebhook(
    headers: Record<string, string | string[] | undefined>,
    rawBody: Buffer
  ): { valid: boolean; events?: WaInboundEvent[]; error?: string } {
    if (!verifySig(headers, rawBody)) return { valid: false, error: 'invalid X-Hub-Signature-256' };

    let payload: any;
    try {
      payload = JSON.parse(rawBody.toString('utf8'));
    } catch {
      return { valid: false, error: 'invalid json body' };
    }

    const events: WaInboundEvent[] = [];
    const entry = payload?.entry?.[0];
    const changes = entry?.changes || [];
    for (const change of changes) {
      if (change?.field !== 'messages') continue;
      const value = change.value || {};
      const phoneNumberId: string = value.metadata?.phone_number_id || '';
      const messages = value.messages || [];
      const statuses = value.statuses || [];

      for (const m of messages) {
        const from: string = m.from || '';
        const waMessageId: string = m.id || '';
        const type: string = m.type || 'text';
        const textBody = m.text?.body || '';
        const media =
          m.image || m.video || m.document || m.audio || m.sticker || null;
        const templateName = m.template?.name;
        events.push({
          kind: 'MESSAGE',
          eventId: `meta:message:${waMessageId}`,
          from,
          to: phoneNumberId,
          waMessageId,
          timestamp: Number(m.timestamp) || Date.now(),
          type: type === 'text' ? 'TEXT' : media ? 'MEDIA' : type === 'template' ? 'TEMPLATE' : 'TEXT',
          body: textBody || media?.caption || undefined,
          mediaUrl: media?.link || media?.url || undefined,
          mediaType: media ? (media?.mime_type || type) : undefined,
          templateName,
        });
      }

      for (const s of statuses) {
        const status = String(s.status || '').toUpperCase();
        if (!['SENT', 'DELIVERED', 'READ', 'FAILED'].includes(status)) continue;
        events.push({
          kind: 'STATUS',
          eventId: `meta:status:${s.id}:${status}`,
          from: value.metadata?.display_phone_number || '',
          to: phoneNumberId,
          waMessageId: s.id || '',
          timestamp: Number(s.timestamp) || Date.now(),
          status: status as WaInboundEvent['status'],
        });
      }
    }

    if (events.length === 0) return { valid: false, error: 'no supported events in payload' };
    return { valid: true, events };
  },

  verifyWebhook(opts: { mode: string; verifyToken: string; challenge: string }): { valid: boolean; challenge?: string } {
    // The verify token is per-org; the route passes the org's configured one.
    if (opts.mode === 'subscribe' && opts.verifyToken && opts.challenge) {
      return { valid: true, challenge: opts.challenge };
    }
    return { valid: false };
  },
};
