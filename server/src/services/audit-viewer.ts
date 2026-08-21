import { prisma } from '../lib/prisma';
import { Prisma } from '@prisma/client';

export interface AuditQuery {
  page?: number;
  limit?: number;
  action?: string;
  entity?: string;
  userId?: string;
  from?: string;
  to?: string;
}

/** Fetch paginated audit logs for an org. */
export async function getAuditLogs(orgId: string, query: AuditQuery) {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(100, Math.max(1, query.limit ?? 25));
  const skip = (page - 1) * limit;

  const where: Prisma.AuditLogWhereInput = { orgId };
  if (query.action) where.action = { contains: query.action };
  if (query.entity) where.entity = query.entity;
  if (query.userId) where.userId = query.userId;
  if (query.from || query.to) {
    where.createdAt = {};
    if (query.from) where.createdAt.gte = new Date(query.from);
    if (query.to) where.createdAt.lte = new Date(query.to);
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        // Join user name via raw query to avoid circular ref issues
      },
    }),
    prisma.auditLog.count({ where }),
  ]);

  // Enrich with user names
  const userIds = [...new Set(logs.map((l) => l.userId).filter(Boolean) as string[])];
  const users = userIds.length > 0
    ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } })
    : [];
  const userMap = new Map(users.map((u) => [u.id, u]));

  return {
    logs: logs.map((l) => ({
      ...l,
      userName: l.userId ? userMap.get(l.userId)?.name ?? 'Unknown' : 'System',
      userEmail: l.userId ? userMap.get(l.userId)?.email : null,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/** Get audit log summary stats for an org. */
export async function getAuditStats(orgId: string) {
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [total, last24h, lastWeek, topActions, topEntities, activeUsers] = await Promise.all([
    prisma.auditLog.count({ where: { orgId } }),
    prisma.auditLog.count({ where: { orgId, createdAt: { gte: dayAgo } } }),
    prisma.auditLog.count({ where: { orgId, createdAt: { gte: weekAgo } } }),
    prisma.auditLog.groupBy({ by: ['action'], where: { orgId }, _count: { _all: true } }),
    prisma.auditLog.groupBy({ by: ['entity'], where: { orgId, entity: { not: null } }, _count: { _all: true } }),
    prisma.auditLog.groupBy({ by: ['userId'], where: { orgId, userId: { not: null } }, _count: { _all: true } }),
  ]);

  // Enrich active users
  const uids = activeUsers.map((u) => u.userId).filter(Boolean) as string[];
  const userNames = uids.length > 0
    ? await prisma.user.findMany({ where: { id: { in: uids } }, select: { id: true, name: true } })
    : [];
  const nameMap = new Map(userNames.map((u) => [u.id, u.name]));

  const sortByCount = <T extends { _count: { _all: number } }>(arr: T[]) =>
    [...arr].sort((a, b) => b._count._all - a._count._all);

  return {
    total,
    last24h,
    lastWeek,
    topActions: sortByCount(topActions).slice(0, 10).map((a) => ({ action: a.action, count: a._count._all })),
    topEntities: sortByCount(topEntities).slice(0, 10).map((e) => ({ entity: e.entity, count: e._count._all })),
    activeUsers: sortByCount(activeUsers).slice(0, 10).map((u) => ({ userId: u.userId, name: nameMap.get(u.userId!) ?? 'Unknown', count: u._count._all })),
  };
}

/** Get login history for an org. */
export async function getLoginHistory(orgId: string, query: { page?: number; limit?: number; userId?: string; success?: string }) {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(100, Math.max(1, query.limit ?? 25));
  const skip = (page - 1) * limit;

  const where: Prisma.LoginHistoryWhereInput = {};
  if (orgId) where.orgId = orgId;
  if (query.userId) where.userId = query.userId;
  if (query.success !== undefined) where.success = query.success === 'true';

  const [logs, total] = await Promise.all([
    prisma.loginHistory.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.loginHistory.count({ where }),
  ]);

  return {
    logs,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

/** Get active sessions for a user. */
export async function getActiveSessions(userId: string) {
  return prisma.session.findMany({
    where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { lastUsedAt: 'desc' },
    select: {
      id: true,
      ip: true,
      userAgent: true,
      deviceName: true,
      lastUsedAt: true,
      createdAt: true,
    },
  });
}

/** Revoke a specific session. */
export async function revokeSession(userId: string, sessionId: string) {
  const session = await prisma.session.findFirst({ where: { id: sessionId, userId } });
  if (!session) throw Object.assign(new Error('Session not found.'), { status: 404 });
  if (session.revokedAt) throw Object.assign(new Error('Session already revoked.'), { status: 400 });

  return prisma.session.update({
    where: { id: sessionId },
    data: { revokedAt: new Date() },
  });
}

/** Revoke all sessions except the current one. */
export async function revokeAllSessions(userId: string, currentSessionId: string) {
  const result = await prisma.session.updateMany({
    where: { userId, revokedAt: null, id: { not: currentSessionId } },
    data: { revokedAt: new Date() },
  });
  return { revoked: result.count };
}
