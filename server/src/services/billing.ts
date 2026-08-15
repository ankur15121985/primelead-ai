/**
 * Billing service: subscription lifecycle + payment-webhook processing.
 *
 * The ONLY way a payment becomes SUCCEEDED (and a subscription ACTIVE) is a
 * server-verified provider webhook — never a frontend confirmation.
 *
 * Webhook flow (idempotent): verify signature → upsert WebhookEvent by
 * (provider, eventId) → if already PROCESSED, ack without reprocessing →
 * apply the state change in a transaction → mark PROCESSED.
 */
import { prisma } from '../lib/prisma';
import { config } from '../config';
import { getProviderByName, type VerifiedEvent } from '../payments/provider';

export const SUBSCRIPTION_STATUSES = ['TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'EXPIRED'] as const;

/** End date for a billing period starting at `from`. */
export function periodEndsAt(period: 'MONTHLY' | 'YEARLY', from: Date): Date {
  const d = new Date(from);
  if (period === 'YEARLY') d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1);
  return d;
}

/** Find the plan that applies to an org (subscription plan → org.plan slug → starter). */
export async function resolvePlan(orgId: string) {
  const sub = await prisma.subscription.findUnique({ where: { orgId }, include: { plan: true } });
  if (sub?.plan) return { plan: sub.plan, subscription: sub };
  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { plan: true } });
  const bySlug = await prisma.plan.findUnique({ where: { slug: (org?.plan || 'STARTER').toLowerCase() } });
  return { plan: bySlug || null, subscription: sub };
}

/**
 * Activate a subscription after a captured payment.
 * Idempotent: if the subscription is already ACTIVE on the same plan, only
 * the endsAt is rolled forward.
 */
export async function activateSubscriptionForPayment(opts: {
  orgId: string;
  planSlug: string;
  planId: string;
  period: 'MONTHLY' | 'YEARLY';
  provider: string;
  paidAt: Date;
}) {
  const { orgId, planSlug, planId, period, provider, paidAt } = opts;
  const endsAt = periodEndsAt(period, paidAt);
  const subscription = await prisma.subscription.upsert({
    where: { orgId },
    create: {
      orgId,
      planId,
      status: 'ACTIVE',
      period,
      startsAt: paidAt,
      endsAt,
      provider,
      cancelAtPeriodEnd: false,
    },
    update: {
      planId,
      status: 'ACTIVE',
      period,
      startsAt: paidAt,
      endsAt,
      provider,
      cancelAtPeriodEnd: false,
      trialEndsAt: null,
    },
  });
  await prisma.organization.update({ where: { id: orgId }, data: { plan: planSlug.toUpperCase() } });
  return subscription;
}

/** Mark the subscription PAST_DUE after a failed payment (paid plans only). */
export async function markSubscriptionPastDue(orgId: string, planSlug: string) {
  await prisma.subscription.updateMany({
    where: { orgId, status: { in: ['ACTIVE', 'PAST_DUE'] } },
    data: { status: 'PAST_DUE' },
  });
  // Keep the org on its plan during the grace period (configured elsewhere).
  await prisma.organization.update({ where: { id: orgId }, data: { plan: planSlug.toUpperCase() } });
}

/** Cancel a subscription. atPeriodEnd keeps service until endsAt. */
export async function cancelSubscription(orgId: string, atPeriodEnd: boolean) {
  const sub = await prisma.subscription.findUnique({ where: { orgId } });
  if (!sub) return null;
  const updated = await prisma.subscription.update({
    where: { id: sub.id },
    data: atPeriodEnd ? { cancelAtPeriodEnd: true, status: sub.status === 'PAST_DUE' ? 'PAST_DUE' : 'ACTIVE' } : { status: 'CANCELLED', cancelAtPeriodEnd: false },
  });
  return updated;
}

/** Downgrade orgs whose trial/cancelled period has passed (called lazily). */
export async function expireStaleSubscriptions(orgId: string): Promise<void> {
  const sub = await prisma.subscription.findUnique({ where: { orgId } });
  if (!sub) return;
  const now = new Date();
  if (sub.status === 'TRIAL' && sub.trialEndsAt && sub.trialEndsAt < now) {
    await prisma.subscription.update({ where: { id: sub.id }, data: { status: 'EXPIRED' } });
    // Return to the free tier if no paid plan was ever activated.
    await prisma.organization.update({ where: { id: orgId }, data: { plan: 'STARTER' } });
    return;
  }
  if (sub.status === 'CANCELLED' && sub.cancelAtPeriodEnd && sub.endsAt && sub.endsAt < now) {
    await prisma.subscription.update({ where: { id: sub.id }, data: { status: 'EXPIRED' } });
    await prisma.organization.update({ where: { id: orgId }, data: { plan: 'STARTER' } });
  }
}

/**
 * Find the Payment row a verified webhook event refers to.
 * Prefers our internal id (echoed in provider metadata), then the provider
 * order id, then the provider payment id.
 */
export async function findPaymentForEvent(event: VerifiedEvent) {
  if (event.paymentId) {
    const byId = await prisma.payment.findUnique({ where: { id: event.paymentId } });
    if (byId) return byId;
  }
  if (event.orderId) {
    const byOrder = await prisma.payment.findFirst({ where: { providerOrderId: event.orderId } });
    if (byOrder) return byOrder;
  }
  if (event.providerPaymentId) {
    const byPay = await prisma.payment.findFirst({ where: { providerPaymentId: event.providerPaymentId } });
    if (byPay) return byPay;
  }
  return null;
}

/**
 * Apply a verified provider event to our state. Throws on processing errors so
 * the webhook returns a non-2xx and the provider retries.
 */
