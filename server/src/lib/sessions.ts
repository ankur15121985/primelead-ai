/**
 * Database-backed sessions (revocable).
 *
 * The client holds an opaque random token in an httpOnly cookie; the server
 * stores only its SHA-256 hash plus metadata. Sessions can be revoked
 * individually (device management) or wholesale (logout everywhere, password
 * reset), which JWT-only sessions cannot do.
 */
import crypto from 'crypto';
import { prisma } from './prisma';
import { config } from '../config';

export interface SessionMeta {
  ip?: string;
  userAgent?: string;
  deviceName?: string;
}

export function hashSessionToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function createSession(userId: string, meta: SessionMeta = {}): Promise<{ token: string; id: string }> {
  const raw = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + config.sessionMaxAgeDays * 24 * 60 * 60 * 1000);
  const row = await prisma.session.create({
    data: {
      userId,
      tokenHash: hashSessionToken(raw),
      ip: meta.ip ? meta.ip.slice(0, 45) : null,
      userAgent: meta.userAgent ? meta.userAgent.slice(0, 300) : null,
      deviceName: meta.deviceName ? meta.deviceName.slice(0, 80) : null,
      expiresAt,
    },
  });
  return { token: raw, id: row.id };
}

/** Resolve a raw cookie token to its session (includes user + org). */
export async function resolveSession(raw: string | undefined | null) {
  if (!raw) return null;
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashSessionToken(raw) },
    include: { user: { include: { org: true } } },
  });
  if (!session || session.revokedAt || session.expiresAt < new Date()) return null;
  return session;
}

/** Refresh lastUsedAt at most once per minute so reads stay cheap. */
export async function touchSession(id: string): Promise<void> {
  await prisma.session.updateMany({
    where: { id, lastUsedAt: { lt: new Date(Date.now() - 60 * 1000) } },
    data: { lastUsedAt: new Date() },
  });
}

export async function revokeSession(id: string, userId: string): Promise<void> {
  await prisma.session.updateMany({ where: { id, userId, revokedAt: null }, data: { revokedAt: new Date() } });
}

export async function revokeOtherSessions(userId: string, keepId: string): Promise<number> {
  const res = await prisma.session.updateMany({
    where: { userId, id: { not: keepId }, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return res.count;
}

export async function revokeAllSessions(userId: string): Promise<void> {
  await prisma.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
}
