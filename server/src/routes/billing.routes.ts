/**
 * Billing & subscriptions.
 *
 * Provider-agnostic: the UI and this API never talk to a gateway directly.
 *  - No gateway configured → demo mode: plan changes apply instantly and a
 *    payment is recorded as settled by the demo provider (clearly labeled).
 *  - Gateway configured (Razorpay/Stripe/Cashfree) → an upgrade creates a
 *    hosted checkout; the subscription only activates on a verified webhook.
 *
 *  - GET  /                    subscription + plans + payments + gateway state
 *  - POST /upgrade             switch plan (demo apply or provider checkout)
 *  - GET  /payments/:id        poll a payment's status (provider flow)
 *  - POST /demo/complete       demo: simulate a captured payment (signed webhook)
 *  - POST /cancel              cancel (immediate or at period end)
 */
import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { asyncHandler, badRequest, notFound, ok, validate } from '../lib/http';
import { requireAuth, requirePermission, assertAdminOrAbove, type AuthedRequest } from '../middleware/auth';
import { billingUpgradeSchema } from '../validators/schemas';
import { audit } from '../lib/audit';
import { config } from '../config';
import { paiseToRupees } from '../lib/money';
import { getPaymentProvider } from '../payments/provider';
import { buildDemoWebhook } from '../payments/demo';
import {
  cancelSubscription,
  expireStaleSubscriptions,
  handlePaymentWebhook,
  trialEndsAt,
} from '../services/billing';
import { z } from 'zod';

const router = Router();
router.use(requireAuth);

function publicPlan(p: any) {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    priceMonthly: paiseToRupees(p.priceMonthly),
    priceYearly: paiseToRupees(p.priceYearly),
    features: p.features || [],
    userLimit: p.userLimit,
    leadLimit: p.leadLimit,
  };
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    await expireStaleSubscriptions(user.orgId);
    const [org, plans, subscription, payments] = await Promise.all([
      prisma.organization.findUnique({ where: { id: user.orgId } }),
      prisma.plan.findMany({ where: { active: true }, orderBy: { priceMonthly: 'asc' } }),
      prisma.subscription.findUnique({ where: { orgId: user.orgId }, include: { plan: true } }),
      prisma.payment.findMany({ where: { orgId: user.orgId }, orderBy: { createdAt: 'desc' }, take: 25 }),
    ]);

    const currentPlan = plans.find((p) => p.slug === (org?.plan || 'starter').toLowerCase());
    const provider = getPaymentProvider();
    return ok(res, {
      org: { id: org?.id, name: org?.name, plan: org?.plan, status: org?.status },
      plans: plans.map(publicPlan),
      subscription: subscription
        ? {
            id: subscription.id,
            status: subscription.status,
            period: subscription.period,
            startsAt: subscription.startsAt,
            endsAt: subscription.endsAt,
            trialEndsAt: subscription.trialEndsAt,
            cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
            provider: subscription.provider,
            plan: subscription.plan ? publicPlan(subscription.plan) : currentPlan ? publicPlan(currentPlan) : null,
          }
        : null,
      currentPlan: currentPlan ? publicPlan(currentPlan) : null,
      payments: payments.map((p) => ({
        id: p.id,
        amount: paiseToRupees(p.amount),
        currency: p.currency,
        status: p.status,
        provider: p.provider,
        refundedAmount: paiseToRupees(p.refundedAmount),
        paidAt: p.paidAt,
        createdAt: p.createdAt,
      })),
      gateway: {
        configured: provider.configured,
        provider: provider.configured ? provider.name : null,
        mode: provider.configured ? 'provider' : 'demo',
      },
    });
  })
);

