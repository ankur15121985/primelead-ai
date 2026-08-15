import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { hashPassword, verifyPassword } from '../lib/passwords';
import { randomToken, hashToken } from '../lib/crypto';
import { signSession } from '../lib/jwt';
import { asyncHandler, badRequest, conflict, notFound, ok, unauthorized, validate } from '../lib/http';
import { requireAuth, type AuthedRequest } from '../middleware/auth';
import { isSuperAdminEmail } from '../middleware/admin';
import { loginLimiter } from '../middleware/rate-limit';
import { issueCsrf } from '../middleware/csrf';
import { sendMail, layoutMail } from '../lib/mailer';
import { audit } from '../lib/audit';
import { publicOrg, publicUser } from '../lib/serializers';
import { ensureOrgBasics, addSampleData } from '../services/onboarding';
import { config } from '../config';
import {
  signupSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  onboardingSchema,
} from '../validators/schemas';

const router = Router();
const COOKIE = () => config.sessionCookieName;

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'org'
  );
}

async function uniqueSlug(name: string): Promise<string> {
  const base = slugify(name);
  let slug = base;
  let i = 1;
  while (await prisma.organization.findUnique({ where: { slug } })) {
    slug = `${base}-${i++}`;
  }
  return slug;
}

function setSessionCookie(res: any, userId: string, orgId: string, role: string) {
  const token = signSession({ userId, orgId, role });
  res.cookie(COOKIE(), token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.cookieSecure,
    maxAge: config.sessionMaxAgeDays * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

router.post(
  '/signup',
  asyncHandler(async (req, res) => {
    const input = validate(signupSchema, req.body);
    const slug = await uniqueSlug(input.orgName);

    const existing = await prisma.user.findFirst({
      where: { email: input.email.toLowerCase() },
      include: { org: true },
    });
    if (existing) {
      // If the user already exists we never reveal account details; still friendly.
      throw conflict('An account with this email already exists. Please sign in.');
    }

    const org = await prisma.organization.create({
      data: {
        name: input.orgName,
        slug,
        businessType: input.businessType || null,
        plan: 'STARTER',
      },
    });
    const user = await prisma.user.create({
      data: {
        orgId: org.id,
        name: input.name,
        email: input.email.toLowerCase(),
        phone: input.phone || null,
        passwordHash: await hashPassword(input.password),
        role: 'OWNER',
      },
    });
    await ensureOrgBasics(org.id);

    // Verification token
    const token = randomToken();
    await prisma.verificationToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
    const link = `${config.appUrl}/verify-email?token=${token}`;
    await sendMail({
      to: user.email,
      subject: 'Verify your LeadFlow AI email',
      html: layoutMail(
        'Verify your email',
        `<p>Hi ${user.name},</p><p>Welcome to LeadFlow AI. Confirm your email address to keep your account secure:</p>
         <p><a href="${link}" style="background:#4f46e5;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;display:inline-block">Verify email</a></p>
         <p style="color:#94a3b8;font-size:12px">Or open: ${link}</p>`
      ),
    });

    setSessionCookie(res, user.id, org.id, user.role);
    await audit({ orgId: org.id, userId: user.id, action: 'USER_SIGNUP', req });
    return ok(res, { user: { ...publicUser(user), isSuperAdmin: isSuperAdminEmail(user.email) }, org: publicOrg(org) }, 201);
  })
);

router.post(
  '/login',
  loginLimiter,
  asyncHandler(async (req, res) => {
    const input = validate(loginSchema, req.body);
    const user = await prisma.user.findFirst({
      where: { email: input.email.toLowerCase() },
      include: { org: true },
    });
    if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
      throw unauthorized('Incorrect email or password.');
    }
    if (!user.active) throw unauthorized('This account has been deactivated.');
    // Super-admins can always sign in, even if their own org is suspended,
    // so the website handler can never lock themselves out of the admin panel.
    if (user.org.status !== 'ACTIVE' && !isSuperAdminEmail(user.email)) throw forbiddenOrg();

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    setSessionCookie(res, user.id, user.orgId, user.role);
    await audit({ orgId: user.orgId, userId: user.id, action: 'USER_LOGIN', req });
    return ok(res, { user: { ...publicUser(user), isSuperAdmin: isSuperAdminEmail(user.email) }, org: publicOrg(user.org) });
  })
);

function forbiddenOrg() {
  return Object.assign(new Error('This organization account is not active.'), { status: 403 });
}

router.post('/logout', (_req, res) => {
  res.clearCookie(COOKIE(), { path: '/' });
  res.clearCookie('lf_csrf', { path: '/' });
  return ok(res, { loggedOut: true });
});

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const [dbUser, dbOrg] = await Promise.all([
      prisma.user.findUnique({ where: { id: user.id } }),
      prisma.organization.findUnique({ where: { id: user.orgId } }),
    ]);
    if (!dbUser || !dbOrg) throw unauthorized();
    const csrf = issueCsrf(res);
    return ok(res, {
      user: { ...publicUser(dbUser), isSuperAdmin: isSuperAdminEmail(dbUser.email) },
      org: publicOrg(dbOrg),
      csrf,
    });
  })
);

