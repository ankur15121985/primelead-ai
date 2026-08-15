/**
 * Billing & subscriptions.
 *
 * Provider-agnostic by design: the UI and this API never talk to Razorpay or
 * Stripe directly. When a payment provider is configured, an upgrade creates a
 * checkout/order session; without one, the plan simply changes (demo mode)
 * and a Payment row is recorded as a pending manual payment.
 *
 *  - GET  /           subscription + plans + payments
 *  - POST /upgrade    switch plan (demo or provider session)
 *  - POST /cancel     cancel subscription
 */
import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { asyncHandler, badRequest, ok, validate } from '../lib/http';
import { requireAuth, requirePermission, assertAdminOrAbove, type AuthedRequest } from '../middleware/auth';
import { billingUpgradeSchema } from '../validators/schemas';
import { audit } from '../lib/audit';
import { config } from '../config';
import { paiseToRupees } from '../lib/money';

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
  };
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const [org, plans, subscription, payments] = await Promise.all([
      prisma.organization.findUnique({ where: { id: user.orgId } }),
      prisma.plan.findMany({ where: { active: true }, orderBy: { priceMonthly: 'asc' } }),
      prisma.subscription.findUnique({ where: { orgId: user.orgId }, include: { plan: true } }),
      prisma.payment.findMany({ where: { orgId: user.orgId }, orderBy: { createdAt: 'desc' }, take: 25 }),
    ]);

    const currentPlan = plans.find((p) => p.slug === (org?.plan || 'starter').toLowerCase());
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
        createdAt: p.createdAt,
      })),
      gateway: {
        configured: Boolean(process.env.RAZORPAY_KEY_ID || process.env.STRIPE_SECRET_KEY),
        provider: process.env.RAZORPAY_KEY_ID ? 'razorpay' : process.env.STRIPE_SECRET_KEY ? 'stripe' : null,
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

    // Demo mode: apply immediately, record a pending payment so history is honest.
    if (!process.env.RAZORPAY_KEY_ID && !process.env.STRIPE_SECRET_KEY) {
      const subscription = await prisma.subscription.upsert({
        where: { orgId: user.orgId },
        create: {
          orgId: user.orgId,
          planId: plan.id,
          status: price === 0 ? 'ACTIVE' : 'TRIAL',
          period: input.period,
        },
        update: { planId: plan.id, period: input.period, status: price === 0 ? 'ACTIVE' : 'TRIAL', provider: null },
      });
      await prisma.organization.update({ where: { id: user.orgId }, data: { plan: plan.slug.toUpperCase() } });
      await prisma.payment.create({
        data: {
          orgId: user.orgId,
          subscriptionId: subscription.id,
          amount: price,
          status: price === 0 ? 'SUCCEEDED' : 'PENDING',
          provider: 'MANUAL',
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
    }

    // Provider mode: return a session stub (implemented when gateway keys exist)
    await prisma.subscription.upsert({
      where: { orgId: user.orgId },
      create: { orgId: user.orgId, planId: plan.id, status: 'TRIAL', period: input.period, provider: process.env.RAZORPAY_KEY_ID ? 'razorpay' : 'stripe' },
      update: { planId: plan.id, period: input.period, provider: process.env.RAZORPAY_KEY_ID ? 'razorpay' : 'stripe' },
    });
    return ok(res, { applied: false, mode: 'provider', plan: plan.slug, amount: paiseToRupees(price), checkoutUrl: null });
  })
);

router.post(
  '/cancel',
  requirePermission('billing.manage'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    assertAdminOrAbove(user);
    const subscription = await prisma.subscription.findUnique({ where: { orgId: user.orgId } });
    if (!subscription) throw badRequest('No subscription to cancel.');
    await prisma.subscription.update({ where: { id: subscription.id }, data: { status: 'CANCELLED' } });
    await audit({ orgId: user.orgId, userId: user.id, action: 'SUBSCRIPTION_CANCELLED', entity: 'Subscription', entityId: subscription.id, req });
    return ok(res, { cancelled: true });
  })
);

export default router;
