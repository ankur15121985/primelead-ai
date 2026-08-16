/**
 * Generic social-messaging adapter.
 *
 * Serves platforms that don't (yet) have a dedicated payload format —
 * LinkedIn, Telegram, Hike, Snapchat, and any future chat app. Each one
 * points its bot/DM webhook at the same documented JSON contract:
 *
 *   {
 *     "name": "Rahul Sharma",          // sender display name
 *     "handle": "@rahul",              // platform handle (optional)
 *     "phone": "9812345678",           // at least one of phone/email/message
 *     "email": "rahul@example.com",
 *     "company": "Acme Traders",       // optional
 *     "message": "Need a quote today", // the DM text (optional)
 *     "externalId": "msg-20240101-1"   // provider message id → replay guard
 *   }
 *
 * The adapter never pretends to know a platform's private API — the
 * platform side (a bot, form or automation) POSTs this JSON to the org's
 * webhook URL with `x-webhook-secret`, and the lead lands in the CRM with
 * source attribution and deduplication.
 */
import type { LeadSourceAdapter, NormalizedLead } from '../leadsource';

const str = (v: unknown): string | undefined => {
  const s = typeof v === 'string' ? v.trim() : v === null || v === undefined ? '' : String(v).trim();
  return s === '' ? undefined : s;
};

export const genericSocialAdapter: LeadSourceAdapter = {
  source: 'GENERIC_SOCIAL',
  // Social DMs are message-first; a name + message is a valid lead.
  allowsMessageOnly: true,

  validate(raw: unknown): string | null {
    if (!raw || typeof raw !== 'object') return 'Payload must be a JSON object.';
    const o = raw as Record<string, unknown>;
    if (!str(o.name) && !str(o.handle)) return 'Payload needs a sender name or handle.';
    if (!str(o.phone) && !str(o.email) && !str(o.message)) return 'Payload needs a phone, email or message.';
    return null;
  },

  normalize(raw: unknown): NormalizedLead {
    const o = raw as Record<string, unknown>;
    const name = str(o.name) || str(o.handle) || 'Social Lead';
    const handle = str(o.handle);
    const message = str(o.message);

    return {
      name,
      phone: str(o.phone),
      email: str(o.email),
      company: str(o.company),
      notes: [message ? `Message: ${message}` : null, handle ? `Handle: ${handle}` : null]
        .filter(Boolean)
        .join('\n') || null,
      customFields: handle ? { socialHandle: handle } : undefined,
      externalId: str(o.externalId) || null,
    };
  },
};