router.post(
  '/upgrade',
  requirePermission('billing.manage'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    assertAdminOrAbove(user);
    const input = validate(billingUpgradeSchema, req.body);
    const plan = await prisma.plan.findUnique({ where: { slug: input.planSlug } });
    if (!plan) throw badRequest('That plan does not exist.');

    const price = input.period === 'YEARLY' ? plan.priceYearly : plan.priceMonthly;
    const provider = getPaymentProvider();

    // ── Provider mode: create a hosted checkout; activate only via webhook ──
    if (provider.configured) {
      const org = await prisma.organization.findUnique({ where: { id: user.orgId } });
      if (!org) throw badRequest('Organization not found.');
      const payment = await prisma.payment.create({
        data: {
          orgId: user.orgId,
          amount: price,
          status: 'PENDING',
          provider: provider.name,
        },
      });
      let checkoutUrl: string | null = null;
      let orderId: string | undefined;
      try {
        const checkout = await provider.createCheckout({
          orgId: user.orgId,
          orgName: org.name,
          customerEmail: user.email,
          planSlug: plan.slug,
          planName: plan.name,
          period: input.period as 'MONTHLY' | 'YEARLY',
          amountPaise: price,
          paymentId: payment.id,
          successUrl: config.payments.successUrl,
          cancelUrl: config.payments.cancelUrl,
        });
        checkoutUrl = checkout.checkoutUrl;
        orderId = checkout.orderId;
      } catch (err) {
        // Checkout could not be created — never leave a dangling payment intent.
        await prisma.payment.update({ where: { id: payment.id }, data: { status: 'FAILED' } });
        throw Object.assign(new Error(err instanceof Error ? err.message : 'Payment checkout could not be created.'), { status: 400, code: 'CHECKOUT_FAILED' });
      }
      if (orderId) await prisma.payment.update({ where: { id: payment.id }, data: { providerOrderId: orderId } });

      await audit({
        orgId: user.orgId,
        userId: user.id,
        action: 'CHECKOUT_CREATED',
        entity: 'Payment',
        entityId: payment.id,
        metadata: { plan: plan.slug, period: input.period, provider: provider.name },
        req,
      });
      return ok(res, {
        applied: false,
        mode: 'provider',
        provider: provider.name,
        plan: plan.slug,
        amount: paiseToRupees(price),
        checkoutUrl,
        paymentId: payment.id,
      });
    }

    // ── Demo mode: apply immediately; record the settlement honestly ──
    // A paid plan starts a trial unless the org is already a paying customer
    // (switching plans must not reset an ACTIVE subscription back to trial).
    const existingSub = await prisma.subscription.findUnique({ where: { orgId: user.orgId } });
    const keepStatus = existingSub && ['ACTIVE', 'PAST_DUE'].includes(existingSub.status) ? existingSub.status : null;
    const subscription = await prisma.subscription.upsert({
      where: { orgId: user.orgId },
      create: {
        orgId: user.orgId,
        planId: plan.id,
        status: price === 0 ? 'ACTIVE' : 'TRIAL',
        period: input.period,
        trialEndsAt: price === 0 ? null : trialEndsAt(),
        provider: 'demo',
      },
      update: {
        planId: plan.id,
        period: input.period,
        status: price === 0 ? 'ACTIVE' : keepStatus || 'TRIAL',
        trialEndsAt: price === 0 ? null : keepStatus ? existingSub?.trialEndsAt : trialEndsAt(),
        provider: 'demo',
      },
    });
    await prisma.organization.update({ where: { id: user.orgId }, data: { plan: plan.slug.toUpperCase() } });
    await prisma.payment.create({
      data: {
        orgId: user.orgId,
        subscriptionId: subscription.id,
        amount: price,
        // Free plans settle instantly; paid plans wait for the (simulated)
        // provider webhook so the real flow is exercised end-to-end.
        status: price === 0 ? 'SUCCEEDED' : 'PENDING',
        paidAt: price === 0 ? new Date() : null,
        provider: 'DEMO',
      },
    });
    await audit({
      orgId: user.orgId,
      userId: user.id,
      action: 'PLAN_CHANGED',
      entity: 'Organization',
      entityId: user.orgId,
      metadata: { plan: plan.slug, period: input.period, mode: 'demo' },
      req,
    });
    return ok(res, { applied: true, mode: 'demo', plan: plan.slug, amount: paiseToRupees(price) });
  })
);

/** Poll a payment's status (used after redirecting to a provider checkout). */
router.get(
  '/payments/:id',
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const payment = await prisma.payment.findFirst({ where: { id: req.params.id, orgId: user.orgId } });
    if (!payment) throw notFound('Payment not found');
    return ok(res, {
      payment: {
        id: payment.id,
        status: payment.status,
        amount: paiseToRupees(payment.amount),
        provider: payment.provider,
        paidAt: payment.paidAt,
        refundedAmount: paiseToRupees(payment.refundedAmount),
      },
    });
  })
);

/** Demo-only: simulate a captured payment by firing a SIGNED demo webhook. */
router.post(
  '/demo/complete',
  requirePermission('billing.manage'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    assertAdminOrAbove(user);
    const input = validate(
      z.object({
        paymentId: z.string().min(1),
        kind: z.enum(['PAYMENT_CAPTURED', 'PAYMENT_FAILED', 'REFUND_PROCESSED']).default('PAYMENT_CAPTURED'),
      }),
      req.body
    );
    const payment = await prisma.payment.findFirst({ where: { id: input.paymentId, orgId: user.orgId } });
    if (!payment) throw notFound('Payment not found');
    if (payment.provider !== 'DEMO') throw badRequest('Only demo payments can be simulated.');

    const { headers, rawBody } = buildDemoWebhook(input.kind as 'PAYMENT_CAPTURED' | 'PAYMENT_FAILED' | 'REFUND_PROCESSED', payment.id, {
      amountPaise: payment.amount,
      ...(input.kind === 'REFUND_PROCESSED' ? { amountPaise: payment.amount } : {}),
    });
    const result = await handlePaymentWebhook('demo', headers, rawBody);
    if (!result.ok) throw Object.assign(new Error(result.error || 'Simulation failed.'), { status: 400 });
    await audit({ orgId: user.orgId, userId: user.id, action: 'DEMO_PAYMENT_SIMULATED', entity: 'Payment', entityId: payment.id, metadata: { kind: input.kind }, req });
    return ok(res, { simulated: true, duplicate: result.duplicate });
  })
);

router.post(
  '/cancel',
  requirePermission('billing.manage'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    assertAdminOrAbove(user);
    const input = validate(z.object({ atPeriodEnd: z.boolean().default(false) }), req.body);
    const updated = await cancelSubscription(user.orgId, Boolean(input.atPeriodEnd));
    if (!updated) throw badRequest('No subscription to cancel.');
    await audit({
      orgId: user.orgId,
      userId: user.id,
      action: 'SUBSCRIPTION_CANCELLED',
      entity: 'Subscription',
      entityId: updated.id,
      metadata: { atPeriodEnd: input.atPeriodEnd },
      req,
    });
    return ok(res, { cancelled: true, atPeriodEnd: input.atPeriodEnd });
  })
);

export default router;
