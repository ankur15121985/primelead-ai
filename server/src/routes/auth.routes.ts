import { Router } from 'express';
import { z } from 'zod';
import { generateSecret, generateURI, verify as verifyTotp } from 'otplib';
import QRCode from 'qrcode';
import { prisma } from '../lib/prisma';
import { hashPassword, verifyPassword } from '../lib/passwords';
import { randomToken, hashToken } from '../lib/crypto';
import { signMfaToken, verifyMfaToken } from '../lib/jwt';
import { createSession, resolveSession, revokeSession, revokeOtherSessions, revokeAllSessions } from '../lib/sessions';
import { asyncHandler, badRequest, ok, unauthorized, validate } from '../lib/http';
import { requireAuth, type AuthedRequest } from '../middleware/auth';
import { isSuperAdminEmail } from '../middleware/admin';
import { loginLimiter } from '../middleware/rate-limit';
import { CSRF_COOKIE } from '../middleware/csrf';
import { sendMail, layoutMail } from '../lib/mailer';
import { audit } from '../lib/audit';
import { publicOrg, publicUser } from '../lib/serializers';
import { ensureOrgBasics, addSampleData } from '../services/onboarding';
import { seedOrgRoles } from '../services/rbac';
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

function setSessionCookie(res: any, token: string) {
  res.cookie(COOKIE(), token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.cookieSecure,
    maxAge: config.sessionMaxAgeDays * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

function clearSessionCookie(res: any) {
  // Only the session cookie is cleared. The CSRF cookie is not sensitive and
  // is validated against the session cookie, so keeping it lets the client
  // sign back in without an extra round-trip.
  res.clearCookie(COOKIE(), { path: '/' });
}

function deviceName(ua?: string): string {
  if (!ua) return 'Unknown device';
  if (/android/i.test(ua)) return 'Android device';
  if (/iphone|ipad|ios/i.test(ua)) return 'Apple mobile device';
  if (/windows/i.test(ua)) return 'Windows computer';
  if (/macintosh|mac os/i.test(ua)) return 'Mac computer';
  if (/linux/i.test(ua)) return 'Linux computer';
  return ua.slice(0, 40);
}

interface LoginMeta {
  ip?: string;
  ua?: string;
}

/** Record a login attempt (success or failure) — fire-and-forget. */
async function recordLogin(meta: LoginMeta & { orgId?: string | null; userId?: string | null; email: string; success: boolean; reason: string; newDevice?: boolean }) {
  try {
    await prisma.loginHistory.create({
      data: {
        orgId: meta.orgId || null,
        userId: meta.userId || null,
        email: meta.email,
        success: meta.success,
        ip: meta.ip ? meta.ip.slice(0, 45) : null,
        userAgent: meta.ua ? meta.ua.slice(0, 300) : null,
        reason: meta.reason,
        newDevice: Boolean(meta.newDevice),
      },
    });
  } catch {
    // history must never break login
  }
}

/**
 * Finish a successful login: create a revocable session, set the cookie,
 * detect new devices and reset the lock counter.
 */
async function completeLogin(req: any, res: any, user: any, org: any, reason: string) {
  const ua = String(req.headers['user-agent'] || '');
  const ip = req.ip || req.socket?.remoteAddress || '';
  const { token, id } = await createSession(user.id, { ip, userAgent: ua, deviceName: deviceName(ua) });

  const prior = await prisma.session.count({
    where: { userId: user.id, id: { not: id }, userAgent: ua, revokedAt: null },
  });
  const isNewDevice = prior === 0;

  setSessionCookie(res, token);
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date(), failedLoginAttempts: 0, lockedUntil: null },
  });
  await recordLogin({ orgId: user.orgId, userId: user.id, email: user.email, success: true, reason, ip, ua, newDevice: isNewDevice });
  await audit({ orgId: user.orgId, userId: user.id, action: 'USER_LOGIN', req });

  if (isNewDevice && reason !== 'RECOVERY_OK') {
    await prisma.notification.create({
      data: {
        orgId: user.orgId,
        userId: user.id,
        type: 'SYSTEM',
        title: 'New device sign-in',
        body: `A new sign-in was detected from ${deviceName(ua)}. If this wasn't you, reset your password and review your sessions in Settings → Security.`,
        link: '/app/settings',
      },
    });
  }

  return ok(res, {
    user: { ...publicUser(user), isSuperAdmin: isSuperAdminEmail(user.email), permissions: await permissionsOf(user) },
    org: publicOrg(org),
  });
}

