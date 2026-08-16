/**
 * Meta WhatsApp Business Platform webhook (raw body, unauthenticated).
 *
 *   GET  /api/webhooks/whatsapp — hub.challenge verification handshake
 *   POST /api/webhooks/whatsapp — signed inbound events (messages + statuses)
 *
 * Both resolve the owning org from the org's WhatsApp settings (phoneNumberId /
 * verifyToken), which are configured on the Inbox → Settings panel. Signature
 * verification uses X-Hub-Signature-256; the webhook secret is per-org config.
 */
import { Router, type NextFunction, type Request, type Response } from 'express';
import { prisma } from '../lib/prisma';
import { asyncHandler, ok } from '../lib/http';
import { getHeader } from '../whatsapp/provider';
import { metaProvider } from '../whatsapp/meta';
import { handleInboundMessage, handleStatusUpdate } from '../services/whatsapp';
import { resolveOrgByPhoneNumberId, safeEqual } from '../whatsapp/provider';

const router = Router();

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const mode = String(req.query['hub.mode'] || '');
    const verifyToken = String(req.query['hub.verify_token'] || '');
    const challenge = String(req.query['hub.challenge'] || '');

    if (mode !== 'subscribe' || !challenge) {
      return res.status(400).json({ error: 'invalid hub request' });
    }

    // Find the org whose configured verifyToken matches (constant-time compare).
    const settings = await prisma.orgSetting.findMany({ where: { key: 'whatsapp' } });
    for (const s of settings) {
      const cfg = (s.value as any) || {};
      if (cfg.verifyToken && cfg.verifyToken.length === verifyToken.length && safeEqual(cfg.verifyToken, verifyToken)) {
        return res.send(challenge);
      }
    }
    return res.status(403).json({ error: 'verify token mismatch' });
  })
);

router.post(
  '/',
  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    // This path is shared with the generic lead-capture webhook
    // (POST /api/webhooks/:source with x-webhook-secret). A Meta webhook
    // always carries X-Hub-Signature-256 — anything else falls through to the
    // generic router instead of being rejected here.
    if (!getHeader(req.headers as Record<string, string | string[] | undefined>, 'x-hub-signature-256')) {
      // express.raw() consumed the stream — restore the parsed body so the
      // generic lead-capture webhook (mounted after express.json()) works.
      if (Buffer.isBuffer(req.body)) {
        try {
          req.body = JSON.parse(req.body.toString('utf8'));
        } catch {
          // leave the raw buffer; the generic router will reject it
        }
      }
      return next();
    }
    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || '', 'utf8');
    const parsed = metaProvider.parseWebhook(req.headers as Record<string, string | string[] | undefined>, rawBody);
    if (!parsed.valid || !parsed.events) {
      return res.status(400).json({ error: parsed.error || 'invalid webhook' });
    }

    // Acknowledge promptly — process events without blocking the provider.
    // (Synchronous here for simplicity; this stays fast because every event is
    // a single deduplicated upsert.)
    const results: Array<{ eventId: string; duplicate: boolean }> = [];
    for (const event of parsed.events) {
      // The provider sends a single entry per phone number; resolve the tenant
      // from the payload. If the phone number isn't configured, ignore silently.
      const orgId = await resolveOrgByPhoneNumberId(event.to);
      if (!orgId) continue;

      if (event.kind === 'MESSAGE') {
        const r = await handleInboundMessage({
          orgId,
          from: event.from,
          waMessageId: event.waMessageId,
          body: event.body || null,
          mediaUrl: event.mediaUrl || null,
          mediaType: event.mediaType || null,
          type: event.type,
          templateName: event.templateName || null,
          timestamp: event.timestamp,
        });
        results.push({ eventId: event.eventId, duplicate: r.duplicate });
      } else if (event.kind === 'STATUS' && event.status) {
        await handleStatusUpdate({
          orgId,
          waMessageId: event.waMessageId,
          status: event.status,
          timestamp: event.timestamp,
        });
      }
    }

    // Always 200 so the provider stops retrying; duplicates are reported.
    return ok(res, { received: true, processed: results.length });
  })
);

export default router;
