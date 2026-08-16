/**
 * Meta WhatsApp Business Platform adapter (official Graph API).
 *
 * Webhook layer (GET verification + POST event parsing with
 * X-Hub-Signature-256 verification) is implemented and testable. Outbound
 * sends go through the documented Graph API but are IMPLEMENTATION REQUIRED
 * until exercised against a real WhatsApp Business phone number — sending
 * code is marked clearly and fails loudly instead of pretending.
 */
import { config } from '../config';
import { getHeader, hmacSha256Hex, safeEqual, type SendResult, type WaInboundEvent, type WhatsAppProvider } from './provider';

const GRAPH = 'https://graph.facebook.com/v21.0';

function verifySig(headers: Record<string, string | string[] | undefined>, rawBody: Buffer): boolean {
  const sig = getHeader(headers, 'x-hub-signature-256');
  if (!sig) return false;
  const expected = `sha256=${hmacSha256Hex(config.payments.webhookSecret, rawBody)}`;
  return safeEqual(expected, sig);
}

export const metaProvider: WhatsAppProvider = {
  name: 'meta',
  configured: Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID),

  async sendText(): Promise<SendResult> {
    // IMPLEMENTATION REQUIRED — POST /{phone_number_id}/messages with
    // { messaging_product: 'whatsapp', recipient_type: 'individual', type: 'text', text: { body } }
    throw new Error('Meta outbound messages are not implemented yet (IMPLEMENTATION REQUIRED).');
  },

  async sendTemplate(): Promise<SendResult> {
    // IMPLEMENTATION REQUIRED — POST /{phone_number_id}/messages with
    // { messaging_product: 'whatsapp', type: 'template', template: { name, language: { code }, components: [...] } }
    throw new Error('Meta template sends are not implemented yet (IMPLEMENTATION REQUIRED).');
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