/** Permission set for the /me and login payloads. */
async function permissionsOf(user: { orgId: string; role: string }) {
  const { rolePermissions } = await import('../services/rbac');
  return rolePermissions(user.orgId, user.role);
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
      throw Object.assign(new Error('An account with this email already exists. Please sign in.'), { status: 409, code: 'CONFLICT' });
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
    await seedOrgRoles(org.id);

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
      subject: 'Verify your PRIMELEAD AI email',
      html: layoutMail(
        'Verify your email',
        `<p>Hi ${user.name},</p><p>Welcome to PRIMELEAD AI. Confirm your email address to keep your account secure:</p>
         <p><a href="${link}" style="background:#4f46e5;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;display:inline-block">Verify email</a></p>
         <p style="color:#94a3b8;font-size:12px">Or open: ${link}</p>`
      ),
    });

    const { token: sessionToken } = await createSession(user.id, {
      ip: req.ip || '',
      userAgent: String(req.headers['user-agent'] || ''),
      deviceName: deviceName(String(req.headers['user-agent'] || '')),
    });
    setSessionCookie(res, sessionToken);
    await audit({ orgId: org.id, userId: user.id, action: 'USER_SIGNUP', req });
    return ok(
      res,
      {
        user: { ...publicUser(user), isSuperAdmin: isSuperAdminEmail(user.email), permissions: await permissionsOf(user) },
        org: publicOrg(org),
      },
      201
    );
  })
);

router.post(
  '/login',
  loginLimiter,
  asyncHandler(async (req, res) => {
    const input = validate(loginSchema, req.body);
    const ua = String(req.headers['user-agent'] || '');
    const ip = req.ip || req.socket?.remoteAddress || '';
    const email = input.email.toLowerCase();

    const user = await prisma.user.findFirst({ where: { email }, include: { org: true } });

    if (!user) {
      await recordLogin({ email, success: false, reason: 'UNKNOWN_USER', ip, ua });
      throw unauthorized('Incorrect email or password.');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      await recordLogin({ orgId: user.orgId, userId: user.id, email, success: false, reason: 'LOCKED', ip, ua });
      throw unauthorized('Too many failed attempts. This account is temporarily locked. Try again later.');
    }

    if (!(await verifyPassword(input.password, user.passwordHash))) {
      const attempts = (user.failedLoginAttempts || 0) + 1;
      const lockedUntil = attempts >= config.loginMaxAttempts ? new Date(Date.now() + config.loginLockMinutes * 60 * 1000) : null;
      await prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: lockedUntil ? 0 : attempts, ...(lockedUntil ? { lockedUntil } : {}) },
      });
      await recordLogin({ orgId: user.orgId, userId: user.id, email, success: false, reason: 'BAD_PASSWORD', ip, ua });
      throw unauthorized('Incorrect email or password.');
    }
    if (!user.active) throw unauthorized('This account has been deactivated.');
    // Super-admins can always sign in, even if their own org is suspended,
    // so the website handler can never lock themselves out of the admin panel.
    if (user.org.status !== 'ACTIVE' && !isSuperAdminEmail(user.email)) {
      await recordLogin({ orgId: user.orgId, userId: user.id, email, success: false, reason: 'ORG_SUSPENDED', ip, ua });
      throw Object.assign(new Error('This organization account is not active.'), { status: 403 });
    }

    // MFA gate: if enabled, hand out a short-lived challenge instead of a session.
    const mfa = await prisma.mfaSecret.findUnique({ where: { userId: user.id } });
    if (mfa) {
      return ok(res, { mfaRequired: true, mfaToken: signMfaToken(user.id) });
    }

    return completeLogin(req, res, user, user.org, 'OK');
  })
);

