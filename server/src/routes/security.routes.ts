import { Router } from 'express';
import { asyncHandler, ok, validate } from '../lib/http';
import { requireAuth, requirePermission, type AuthedRequest } from '../middleware/auth';
import { z } from 'zod';
import {
  getAuditLogs,
  getAuditStats,
  getLoginHistory,
  getActiveSessions,
  revokeSession,
  revokeAllSessions,
} from '../services/audit-viewer';

const router = Router();

// ── Audit Logs ────────────────────────────────────────────

router.get(
  '/audit-logs',
  requireAuth,
  requirePermission('settings.manage'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const { page, limit, action, entity, userId, from, to } = req.query as Record<string, string>;
    const result = await getAuditLogs(user.orgId, {
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
      action, entity, userId, from, to,
    });
    return ok(res, result);
  })
);

router.get(
  '/audit-logs/stats',
  requireAuth,
  requirePermission('settings.manage'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const stats = await getAuditStats(user.orgId);
    return ok(res, stats);
  })
);

// ── Login History ─────────────────────────────────────────

router.get(
  '/login-history',
  requireAuth,
  requirePermission('settings.manage'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const { page, limit, userId, success } = req.query as Record<string, string>;
    const result = await getLoginHistory(user.orgId, { page: page ? parseInt(page) : undefined, limit: limit ? parseInt(limit) : undefined, userId, success });
    return ok(res, result);
  })
);

// ── Session Management ────────────────────────────────────

router.get(
  '/sessions',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const sessions = await getActiveSessions(user.id);
    return ok(res, { sessions });
  })
);

router.post(
  '/sessions/:sessionId/revoke',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const result = await revokeSession(user.id, req.params.sessionId);
    return ok(res, { revoked: true, sessionId: result.id });
  })
);

router.post(
  '/sessions/revoke-all',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const sessionId = (req as AuthedRequest).sessionId ?? '';
    const result = await revokeAllSessions(user.id, sessionId);
    return ok(res, { revoked: result.revoked });
  })
);

export default router;