export async function processPaymentEvent(provider: string, event: VerifiedEvent): Promise<void> {
  const payment = await findPaymentForEvent(event);

  switch (event.kind) {
    case 'PAYMENT_CAPTURED': {
      if (!payment) {
        // Not ours (or already deleted) — ack without side effects.
        return;
      }
      // Amount check: never mark paid for a different amount than we billed.
      if (event.amountPaise !== undefined && event.amountPaise !== payment.amount) {
        throw new Error(
          `amount mismatch for payment ${payment.id}: expected ${payment.amount} paise, provider reported ${event.amountPaise}`
        );
      }
      const sub = await prisma.subscription.findUnique({ where: { orgId: payment.orgId } });
      const plan = sub?.planId
        ? await prisma.plan.findUnique({ where: { id: sub.planId } })
        : await prisma.plan.findUnique({ where: { slug: (await prisma.organization.findUnique({ where: { id: payment.orgId }, select: { plan: true } }))?.plan.toLowerCase() || 'starter' } });
      if (!plan) throw new Error(`plan not found for org ${payment.orgId}`);

      await prisma.$transaction([
        prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: 'SUCCEEDED',
            paidAt: new Date(),
            providerPaymentId: event.providerPaymentId || payment.providerPaymentId,
            providerOrderId: event.orderId || payment.providerOrderId,
          },
        }),
        prisma.subscription.upsert({
          where: { orgId: payment.orgId },
          create: {
            orgId: payment.orgId,
            planId: plan.id,
            status: 'ACTIVE',
            period: (sub?.period as 'MONTHLY' | 'YEARLY') || 'MONTHLY',
            startsAt: new Date(),
            endsAt: periodEndsAt((sub?.period as 'MONTHLY' | 'YEARLY') || 'MONTHLY', new Date()),
            provider,
          },
          update: {
            planId: plan.id,
            status: 'ACTIVE',
            period: (sub?.period as 'MONTHLY' | 'YEARLY') || 'MONTHLY',
            endsAt: periodEndsAt((sub?.period as 'MONTHLY' | 'YEARLY') || 'MONTHLY', new Date()),
            provider,
            cancelAtPeriodEnd: false,
            trialEndsAt: null,
          },
        }),
        prisma.organization.update({ where: { id: payment.orgId }, data: { plan: plan.slug.toUpperCase() } }),
      ]);
      return;
    }

    case 'PAYMENT_FAILED': {
      if (!payment) return;
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: payment.status === 'SUCCEEDED' ? payment.status : 'FAILED' },
      });
      if (payment.status !== 'SUCCEEDED') {
        const org = await prisma.organization.findUnique({ where: { id: payment.orgId }, select: { plan: true } });
        await markSubscriptionPastDue(payment.orgId, (org?.plan || 'STARTER').toLowerCase());
      }
      return;
    }

    case 'REFUND_PROCESSED': {
      if (!payment) return;
      const amount = event.amountPaise ?? 0;
      const refundedAmount = payment.refundedAmount + amount;
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          refundedAmount,
          status: refundedAmount >= payment.amount ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
        },
      });
      return;
    }

    case 'SUBSCRIPTION_CANCELLED': {
      if (!payment) return;
      await prisma.subscription.updateMany({ where: { orgId: payment.orgId }, data: { status: 'CANCELLED', cancelAtPeriodEnd: false } });
      return;
    }
  }
}

/**
 * The full webhook pipeline shared by the route and the demo simulator:
 * verify signature → idempotency check → process → mark PROCESSED.
 * Returns { acked: true } when the event was already handled.
 */
export async function handlePaymentWebhook(
  provider: string,
  headers: Record<string, string | string[] | undefined>,
  rawBody: Buffer
): Promise<{ ok: boolean; duplicate: boolean; error?: string }> {
  const adapter = getProviderByName(provider);
  if (!adapter) return { ok: false, duplicate: false, error: 'unknown provider' };

  const { valid, event, error } = adapter.verifyAndParse(headers, rawBody);
  if (!valid || !event) return { ok: false, duplicate: false, error: error || 'invalid signature' };

  // Idempotency: (provider, eventId) is unique.
  const existing = await prisma.webhookEvent.findUnique({
    where: { provider_eventId: { provider, eventId: event.eventId } },
  });
  if (existing) {
    // Already processed (or in-flight) — acknowledge without reprocessing.
    return { ok: true, duplicate: true };
  }

  await prisma.webhookEvent.create({
    data: {
      provider,
      eventId: event.eventId,
      type: event.type,
      payload: event.payload as any,
      status: 'RECEIVED',
    },
  });

  let orgId: string | null = null;
  const payment = await findPaymentForEvent(event);
  if (payment) orgId = payment.orgId;

  try {
    await processPaymentEvent(provider, event);
  } catch (err) {
    const message = err instanceof Error ? err.message.slice(0, 500) : 'processing failed';
    await prisma.webhookEvent.update({
      where: { provider_eventId: { provider, eventId: event.eventId } },
      data: { status: 'FAILED', error: message, orgId },
    });
    throw err; // non-2xx → provider retries
  }

  await prisma.webhookEvent.update({
    where: { provider_eventId: { provider, eventId: event.eventId } },
    data: { status: 'PROCESSED', processedAt: new Date(), orgId },
  });
  return { ok: true, duplicate: false };
}

/** Trial length in days for new paid subscriptions (config-driven). */
export function trialEndsAt(from: Date = new Date()): Date {
  return new Date(from.getTime() + config.trialDays * 24 * 60 * 60 * 1000);
}
