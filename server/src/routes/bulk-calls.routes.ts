/**
 * Bulk Calls Routes — initiate calls to multiple contacts at once.
 *
 * POST   /api/bulk-calls/initiate  — start bulk call batch
 * GET    /api/bulk-calls/history    — batch call history
 * GET    /api/bulk-calls/queue      — dialer queue (leads ready to call)
 */
import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, ok, validate } from '../lib/http';
import { requireAuth, requirePermission, type AuthedRequest } from '../middleware/auth';
import * as bulkCalls from '../services/bulk-calls';

const router = Router();

const initiateBulkSchema = z.object({
  leadIds: z.array(z.string()).min(1).max(50),
  fromNumber: z.string().optional(),
  script: z.string().max(2000).optional(),
  delayBetweenCalls: z.number().min(0).max(10000).optional(),
});

/**
 * POST /api/bulk-calls/initiate — start bulk call batch
 */
router.post(
  '/initiate',
  requireAuth,
  requirePermission('calls.edit'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const input = validate(initiateBulkSchema, req.body);
    const result = await bulkCalls.initiateBulkCalls({
      orgId: user.orgId,
      userId: user.id,
      ...input,
    });
    return ok(res, result, 201);
  })
);

/**
 * GET /api/bulk-calls/history — batch call history
 */
router.get(
  '/history',
  requireAuth,
  requirePermission('calls.view'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const { batchId } = req.query;
    const history = await bulkCalls.getBulkCallHistory(user.orgId, batchId as string);
    return ok(res, { history, total: history.length });
  })
);

/**
 * GET /api/bulk-calls/queue — dialer queue
 */
router.get(
  '/queue',
  requireAuth,
  requirePermission('calls.view'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const limit = parseInt(req.query.limit as string) || 20;
    const queue = await bulkCalls.getDialerQueue(user.orgId, { limit });
    return ok(res, { queue, total: queue.length });
  })
);

export default router;
