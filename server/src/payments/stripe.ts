/**
 * Stripe adapter.
 *
 * - createCheckout: Checkout Sessions API (POST /v1/checkout/sessions) →
 *   returns a hosted `url`. Requires STRIPE_SECRET_KEY.
 * - Webhooks: the `stripe-signature` header is `t=<ts>,v1=<sig>`; v1 is
 *   HMAC-SHA256 of `${ts}.${rawBody}` with the webhook secret, and the ts must
 *   be within tolerance. Implemented per Stripe's documented scheme (no SDK —
 *   the algorithm is plain HMAC).
 *
 * Live calls are IMPLEMENTATION REQUIRED — they only run when keys exist.
 */
import { config } from '../config';
import {
  hmacSha256Hex,
  safeEqual,
  getHeader,
  providerPost,
  type PaymentProvider,
  type CreateCheckoutInput,
  type CheckoutResult,
  type VerifyResult,
  type VerifiedEvent,
  type ProviderEventKind,
  type RefundInput,
  type RefundResult,
} from './provider';

const API = 'https://api.stripe.com/v1';
const TOLERANCE_MS = 5 * 60 * 1000;

const KIND_BY_TYPE: Record<string, ProviderEventKind> = {
  'checkout.session.completed': 'PAYMENT_CAPTURED',
  'invoice.paid': 'PAYMENT_CAPTURED',
  'invoice.payment_failed': 'PAYMENT_FAILED',
  'charge.refunded': 'REFUND_PROCESSED',
  'customer.subscription.deleted': 'SUBSCRIPTION_CANCELLED',
};

function formEncode(obj: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) {
      v.forEach((item, i) => {
        for (const [ik, iv] of Object.entries(item as Record<string, unknown>)) {
          parts.push(`${encodeURIComponent(`${k}[${i}][${ik}]`)}=${encodeURIComponent(String(iv))}`);
        }
      });
    } else {
      parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
    }
  }
  return parts.join('&');
}

export const stripeProvider: PaymentProvider = {
  name: 'stripe',
  configured: Boolean(config.payments.stripeSecretKey),

  async createCheckout(input: CreateCheckoutInput): Promise<CheckoutResult> {
    if (!stripeProvider.configured) {
      throw new Error('Stripe is not configured (STRIPE_SECRET_KEY missing).');
    }
    const res = await providerPost(`${API}/checkout/sessions`, {
      auth: { bearer: config.payments.stripeSecretKey },
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formEncode({
        mode: 'payment',
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        client_reference_id: input.paymentId,
        customer_email: input.customerEmail,
        metadata: {
          paymentId: input.paymentId,
          orgId: input.orgId,
          planSlug: input.planSlug,
          period: input.period,
        },
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: 'inr',
              unit_amount: input.amountPaise,
              product_data: { name: `PRIMELEAD AI — ${input.planName} (${input.period.toLowerCase()})` },
            },
          },
        ],
      }),
    });
    if (!res.ok) throw new Error(`Stripe checkout creation failed (${res.status}).`);
    return { provider: 'stripe', mode: 'provider', checkoutUrl: res.json.url || null, orderId: res.json.id };
  },

  async refund(input: RefundInput): Promise<RefundResult> {
    // IMPLEMENTATION REQUIRED — Stripe Refunds API (POST /v1/refunds) is
    // documented but has not been exercised against real keys.
    throw new Error('Stripe refunds are not implemented yet (IMPLEMENTATION REQUIRED).');
  },

  verifyAndParse(headers: Record<string, string | string[] | undefined>, rawBody: Buffer): VerifyResult {
    const header = getHeader(headers, 'stripe-signature');
    const secret = config.payments.stripeWebhookSecret;
    if (!header || !secret) return { valid: false, error: 'missing signature or webhook secret' };
    let ts = '';
    let sig = '';
    for (const part of header.split(',')) {
      const [k, ...rest] = part.trim().split('=');
      if (k === 't') ts = rest.join('=');
      if (k === 'v1') sig = rest.join('=');
    }
    if (!ts || !sig) return { valid: false, error: 'malformed signature header' };
    const age = Math.abs(Date.now() / 1000 - Number(ts));
    if (Number.isNaN(age) || age > TOLERANCE_MS / 1000) return { valid: false, error: 'signature timestamp outside tolerance' };
    if (!safeEqual(hmacSha256Hex(secret, `${ts}.${rawBody.toString('utf8')}`), sig)) {
      return { valid: false, error: 'invalid signature' };
    }
    let payload: any;
    try {
      payload = JSON.parse(rawBody.toString('utf8'));
    } catch {
      return { valid: false, error: 'invalid json body' };
    }
    const type: string = payload?.type || '';
    const kind = KIND_BY_TYPE[type];
    if (!kind) return { valid: false, error: `unsupported event type: ${type}` };
    const obj = payload?.data?.object || {};
    const event: VerifiedEvent = {
      eventId: `stripe:${payload?.id || 'unknown'}`,
      type,
      kind,
      payload,
      // Checkout sessions echo our internal payment id back.
      paymentId: obj?.client_reference_id || obj?.metadata?.paymentId || undefined,
      orderId: obj?.id,
      providerPaymentId: obj?.payment_intent || obj?.id,
      amountPaise: typeof obj?.amount_total === 'number' ? obj.amount_total : typeof obj?.amount_paid === 'number' ? obj.amount_paid : typeof obj?.amount_refunded === 'number' ? obj.amount_refunded : undefined,
      subscriptionRef: obj?.subscription || undefined,
    };
    return { valid: true, event };
  },
};