const mfaVerifySchema = z.object({ mfaToken: z.string().min(10), code: z.string().trim().min(6).max(10) });
// Recovery codes are displayed dash-separated (XXXX-XXXX-XXXX-XXXX = 19 chars)
// but verified dashless, so allow the separator form here.
const mfaRecoverySchema = z.object({ mfaToken: z.string().min(10), code: z.string().trim().min(6).max(20) });

/** Verify the TOTP code and complete the login. */
router.post(
  '/mfa/verify',
  loginLimiter,
  asyncHandler(async (req, res) => {
    const input = validate(mfaVerifySchema, req.body);
    const payload = verifyMfaToken(input.mfaToken);
    if (!payload) throw unauthorized('This verification session has expired. Please sign in again.');
    const user = await prisma.user.findFirst({ where: { id: payload.userId }, include: { org: true, mfa: true } });
    if (!user || !user.mfa) throw unauthorized('Multi-factor authentication is not enabled for this account.');

    const check = await verifyTotp({ token: input.code.replace(/\s/g, ''), secret: user.mfa.secret });
    if (!(check as any)?.valid) throw unauthorized('That verification code is incorrect.');
    return completeLogin(req, res, user, user.org, 'MFA_OK');
  })
);

/** Verify a recovery code and complete the login. */
router.post(
  '/mfa/recovery',
  loginLimiter,
  asyncHandler(async (req, res) => {
    const input = validate(mfaRecoverySchema, req.body);
    const payload = verifyMfaToken(input.mfaToken);
    if (!payload) throw unauthorized('This verification session has expired. Please sign in again.');
    const user = await prisma.user.findFirst({ where: { id: payload.userId }, include: { org: true, mfa: true } });
    if (!user || !user.mfa) throw unauthorized('Multi-factor authentication is not enabled for this account.');

    const normalized = input.code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    const codeHash = hashToken(normalized);
    const recovery = await prisma.recoveryCode.findFirst({ where: { userId: user.id, codeHash, usedAt: null } });
    if (!recovery) throw unauthorized('That recovery code is invalid or has already been used.');
    await prisma.recoveryCode.update({ where: { id: recovery.id }, data: { usedAt: new Date() } });
    return completeLogin(req, res, user, user.org, 'RECOVERY_OK');
  })
);

/** Begin MFA setup — returns the TOTP secret + provisioning QR (requires current password). */
router.post(
  '/mfa/setup',
  requireAuth,
  asyncHandler(async (req, res) => {
    const me = (req as AuthedRequest).user;
    const { password } = validate(z.object({ password: z.string().min(1) }), req.body);
    const dbUser = await prisma.user.findUnique({ where: { id: me.id } });
    if (!dbUser || !(await verifyPassword(password, dbUser.passwordHash))) throw badRequest('Your current password is incorrect.');

    const existing = await prisma.mfaSecret.findUnique({ where: { userId: me.id } });
    if (existing) throw badRequest('Multi-factor authentication is already enabled. Disable it first to set up a new key.');

    const secret = generateSecret();
    const otpauthUrl = generateURI({ secret, label: dbUser.email, issuer: config.mfaIssuer });
    const qrDataUrl = await QRCode.toDataURL(otpauthUrl);
    return ok(res, { secret, otpauthUrl, qrDataUrl });
  })
);

