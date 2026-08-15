/**
 * Demo payment provider (active when no real gateway keys are configured).
 *
 * Honest simulation: createCheckout never leaves the machine, and completing
 * a payment posts a *signed* webhook through the exact same verification +
 * idempotency + state-machine path the real providers use — so the flow is
 * fully exercised in dev and tests without pretending a gateway exists.
 */
import { config } from '../config';
import { hmacSha256Hex, safeEqual, getHeader, type PaymentProvider, type CreateCheckoutInput, type CheckoutResult, type VerifyResult, type ProviderEventKind } from './provider';

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
        eventId: `demo:${type}:${paymentId}`,
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
