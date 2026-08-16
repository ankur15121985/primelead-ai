/**
 * Twitter / X DM adapter.
 *
 * Normalises the X Account Activity API `direct_message_events` payload
 * (v2 DM events / webhook):
 *
 *   {
 *     "direct_message_events": [{
 *       "type": "message_create",
 *       "id": "1234567890123456789",
 *       "message_create": {
 *         "sender_id": "987654",
 *         "message_data": { "text": "Hi, I need a website" }
 *       }
 *     }],
 *     "users": {
 *       "987654": { "id": "987654", "name": "Rahul Sharma", "screen_name": "rahul_sh" }
 *     }
 *   }
 *
 * The DM event `id` is the replay key. The sender's profile name becomes the
 * lead name and the handle is kept in customFields. Phone/email are NOT
 * scraped from message text — the salesperson closes the loop, or the lead is
 * enriched in the CRM. This adapter is honest about what it does: it turns a
 * DM into a tracked lead with the message preserved.
 */
import type { LeadSourceAdapter, NormalizedLead } from '../leadsource';

interface DmEvent {
  type?: string;
  id?: string;
  message_create?: {
    sender_id?: string;
    message_data?: { text?: string };
  };
}

export const twitterAdapter: LeadSourceAdapter = {
  source: 'TWITTER',
  // DMs carry a message, rarely a phone/email — the message alone is the lead.
  allowsMessageOnly: true,

  validate(raw: unknown): string | null {
    if (!raw || typeof raw !== 'object') return 'Payload must be a JSON object.';
    const obj = raw as Record<string, unknown>;
    const events = Array.isArray(obj.direct_message_events) ? obj.direct_message_events : [];
    if (events.length === 0) return 'Payload has no direct_message_events.';
    const ev = events[0] as DmEvent;
    if (!ev?.id) return 'DM event is missing an id.';
    if (!ev?.message_create?.sender_id) return 'DM event is missing the sender.';
    return null;
  },

  normalize(raw: unknown): NormalizedLead {
    const obj = raw as Record<string, unknown>;
    const ev = (Array.isArray(obj.direct_message_events) ? obj.direct_message_events[0] : {}) as DmEvent;
    const senderId = ev.message_create?.sender_id || '';
    const users = (obj.users || {}) as Record<string, { name?: string; screen_name?: string }>;
    const profile = users[senderId] || {};
    const text = ev.message_create?.message_data?.text?.trim() || '';
    const name = profile.name?.trim() || (profile.screen_name ? `@${profile.screen_name}` : 'Twitter Lead');

    return {
      name,
      notes: text ? `DM: ${text.slice(0, 2000)}` : null,
      customFields: {
        ...(profile.screen_name ? { twitterHandle: profile.screen_name } : {}),
        ...(senderId ? { twitterUserId: senderId } : {}),
      },
      externalId: ev.id || null,
    };
  },
};