/** Confirm MFA with a code — enables it and returns one-time recovery codes. */
router.post(
  '/mfa/confirm',
  requireAuth,
  asyncHandler(async (req, res) => {
    const me = (req as AuthedRequest).user;
    const { secret, code } = validate(
      z.object({ secret: z.string().trim().min(16).max(64), code: z.string().trim().min(6).max(10) }),
      req.body
    );
    const check = await verifyTotp({ token: code.replace(/\s/g, ''), secret });
    if (!(check as any)?.valid) {
      throw badRequest('That verification code is incorrect. Try again or scan the QR again.');
    }
    const existing = await prisma.mfaSecret.findUnique({ where: { userId: me.id } });
    if (existing) throw badRequest('Multi-factor authentication is already enabled.');

    await prisma.mfaSecret.create({ data: { userId: me.id, secret } });

    // 10 single-use recovery codes, returned once in plaintext. The stored
    // hash uses the dashless uppercase form so users may type with/without
    // separators. Each code carries 64 bits of entropy.
    const raws = Array.from({ length: 10 }, () => randomToken(8).toUpperCase().slice(0, 16));
    const codes = raws.map((r) => `${r.slice(0, 4)}-${r.slice(4, 8)}-${r.slice(8, 12)}-${r.slice(12)}`);
    await prisma.recoveryCode.createMany({
      data: raws.map((r) => ({ userId: me.id, codeHash: hashToken(r) })),
    });
    await audit({ orgId: me.orgId, userId: me.id, action: 'MFA_ENABLED', entity: 'User', entityId: me.id, req });
    return ok(res, { enabled: true, recoveryCodes: codes });
  })
);

/** Disable MFA — requires current password + a valid TOTP or recovery code. */
router.post(
  '/mfa/disable',
  requireAuth,
  asyncHandler(async (req, res) => {
    const me = (req as AuthedRequest).user;
    const input = validate(
      z.object({ password: z.string().min(1), code: z.string().trim().min(6).max(10) }),
      req.body
    );
    const dbUser = await prisma.user.findUnique({ where: { id: me.id }, include: { mfa: true } });
    if (!dbUser || !(await verifyPassword(input.password, dbUser.passwordHash))) throw badRequest('Your current password is incorrect.');
    if (!dbUser.mfa) throw badRequest('Multi-factor authentication is not enabled.');

    const totpOk = (await verifyTotp({ token: input.code.replace(/\s/g, ''), secret: dbUser.mfa.secret })) as any;
    const totpValid = Boolean(totpOk?.valid);
    const codeHash = hashToken(input.code.trim().toUpperCase().replace(/[^A-Z0-9]/g, ''));
    const recoveryOk = Boolean(await prisma.recoveryCode.findFirst({ where: { userId: me.id, codeHash, usedAt: null } }));
    if (!totpValid && !recoveryOk) throw badRequest('That verification code is incorrect.');

    await prisma.$transaction([
      prisma.mfaSecret.delete({ where: { userId: me.id } }),
      prisma.recoveryCode.deleteMany({ where: { userId: me.id } }),
    ]);
    await audit({ orgId: me.orgId, userId: me.id, action: 'MFA_DISABLED', entity: 'User', entityId: me.id, req });
    return ok(res, { disabled: true });
  })
);

/** Active sessions for the current user (device management). */
router.get(
  '/sessions',
  requireAuth,
  asyncHandler(async (req, res) => {
    const me = (req as AuthedRequest).user;
    const sessions = await prisma.session.findMany({
      where: { userId: me.id, revokedAt: null },
      orderBy: { lastUsedAt: 'desc' },
      take: 25,
    });
    return ok(res, {
      sessions: sessions.map((s) => ({
        id: s.id,
        deviceName: s.deviceName || 'Unknown device',
        ip: s.ip,
        userAgent: s.userAgent,
        lastUsedAt: s.lastUsedAt,
        createdAt: s.createdAt,
        expiresAt: s.expiresAt,
        current: s.id === (req as AuthedRequest).sessionId,
      })),
    });
  })
);

