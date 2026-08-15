/**
 * Inbound payment-provider webhooks (Razorpay / Stripe / Cashfree / demo).
 *
 * Mounted with express.raw() BEFORE express.json() so the raw body is
 * available for HMAC signature verification. Never trusts a frontend
 * confirmation — only a verified provider event can mark a payment paid.
 *
 * Idempotent: every event is recorded in WebhookEvent with a unique
 * (provider, eventId); replays are acknowledged and skipped.
 */
import { Router } from 'express';
import { asyncHandler } from '../lib/http';
import { handlePaymentWebhook } from '../services/billing';

const router = Router();

router.post(
  '/:provider',
  asyncHandler(async (req, res) => {
    const provider = String(req.params.provider).toLowerCase();
    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || '', 'utf8');

    const result = await handlePaymentWebhook(provider, req.headers as Record<string, string | string[] | undefined>, rawBody);

    if (!result.ok) {
      return res.status(401).json({ error: { code: 'INVALID_SIGNATURE', message: 'Webhook verification failed.', requestId: (req as any).requestId } });
    }
    // Duplicate events are acknowledged (200) — never reprocessed.
    return res.json({ data: { received: true, duplicate: result.duplicate } });
  })
);

export default router;
