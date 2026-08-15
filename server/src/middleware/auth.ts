import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { ApiError, forbidden, unauthorized } from '../lib/http';
import { verifySession } from '../lib/jwt';
import { isSuperAdminEmail } from './admin';

export interface AuthedRequest extends Request {
  user: {
    id: string;
    orgId: string;
    role: string;
    name: string;
    email: string;
  };
}

/** Require a valid session; loads the fresh user + org from DB (authorization never trusts the token alone). */
export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.[process.env.SESSION_COOKIE_NAME || 'lf_session'];
    const payload = token ? verifySession(token) : null;
    if (!payload) throw unauthorized();

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: { org: true },
    });
    if (!user || !user.active) throw unauthorized('Your account is not active.');
    // Super-admins always keep access, even if their own org is suspended,
    // so the website handler can never lock themselves out of the admin panel.
    if (user.org.status !== 'ACTIVE' && !isSuperAdminEmail(user.email)) {
      throw forbidden('This organization account is not active.');
    }

    // Hard org isolation: the org comes from the session, never from the client.
    (req as AuthedRequest).user = {
      id: user.id,
      orgId: user.orgId,
      role: user.role,
      name: user.name,
      email: user.email,
    };
    next();
  } catch (err) {
    next(err);
  }
}

/** Require one of the given roles. */
export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const user = (req as AuthedRequest).user;
    if (!user) return next(unauthorized());
    if (!roles.includes(user.role)) return next(forbidden());
    next();
  };
}

export function isManagerOrAbove(user: { role: string }): boolean {
  return ['OWNER', 'ADMIN', 'MANAGER'].includes(user.role);
}

export function isAdminOrAbove(user: { role: string }): boolean {
  return ['OWNER', 'ADMIN'].includes(user.role);
}

export const assertManagerOrAbove = (user: { role: string }) => {
  if (!isManagerOrAbove(user)) throw forbidden();
};

export const assertAdminOrAbove = (user: { role: string }) => {
  if (!isAdminOrAbove(user)) throw forbidden();
};

/** Salespeople see only their own leads; managers/admins see everything (configurable per org later). */
export function scopedWhere(user: { role: string; id: string }, orgId: string) {
  return user.role === 'SALES' ? { orgId, ownerId: user.id } : { orgId };
}

export function assertNotFound<T>(value: T | null): T {
  if (!value) throw new ApiError(404, 'NOT_FOUND', 'Not found');
  return value;
}
