/**
 * Cashfree adapter (India-first provider).
 *
 * - createCheckout: Orders API v2 (POST /pg/orders, api-version 2023-08-01).
 *   Cashfree's hosted checkout needs their JS SDK with the returned
 *   payment_session_id, so there is no standalone hosted URL — the client SDK
 *   integration is IMPLEMENTATION REQUIRED.
 * - Webhooks: `x-webhook-signature` = HMAC-SHA256(raw body, webhook secret).
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

const KIND_BY_TYPE: Record<string, ProviderEventKind> = {
  PAYMENT_SUCCESS_WEBHOOK: 'PAYMENT_CAPTURED',
  PAYMENT_FAILED_WEBHOOK: 'PAYMENT_FAILED',
  REFUND_STATUS_WEBHOOK: 'REFUND_PROCESSED',
  SUBSCRIPTION_CANCELLATION_WEBHOOK: 'SUBSCRIPTION_CANCELLED',
};

export const cashfreeProvider: PaymentProvider = {
  name: 'cashfree',
  configured: Boolean(config.payments.cashfreeAppId && config.payments.cashfreeSecretKey),

  async createCheckout(input: CreateCheckoutInput): Promise<CheckoutResult> {
    if (!cashfreeProvider.configured) {
      throw new Error('Cashfree is not configured (CASHFREE_APP_ID / CASHFREE_SECRET_KEY missing).');
    }
    const base = config.payments.cashfreeEnv === 'production' ? 'https://api.cashfree.com' : 'https://sandbox.cashfree.com';
    const res = await providerPost(`${base}/pg/orders`, {
      auth: { username: config.payments.cashfreeAppId, password: config.payments.cashfreeSecretKey },
      headers: { 'x-api-version': '2023-08-01' },
      body: {
        order_id: `pl_${input.paymentId}`,
        order_amount: input.amountPaise / 100,
        order_currency: 'INR',
        order_note: `PRIMELEAD AI — ${input.planName} (${input.period.toLowerCase()})`,
        order_tags: { paymentId: input.paymentId, orgId: input.orgId, planSlug: input.planSlug, period: input.period },
        customer_details: {
          customer_id: input.orgId,
          customer_email: input.customerEmail,
          customer_name: input.orgName,
        },
        order_meta: { return_url: input.successUrl },
      },
    });
    if (!res.ok) throw new Error(`Cashfree order creation failed (${res.status}).`);
    // Hosted checkout requires the Cashfree JS SDK with payment_session_id
    // (IMPLEMENTATION REQUIRED — no standalone URL exists).
    return { provider: 'cashfree', mode: 'provider', checkoutUrl: null, orderId: res.json.order_id };
  },

  async refund(input: RefundInput): Promise<RefundResult> {
    // IMPLEMENTATION REQUIRED — Cashfree Refunds API (POST /pg/orders/:id/refunds)
    // is documented but has not been exercised against real keys.
    throw new Error('Cashfree refunds are not implemented yet (IMPLEMENTATION REQUIRED).');
  },

  verifyAndParse(headers: Record<string, string | string[] | undefined>, rawBody: Buffer): VerifyResult {
    const sig = getHeader(headers, 'x-webhook-signature');
    const secret = config.payments.cashfreeWebhookSecret;
    if (!sig || !secret || !safeEqual(hmacSha256Hex(secret, rawBody), sig)) {
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
    const order = payload?.data?.order || {};
    const event: VerifiedEvent = {
      eventId: `cf:${type}:${order?.order_id || 'unknown'}`,
      type,
      kind,
      payload,
      // Cashfree echoes our order_tags on the order object.
      paymentId: order?.order_tags?.paymentId || payload?.data?.order_tags?.paymentId || undefined,
      orderId: order?.order_id,
      amountPaise: typeof order?.order_amount === 'number' ? Math.round(order.order_amount * 100) : undefined,
    };
    return { valid: true, event };
  },
};
