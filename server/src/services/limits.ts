/**
 * Plan-driven usage limits.
 *
 * Limits live in the Plan table (config-driven — never hard-coded). A limit of
 * 0 means unlimited. Enforcement happens at the service layer so every entry
 * point (manual, QR, webhooks, CSV, team invites) is covered.
 */
import { prisma } from '../lib/prisma';
import { resolvePlan, expireStaleSubscriptions } from './billing';

export type LimitResource = 'users' | 'leads';

async function countUsage(orgId: string, resource: LimitResource): Promise<number> {
  if (resource === 'users') {
    return prisma.user.count({ where: { orgId } });
  }
  return prisma.lead.count({ where: { orgId, deletedAt: null } });
}

export async function checkLimit(orgId: string, resource: LimitResource) {
  // Lazy expiry: a stale trial/cancelled period drops the org back to free.
  await expireStaleSubscriptions(orgId);
  const { plan } = await resolvePlan(orgId);
  const limit = plan ? (resource === 'users' ? plan.userLimit : plan.leadLimit) : 0;
  const current = await countUsage(orgId, resource);
  const allowed = limit === 0 || current < limit;
  return {
    allowed,
    current,
    limit,
    planSlug: plan?.slug || 'starter',
  };
}

/** Throw a friendly 403 (LIMIT_EXCEEDED) when the org is over its plan cap. */
export async function assertWithinLimit(orgId: string, resource: LimitResource): Promise<void> {
  const { allowed, current, limit, planSlug } = await checkLimit(orgId, resource);
  if (!allowed) {
    const label = resource === 'users' ? 'team members' : 'leads';
    const err = new Error(
      `You've reached the ${label} limit on your ${planSlug} plan (${current}/${limit === 0 ? 'unlimited' : limit}). Upgrade to continue adding ${resource === 'users' ? 'members' : 'leads'}.`
    ) as Error & { status: number; code: string };
    err.status = 403;
    err.code = 'LIMIT_EXCEEDED';
    throw err;
  }
}
