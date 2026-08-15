import jwt from 'jsonwebtoken';
import { config } from '../config';

export interface SessionPayload {
  userId: string;
  orgId: string;
  role: string;
}

export function signSession(payload: SessionPayload): string {
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: `${config.sessionMaxAgeDays}d`,
  });
}

export function verifySession(token: string): SessionPayload | null {
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as SessionPayload;
    if (!decoded.userId || !decoded.orgId) return null;
    return decoded;
  } catch {
    return null;
  }
}

/** Short-lived token that proves the password step succeeded (MFA challenge). */
export function signMfaToken(userId: string): string {
  return jwt.sign({ userId, purpose: 'mfa' }, config.jwtSecret, {
    expiresIn: `${config.mfaTokenTtlMinutes}m`,
  });
}

export function verifyMfaToken(token: string): { userId: string } | null {
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as { userId?: string; purpose?: string };
    if (!decoded.userId || decoded.purpose !== 'mfa') return null;
    return { userId: decoded.userId };
  } catch {
    return null;
  }
}
