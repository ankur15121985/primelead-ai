/**
 * Lightweight CSRF protection using the double-submit-cookie pattern.
 *
 * On any state-changing request the client must send the token that was
 * issued as a readable (non-httpOnly) cookie in a `x-csrf-token` header.
 * Combined with SameSite=Lax session cookies this blocks cross-site requests
 * while keeping the API simple for same-origin SPA usage.
 */
import type { NextFunction, Request, Response } from 'express';
import { randomToken } from '../lib/crypto';

const COOKIE = 'pl_csrf';
const HEADER = 'x-csrf-token';

export function issueCsrf(res: Response) {
  const token = randomToken(16);
  res.cookie(COOKIE, token, {
    httpOnly: false,
    sameSite: 'lax',
    secure: process.env.COOKIE_SECURE === 'true',
    maxAge: 24 * 60 * 60 * 1000,
    path: '/',
  });
  return token;
}

/** Ensure every visitor has a CSRF cookie (issued on first request). */
export function ensureCsrfCookie(req: Request, res: Response, next: NextFunction) {
  if (!req.cookies?.[COOKIE]) {
    issueCsrf(res);
  }
  next();
}

export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const cookieToken = req.cookies?.[COOKIE];
  const headerToken = req.headers[HEADER];
  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return res.status(403).json({
      error: {
        code: 'CSRF',
        message: 'Your session security token is missing or invalid. Please refresh the page.',
        requestId: (res as any).locals?.requestId || '',
      },
    });
  }
  next();
}

export { COOKIE as CSRF_COOKIE, HEADER as CSRF_HEADER };
