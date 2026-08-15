import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { ApiError, forbidden, unauthorized } from '../lib/http';
import { resolveSession, touchSession } from '../lib/sessions';
import { isSuperAdminEmail } from './admin';
import { rolePermissions } from '../services/rbac';
import { config } from '../config';

export interface AuthedRequest extends Request {
  user: {
    id: string;
    orgId: string;
    role: string;
    name: string;
    email: string;
    teamId: string | null;
    permissions: string[];
  };
  sessionId: string;
}

/**
 * Require a valid session; loads the fresh user + org + role permissions from
 * the database (authorization never trusts the token alone). Sessions are
 * revocable — a revoked or expired session row rejects the request.
 */
export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.[config.sessionCookieName];
    const session = await resolveSession(token);
    if (!session) throw unauthorized();

    const user = session.user;
    const org = user.org;
    if (!user.active) throw unauthorized('Your account is not active.');
    // Super-admins always keep access, even if their own org is suspended,
    // so the website handler can never lock themselves out of the admin panel.
    if (org.status !== 'ACTIVE' && !isSuperAdminEmail(user.email)) {
      throw forbidden('This organization account is not active.');
    }

    const permissions = await rolePermissions(user.orgId, user.role);

    // Hard org isolation: the org comes from the session, never from the client.
    (req as AuthedRequest).user = {
      id: user.id,
      orgId: user.orgId,
      role: user.role,
      name: user.name,
      email: user.email,
      teamId: user.teamId,
      permissions,
    };
    (req as AuthedRequest).sessionId = session.id;
    void touchSession(session.id);
    next();
  } catch (err) {
    next(err);
  }
}

/** Require one of the given roles (legacy hierarchy checks). */
export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const user = (req as AuthedRequest).user;
    if (!user) return next(unauthorized());
    if (!roles.includes(user.role)) return next(forbidden());
    next();
  };
}

/** Require ANY of the given granular permissions. */
export function requirePermission(...permissions: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const user = (req as AuthedRequest).user;
    if (!user) return next(unauthorized());
    if (!user.permissions.some((p) => permissions.includes(p))) return next(forbidden());
    next();
  };
}

/** Inline check for handlers that already have the user. */
export function hasPermission(user: { permissions?: string[] }, permission: string): boolean {
  return Boolean(user.permissions?.includes(permission));
}

export function assertPermission(user: { permissions?: string[] }, permission: string): void {
  if (!hasPermission(user, permission)) throw forbidden();
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
