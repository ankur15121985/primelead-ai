/**
 * Razorpay adapter.
 *
 * - createCheckout: Razorpay Payment Links API (POST /v1/payment_links) →
 *   returns a hosted `short_url`. Requires RAZORPAY_KEY_ID/SECRET.
 * - Webhooks: signature is HMAC-SHA256(raw body, key secret) compared against
 *   the `x-razorpay-signature` header (timing-safe).
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
} from './provider';

const KIND_BY_TYPE: Record<string, ProviderEventKind> = {
  'payment_link.paid': 'PAYMENT_CAPTURED',
  'payment.captured': 'PAYMENT_CAPTURED',
  'payment.paid': 'PAYMENT_CAPTURED',
  'payment.failed': 'PAYMENT_FAILED',
  'refund.processed': 'REFUND_PROCESSED',
  'refund.processed.v2': 'REFUND_PROCESSED',
  'subscription.cancelled': 'SUBSCRIPTION_CANCELLED',
};

const API = 'https://api.razorpay.com/v1';

/** Amount + provider ids from a payment / payment_link / refund entity. */
function idsFrom(payload: any): Pick<VerifiedEvent, 'paymentId' | 'orderId' | 'providerPaymentId' | 'amountPaise' | 'subscriptionRef'> {
  const entity = payload?.payment?.entity || payload?.entity || {};
  const link = payload?.payment_link?.entity || {};
  const refund = payload?.refund?.entity || {};
  return {
    // Razorpay echoes our notes/metadata back on the payment entity.
    paymentId: (entity?.notes?.paymentId as string) || payload?.notes?.paymentId || undefined,
    orderId: entity?.order_id || link?.id || undefined,
    // Refund events reference the original payment id.
    providerPaymentId: refund?.payment_id || entity?.id || undefined,
    // Razorpay reports amounts in paise.
    amountPaise: typeof refund?.amount === 'number' ? refund.amount : typeof entity?.amount === 'number' ? entity.amount : undefined,
    subscriptionRef: entity?.subscription_id || undefined,
  };
}

export const razorpayProvider: PaymentProvider = {
  name: 'razorpay',
  configured: Boolean(config.payments.razorpayKeyId && config.payments.razorpayKeySecret),

  async createCheckout(input: CreateCheckoutInput): Promise<CheckoutResult> {
    if (!razorpayProvider.configured) {
      throw new Error('Razorpay is not configured (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET missing).');
    }
    const res = await providerPost(`${API}/payment_links`, {
      auth: { username: config.payments.razorpayKeyId, password: config.payments.razorpayKeySecret },
      body: {
        amount: input.amountPaise,
        currency: 'INR',
        accept_partial: false,
        description: `PRIMELEAD AI — ${input.planName} (${input.period.toLowerCase()})`,
        customer: { name: input.orgName, email: input.customerEmail },
        notes: { paymentId: input.paymentId, orgId: input.orgId, planSlug: input.planSlug, period: input.period },
        callback_url: input.successUrl,
        callback_method: 'get',
      },
    });
    if (!res.ok) throw new Error(`Razorpay payment link creation failed (${res.status}).`);
    return { provider: 'razorpay', mode: 'provider', checkoutUrl: res.json.short_url || null, orderId: res.json.id };
  },

  verifyAndParse(headers: Record<string, string | string[] | undefined>, rawBody: Buffer): VerifyResult {
    const sig = getHeader(headers, 'x-razorpay-signature');
    if (!sig || !safeEqual(hmacSha256Hex(config.payments.razorpayKeySecret, rawBody), sig)) {
      return { valid: false, error: 'invalid signature' };
    }
    let payload: any;
    try {
      payload = JSON.parse(rawBody.toString('utf8'));
    } catch {
      return { valid: false, error: 'invalid json body' };
    }
    const type: string = payload?.event || '';
    const kind = KIND_BY_TYPE[type];
    if (!kind) return { valid: false, error: `unsupported event type: ${type}` };
    const ids = idsFrom(payload);
    // A unique idempotency key per provider event: event type + entity id.
    const entityId = ids.providerPaymentId || ids.orderId || payload?.payment_link?.entity?.id || payload?.id || 'unknown';
    return {
      valid: true,
      event: { eventId: `rzp:${type}:${entityId}`, type, kind, payload, ...ids },
    };
  },
};
