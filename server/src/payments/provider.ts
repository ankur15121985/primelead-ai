/**
 * Payment-provider abstraction.
 *
 * Business logic never talks to Razorpay / Stripe / Cashfree directly — it
 * talks to a `PaymentProvider`. Each adapter implements:
 *
 *   - createCheckout()      — start a hosted checkout / payment link
 *   - verifyAndParse()      — verify the webhook signature and map the event
 *
 * The only provider active without credentials is `demo`, which simulates the
 * full flow locally so the payment/subscription state machine is exercised
 * end-to-end in development and tests. Live adapters require their keys and
 * are marked IMPLEMENTATION REQUIRED until exercised against the real API.
 */
import crypto from 'crypto';
import { config } from '../config';
import { razorpayProvider } from './razorpay';
import { stripeProvider } from './stripe';
import { cashfreeProvider } from './cashfree';
import { demoProvider } from './demo';

export type ProviderEventKind =
  | 'PAYMENT_CAPTURED' // money came in — the ONLY way a payment becomes SUCCEEDED
  | 'PAYMENT_FAILED'
  | 'REFUND_PROCESSED'
  | 'SUBSCRIPTION_CANCELLED';

export interface VerifiedEvent {
  /** Deterministic unique id for this provider event (idempotency key). */
  eventId: string;
  /** Raw provider event type (payment.captured, checkout.session.completed, …). */
  type: string;
  kind: ProviderEventKind;
  payload: Record<string, unknown>;
  /** Our internal Payment id, when the provider echoes it back (metadata). */
  paymentId?: string;
  /** Provider checkout/order id — matched against Payment.providerOrderId. */
  orderId?: string;
  /** Provider payment/charge id — stored on the Payment row. */
  providerPaymentId?: string;
  /** Amount in paise as reported by the provider. */
  amountPaise?: number;
  /** Provider subscription id. */
  subscriptionRef?: string;
}

export interface VerifyResult {
  valid: boolean;
  event?: VerifiedEvent;
  error?: string;
}

export interface CreateCheckoutInput {
  orgId: string;
  orgName: string;
  customerEmail: string;
  planSlug: string;
  planName: string;
  period: 'MONTHLY' | 'YEARLY';
  amountPaise: number;
  /** Our internal Payment row id — echoed back in provider metadata. */
  paymentId: string;
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutResult {
  provider: string;
  mode: 'demo' | 'provider';
  /** Hosted checkout URL when the provider supports one. */
  checkoutUrl: string | null;
  /** Provider order/checkout id (for matching + polling). */
  orderId?: string;
}

export interface PaymentProvider {
  name: string;
  /** True when real credentials are configured (demo is never "configured"). */
  configured: boolean;
  createCheckout(input: CreateCheckoutInput): Promise<CheckoutResult>;
  verifyAndParse(headers: Record<string, string | string[] | undefined>, rawBody: Buffer): VerifyResult;
}

// ── shared signature helpers ─────────────────────────────────

export function hmacSha256Hex(secret: string, data: string | Buffer): string {
  return crypto.createHmac('sha256', secret).update(data).digest('hex');
}

export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

export function getHeader(headers: Record<string, string | string[] | undefined>, name: string): string | undefined {
  const v = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(v)) return v[0];
  return v;
}

export function providerList(): PaymentProvider[] {
  return [razorpayProvider, stripeProvider, cashfreeProvider, demoProvider];
}

export function getPaymentProvider(): PaymentProvider {
  if (config.payments.razorpayKeyId && config.payments.razorpayKeySecret) return razorpayProvider;
  if (config.payments.stripeSecretKey) return stripeProvider;
  if (config.payments.cashfreeAppId && config.payments.cashfreeSecretKey) return cashfreeProvider;
  return demoProvider;
}

export function getProviderByName(name: string): PaymentProvider | undefined {
  return providerList().find((p) => p.name === name);
}

/** POST a JSON body with basic/bearer auth to a provider API (Node 24 fetch). */
export async function providerPost(
  url: string,
  opts: { body: unknown; auth?: { username: string; password: string } | { bearer: string }; headers?: Record<string, string> }
): Promise<{ ok: boolean; status: number; json: any }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (opts.auth && 'username' in opts.auth) {
    headers.Authorization = `Basic ${Buffer.from(`${opts.auth.username}:${opts.auth.password}`).toString('base64')}`;
  } else if (opts.auth && 'bearer' in opts.auth) {
    headers.Authorization = `Bearer ${opts.auth.bearer}`;
  }
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(opts.body),
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, json };
}
