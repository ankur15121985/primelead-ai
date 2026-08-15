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
