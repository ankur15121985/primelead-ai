/**
 * WhatsApp provider abstraction.
 *
 * Business logic never talks to the WhatsApp Business Platform directly — it
 * talks to a `WhatsAppProvider`. Two adapters:
 *
 *   - demo — fully functional locally: outbound sends are recorded immediately
 *     and the demo inbound simulator drives the exact same message service the
 *     real webhook would (no fabricated Meta behavior).
 *   - meta — the official WhatsApp Business Platform (Graph API). Webhook
 *     parsing + signature verification are implemented; outbound calls are
 *     IMPLEMENTATION REQUIRED until exercised against a real phone number.
 *
 * Provider config lives per-org in org settings under the `whatsapp` key
 * ({ enabled, provider, token, phoneNumberId, verifyToken, webhookSecret }).
 * No provider keys ever leave the server.
 */
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { demoProvider } from './demo';
import { metaProvider } from './meta';

export type WaEventKind = 'MESSAGE' | 'STATUS';

export interface WaInboundEvent {
  kind: WaEventKind;
  /** Deterministic id for this event (idempotency key). */
  eventId: string;
  /** Customer's WhatsApp number (digits, E.164). */
  from: string;
  /** Business number this was sent to. */
  to: string;
  /** Provider message id — unique per Message row. */
  waMessageId: string;
  timestamp: number;
  // Message payload
  type?: 'TEXT' | 'MEDIA' | 'TEMPLATE';
  body?: string;
  mediaUrl?: string;
  mediaType?: string;
  templateName?: string;
  // Status update
  status?: 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
}

export interface SendResult {
  waMessageId: string;
}

export interface WhatsAppProvider {
  name: string;
  /** True when real credentials are configured (demo is never "configured"). */
  configured: boolean;
  sendText(opts: { orgId: string; to: string; body: string }): Promise<SendResult>;
  sendTemplate(opts: {
    orgId: string;
    to: string;
    templateName: string;
    language?: string;
    params?: string[];
  }): Promise<SendResult>;
  /** Parse + verify an inbound webhook. Returns raw events for the service layer. */
  parseWebhook(headers: Record<string, string | string[] | undefined>, rawBody: Buffer): { valid: boolean; events?: WaInboundEvent[]; error?: string };
  /** GET webhook verification (Meta hub.challenge handshake). */
  verifyWebhook(opts: { mode: string; verifyToken: string; challenge: string }): { valid: boolean; challenge?: string };
}

/** The org's WhatsApp provider, resolved from org settings. Never returns null. */
export async function resolveWhatsAppProvider(orgId: string): Promise<WhatsAppProvider> {
  const settings = await prisma.orgSetting.findUnique({ where: { orgId_key: { orgId, key: 'whatsapp' } } });
  const cfg = (settings?.value as any) || {};
  if (cfg.provider === 'meta' && cfg.token && cfg.phoneNumberId) return metaProvider;
  return demoProvider;
}

/** The org's WhatsApp config (used by routes; secrets are write-only). */
export async function getWhatsAppConfig(orgId: string): Promise<{
  enabled: boolean;
  provider: string;
  phoneNumberId: string | null;
  hasToken: boolean;
  verifyToken: string | null;
}> {
  const settings = await prisma.orgSetting.findUnique({ where: { orgId_key: { orgId, key: 'whatsapp' } } });
  const cfg = (settings?.value as any) || {};
  return {
    enabled: Boolean(cfg.enabled),
    provider: cfg.provider || 'demo',
    phoneNumberId: cfg.phoneNumberId || null,
    hasToken: Boolean(cfg.token),
    verifyToken: cfg.verifyToken || null,
  };
}

/**
 * Resolve the org a Meta webhook belongs to by matching the business phone
 * number id across org settings (the webhook is unauthenticated).
 */
export async function resolveOrgByPhoneNumberId(phoneNumberId: string): Promise<string | null> {
  const settings = await prisma.orgSetting.findMany({ where: { key: 'whatsapp' } });
  for (const s of settings) {
    const cfg = (s.value as any) || {};
    if (cfg.phoneNumberId === phoneNumberId) return s.orgId;
  }
  return null;
}

/** Normalize a customer number to digits-only E.164 (91 prefix for 10-digit IN). */
export function normalizeWaId(raw: string): string {
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('0')) digits = digits.slice(1);
  if (digits.length === 10) digits = `91${digits}`;
  return digits;
}

export function hmacSha256Hex(secret: string, data: string | Buffer): string {
  return crypto.createHmac('sha256', secret).update(data).digest('hex');
}

export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

/** Case-insensitive header lookup across the various Express header shapes. */
export function getHeader(headers: Record<string, string | string[] | undefined>, name: string): string | undefined {
  const key = Object.keys(headers).find((k) => k.toLowerCase() === name.toLowerCase());
  if (!key) return undefined;
  const v = headers[key];
  if (Array.isArray(v)) return v[0];
  return v;
}
