import type { NextFunction, Request, Response } from 'express';
import { forbidden } from '../lib/http';
import { config } from '../config';
import type { AuthedRequest } from './auth';

/**
 * Super-admin gate for the /api/admin dashboard.
 *
 * Must run AFTER requireAuth. Only users whose email is listed in the
 * SUPER_ADMIN_EMAILS env var (website handler / developer) may access.
 * If the list is empty the admin dashboard is effectively disabled (403),
 * which is the safe default for production.
 */
export function requireSuperAdmin(req: Request, _res: Response, next: NextFunction) {
  const user = (req as AuthedRequest).user;
  if (!user) return next(forbidden());
  if (!config.superAdminEmails.includes(user.email.toLowerCase())) {
    return next(forbidden('This area is restricted to the website administrator.'));
  }
  next();
}

/** Whether the current authenticated user is a super-admin (for UI hints). */
export function isSuperAdminEmail(email: string): boolean {
  return config.superAdminEmails.includes(email.toLowerCase());
}
