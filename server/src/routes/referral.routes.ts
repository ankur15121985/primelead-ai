import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, type AuthedRequest } from '../middleware/auth';
import { asyncHandler, ApiError, validate } from '../lib/http';
import { prisma } from '../lib/prisma';
import { audit } from '../lib/audit';
import { rupeesToPaise, paiseToRupees } from '../lib/money';

const router = Router();

// Generate referral code for current user
router.post(
  '/generate-code',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const { commissionPct } = validate(
      z.object({
        commissionPct: z.number().min(1).max(50).default(10),
      }),
      req.body
    );

    // Check if user already has a referral code
    const existing = await prisma.referral.findFirst({
      where: { referrerUserId: user.id },
    });

    if (existing) {
      return res.json({ data: { referralCode: existing.referralCode, commissionPct: existing.commissionPct } });
    }

    // Generate unique referral code
    const referralCode = `PL-${user.orgId.slice(0, 4).toUpperCase()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    const referral = await prisma.referral.create({
      data: {
        orgId: user.orgId,
        referrerUserId: user.id,
        referralCode,
        commissionPct,
      },
    });

    await audit({
      orgId: user.orgId,
      userId: user.id,
      action: 'REFERRAL_CODE_GENERATED',
      entity: 'Referral',
      entityId: referral.id,
      metadata: { referralCode },
      req,
    });

    res.status(201).json({ data: { referralCode, commissionPct } });
  })
);

// Get my referral stats
router.get('/stats', requireAuth, asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;

  const referral = await prisma.referral.findFirst({
    where: { referrerUserId: user.id },
    include: {
      referredOrg: {
        select: { id: true, name: true, slug: true, plan: true, status: true, createdAt: true },
      },
      payouts: true,
    },
  });

  if (!referral) {
    return res.json({
      data: {
        hasCode: false,
        referralCode: null,
        stats: { totalReferrals: 0, convertedReferrals: 0, totalPayouts: 0, pendingPayouts: 0 },
      },
    });
  }

  const totalReferrals = await prisma.referral.count({
    where: { referrerUserId: user.id },
  });

  const convertedReferrals = await prisma.referral.count({
    where: { referrerUserId: user.id, status: 'CONVERTED' },
  });

  const totalPayouts = await prisma.referralPayout.aggregate({
    where: { referral: { referrerUserId: user.id }, status: 'PAID' },
    _sum: { amount: true },
  });

  const pendingPayouts = await prisma.referralPayout.aggregate({
    where: { referral: { referrerUserId: user.id }, status: 'PENDING' },
    _sum: { amount: true },
  });

  res.json({
    data: {
      hasCode: true,
      referralCode: referral.referralCode,
      commissionPct: referral.commissionPct,
      referredOrg: referral.referredOrg,
      status: referral.status,
      stats: {
        totalReferrals,
        convertedReferrals,
        totalPayouts: paiseToRupees(totalPayouts._sum.amount || 0),
        pendingPayouts: paiseToRupees(pendingPayouts._sum.amount || 0),
      },
    },
  });
})
);

// Apply referral code during signup (public endpoint)
router.post(
  '/apply',
  asyncHandler(async (req, res) => {
    const { referralCode, orgId } = validate(
      z.object({
        referralCode: z.string().min(1),
        orgId: z.string(),
      }),
      req.body
    );

    // Find the referral code
    const referral = await prisma.referral.findUnique({
      where: { referralCode },
      include: { referrerUser: true },
    });

    if (!referral) {
      throw new ApiError(404, 'INVALID_REFERRAL_CODE', 'Referral code not found');
    }

    // Check if the org is already referred
    const existingReferral = await prisma.referral.findFirst({
      where: { referredOrgId: orgId },
    });

    if (existingReferral) {
      return res.json({ data: { applied: false, message: 'Organization already referred' } });
    }

    // Update the referral with the referred org
    await prisma.referral.update({
      where: { id: referral.id },
      data: {
        referredOrgId: orgId,
        status: 'CONVERTED',
        commissionAmount: 0, // Will be calculated based on plan later
      },
    });

    await audit({
      orgId: referral.orgId,
      userId: referral.referrerUserId,
      action: 'REFERRAL_CONVERTED',
      entity: 'Referral',
      entityId: referral.id,
      metadata: { referredOrgId: orgId, referralCode },
      req,
    });

    res.json({ data: { applied: true, message: 'Referral code applied successfully' } });
  })
);

// List all referrals for my org (admin/owner only)
router.get('/', requireAuth, asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;

  if (user.role !== 'OWNER' && user.role !== 'ADMIN') {
    throw new ApiError(403, 'FORBIDDEN', 'Only owners and admins can view referrals');
  }

  const referrals = await prisma.referral.findMany({
    where: { orgId: user.orgId },
    include: {
      referrerUser: {
        select: { id: true, name: true, email: true },
      },
      referredOrg: {
        select: { id: true, name: true, slug: true, plan: true, status: true },
      },
      payouts: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ data: { referrals } });
})
);

// Admin: Create payout for a referral
router.post(
  '/:id/payout',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const { id } = req.params;
    const { amount, currency } = validate(
      z.object({
        amount: z.number().positive(),
        currency: z.string().default('INR'),
      }),
      req.body
    );

    if (user.role !== 'OWNER' && user.role !== 'ADMIN') {
      throw new ApiError(403, 'FORBIDDEN', 'Only owners and admins can create payouts');
    }

    const referral = await prisma.referral.findFirst({
      where: { id, orgId: user.orgId },
    });

    if (!referral) {
      throw new ApiError(404, 'NOT_FOUND', 'Referral not found');
    }

    const payout = await prisma.referralPayout.create({
      data: {
        referralId: id,
        amount: rupeesToPaise(amount),
        currency,
        status: 'PENDING',
      },
    });

    await audit({
      orgId: user.orgId,
      userId: user.id,
      action: 'REFERRAL_PAYOUT_CREATED',
      entity: 'ReferralPayout',
      entityId: payout.id,
      metadata: { referralId: id, amount, currency },
      req,
    });

    res.status(201).json({ data: { payout } });
  })
);

export default router;