router.post(
  '/sessions/:id/revoke',
  requireAuth,
  asyncHandler(async (req, res) => {
    const me = (req as AuthedRequest).user;
    await revokeSession(req.params.id, me.id);
    await audit({ orgId: me.orgId, userId: me.id, action: 'SESSION_REVOKED', entity: 'Session', entityId: req.params.id, req });
    return ok(res, { revoked: true });
  })
);

/** Log out every other device (keeps the current session). */
router.post(
  '/sessions/revoke-others',
  requireAuth,
  asyncHandler(async (req, res) => {
    const me = (req as AuthedRequest).user;
    const count = await revokeOtherSessions(me.id, (req as AuthedRequest).sessionId);
    await audit({ orgId: me.orgId, userId: me.id, action: 'SESSIONS_REVOKED_OTHERS', entity: 'User', entityId: me.id, metadata: { count }, req });
    return ok(res, { revoked: count });
  })
);

/** Recent sign-in attempts for the current user. */
router.get(
  '/login-history',
  requireAuth,
  asyncHandler(async (req, res) => {
    const me = (req as AuthedRequest).user;
    const rows = await prisma.loginHistory.findMany({
      where: { userId: me.id },
      orderBy: { createdAt: 'desc' },
      take: 25,
    });
    return ok(res, {
      history: rows.map((r) => ({
        success: r.success,
        reason: r.reason,
        ip: r.ip,
        userAgent: r.userAgent,
        newDevice: r.newDevice,
        createdAt: r.createdAt,
      })),
    });
  })
);

router.post(
  '/logout',
  requireAuth,
  asyncHandler(async (req, res) => {
    const me = (req as AuthedRequest).user;
    await revokeSession((req as AuthedRequest).sessionId, me.id);
    clearSessionCookie(res);
    return ok(res, { loggedOut: true });
  })
);

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const me = (req as AuthedRequest).user;
    const [dbUser, dbOrg] = await Promise.all([
      prisma.user.findUnique({ where: { id: me.id }, include: { mfa: true } }),
      prisma.organization.findUnique({ where: { id: me.orgId } }),
    ]);
    if (!dbUser || !dbOrg) throw unauthorized();
    // Return the current double-submit token (never rotate it mid-session — a
    // rotated cookie could invalidate a tab that already read the old one).
    const csrf = req.cookies?.[CSRF_COOKIE] || '';
    return ok(res, {
      user: {
        ...publicUser(dbUser),
        isSuperAdmin: isSuperAdminEmail(dbUser.email),
        teamId: dbUser.teamId,
        permissions: me.permissions,
        mfaEnabled: Boolean(dbUser.mfa),
      },
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

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

/** Change the password while signed in. Revokes every other session. */
router.post(
  '/change-password',
  requireAuth,
  asyncHandler(async (req, res) => {
    const me = (req as AuthedRequest).user;
    const input = validate(changePasswordSchema, req.body);
    const dbUser = await prisma.user.findUnique({ where: { id: me.id } });
    if (!dbUser || !(await verifyPassword(input.currentPassword, dbUser.passwordHash))) {
      throw badRequest('Your current password is incorrect.');
    }
    if (input.newPassword === input.currentPassword) {
      throw badRequest('New password must be different from the current one.');
    }
    await prisma.user.update({ where: { id: me.id }, data: { passwordHash: await hashPassword(input.newPassword) } });
    // Keep this session; sign out every other device.
    await revokeOtherSessions(me.id, (req as AuthedRequest).sessionId);
    await audit({ orgId: me.orgId, userId: me.id, action: 'PASSWORD_CHANGED', entity: 'User', entityId: me.id, req });
    return ok(res, { changed: true });
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
        subject: 'Reset your PRIMELEAD AI password',
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
    // Security: a password change revokes every existing session.
    await revokeAllSessions(row.userId);
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
            subject: `You've been added to ${orgName} on PRIMELEAD AI`,
            html: layoutMail(
              'You have been invited',
              `<p>You've been added as a salesperson to <strong>${orgName}</strong> on PRIMELEAD AI.</p>
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