router.post(
  '/verify-email',
  asyncHandler(async (req, res) => {
    const { token } = validate(z.object({ token: z.string().min(10) }), req.body);
    const row = await prisma.verificationToken.findFirst({
      where: { tokenHash: hashToken(token), usedAt: null },
    });
    if (!row || row.expiresAt < new Date()) throw badRequest('This verification link is invalid or has expired.');
    await prisma.$transaction([
      prisma.user.update({ where: { id: row.userId }, data: { emailVerifiedAt: new Date() } }),
      prisma.verificationToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
    ]);
    return ok(res, { verified: true });
  })
);

router.post(
  '/forgot-password',
  asyncHandler(async (req, res) => {
    const { email } = validate(forgotPasswordSchema, req.body);
    const user = await prisma.user.findFirst({ where: { email: email.toLowerCase() } });
    // Always return success to avoid user enumeration.
    if (user) {
      const token = randomToken();
      await prisma.resetToken.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(token),
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      });
      const link = `${config.appUrl}/reset-password?token=${token}`;
      await sendMail({
        to: user.email,
        subject: 'Reset your LeadFlow AI password',
        html: layoutMail(
          'Reset your password',
          `<p>Hi ${user.name},</p><p>We received a request to reset your password. This link is valid for 1 hour:</p>
           <p><a href="${link}" style="background:#4f46e5;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;display:inline-block">Reset password</a></p>
           <p style="color:#94a3b8;font-size:12px">Or open: ${link}</p>`
        ),
      });
    }
    return ok(res, { sent: true, message: 'If that email exists, a reset link is on its way.' });
  })
);

router.post(
  '/reset-password',
  asyncHandler(async (req, res) => {
    const { token, password } = validate(resetPasswordSchema, req.body);
    const row = await prisma.resetToken.findFirst({
      where: { tokenHash: hashToken(token), usedAt: null },
    });
    if (!row || row.expiresAt < new Date()) throw badRequest('This reset link is invalid or has expired.');
    const hash = await hashPassword(password);
    await prisma.$transaction([
      prisma.user.update({ where: { id: row.userId }, data: { passwordHash: hash } }),
      prisma.resetToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
    ]);
    return ok(res, { reset: true });
  })
);

router.post(
  '/onboarding',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const input = validate(onboardingSchema, req.body);
    if (input.businessType) {
      await prisma.organization.update({
        where: { id: user.orgId },
        data: { businessType: input.businessType },
      });
    }
    let sampleCount = 0;
    if (input.addSampleData) {
      const result = await addSampleData(user.orgId, user.id);
      sampleCount = result.created;
    }
    if (input.inviteEmails?.length) {
      const orgName = (await prisma.organization.findUnique({ where: { id: user.orgId } }))?.name || 'your team';
      for (const email of input.inviteEmails) {
        const exists = await prisma.user.findUnique({ where: { orgId_email: { orgId: user.orgId, email } } });
        if (!exists) {
          const member = await prisma.user.create({
            data: {
              orgId: user.orgId,
              name: email.split('@')[0],
              email,
              passwordHash: await hashPassword(randomToken(12)),
              role: 'SALES',
            },
          });
          // Send a set-password (reset) link so the invite is actionable.
          const token = randomToken();
          await prisma.resetToken.create({
            data: { userId: member.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000) },
          });
          const link = `${config.appUrl}/reset-password?token=${token}`;
          await sendMail({
            to: email,
            subject: `You've been added to ${orgName} on LeadFlow AI`,
            html: layoutMail(
              'You have been invited',
              `<p>You've been added as a salesperson to <strong>${orgName}</strong> on LeadFlow AI.</p>
               <p><a href="${link}" style="background:#4f46e5;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;display:inline-block">Set your password</a></p>
               <p style="color:#94a3b8;font-size:12px">Or open: ${link} (valid for 72 hours)</p>`
            ),
          });
        }
      }
    }
    return ok(res, { onboardingComplete: true, sampleCount });
  })
);

export default router;
