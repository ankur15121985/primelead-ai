/**
 * Demo payment provider (active when no real gateway keys are configured).
 *
 * Honest simulation: createCheckout never leaves the machine, and completing
 * a payment posts a *signed* webhook through the exact same verification +
 * idempotency + state-machine path the real providers use — so the flow is
 * fully exercised in dev and tests without pretending a gateway exists.
 */
import { config } from '../config';
import { hmacSha256Hex, safeEqual, getHeader, type PaymentProvider, type CreateCheckoutInput, type CheckoutResult, type VerifyResult, type ProviderEventKind, type RefundInput, type RefundResult } from './provider';

function sign(body: Buffer): string {
  return hmacSha256Hex(config.payments.webhookSecret, body);
}

function verifySig(headers: Record<string, string | string[] | undefined>, rawBody: Buffer): boolean {
  const sig = getHeader(headers, 'x-webhook-secret');
  if (!sig) return false;
  return safeEqual(sign(rawBody), sig);
}

const KIND_BY_TYPE: Record<string, ProviderEventKind> = {
  'payment.captured': 'PAYMENT_CAPTURED',
  'payment.failed': 'PAYMENT_FAILED',
  'refund.processed': 'REFUND_PROCESSED',
  'subscription.cancelled': 'SUBSCRIPTION_CANCELLED',
};

export const demoProvider: PaymentProvider = {
  name: 'demo',
  configured: false,

  async createCheckout(input: CreateCheckoutInput): Promise<CheckoutResult> {
    // No network — the client "simulates" payment via POST /billing/demo/complete,
    // which drives the real webhook path with a signed payload.
    return { provider: 'demo', mode: 'demo', checkoutUrl: null };
  },

  verifyAndParse(headers: Record<string, string | string[] | undefined>, rawBody: Buffer): VerifyResult {
    if (!verifySig(headers, rawBody)) {
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
    const paymentId: string = payload?.paymentId || '';
    if (!paymentId) return { valid: false, error: 'missing paymentId' };
    return {
      valid: true,
      event: {
        // The refund discriminator keeps partial refunds on the same payment
        // from colliding on the (provider, eventId) idempotency key.
        eventId: `demo:${type}:${paymentId}${payload?.refundRef ? `:${payload.refundRef}` : ''}`,
        type,
        kind,
        payload,
        paymentId,
        orderId: payload?.orderId,
        providerPaymentId: payload?.providerPaymentId,
        amountPaise: typeof payload?.amountPaise === 'number' ? payload.amountPaise : undefined,
        subscriptionRef: payload?.subscriptionRef,
      },
    };
  },

  async refund(input: RefundInput): Promise<RefundResult> {
    // Simulate the provider refunding by firing a SIGNED webhook through the
    // exact same verification + idempotency + state-machine path real gateways
    // use — nothing is marked refunded without a verified server event.
    const { handlePaymentWebhook } = await import('../services/billing');
    const refundRef = `r_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    const { headers, rawBody } = buildDemoWebhook('REFUND_PROCESSED', input.paymentId, {
      amountPaise: input.amountPaise,
      refundRef,
      reason: input.reason || null,
    });
    const result = await handlePaymentWebhook('demo', headers, rawBody);
    if (!result.ok) throw new Error(result.error || 'Refund could not be processed.');
    return { providerRefundId: `demo_${refundRef}` };
  },
};

/** Build a signed demo webhook payload (used by the demo-complete endpoint). */
export function buildDemoWebhook(
  kind: ProviderEventKind,
  paymentId: string,
  extra: Record<string, unknown> = {}
): { headers: Record<string, string>; rawBody: Buffer } {
  const type = Object.entries(KIND_BY_TYPE).find(([, k]) => k === kind)?.[0] || 'payment.captured';
  const payload = { type, paymentId, ...extra };
  const rawBody = Buffer.from(JSON.stringify(payload));
  return { headers: { 'x-webhook-secret': sign(rawBody) }, rawBody };
}
