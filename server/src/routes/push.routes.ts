/**
 * Push Notification routes.
 *
 * GET  /api/push/vapid-key    — returns the org's VAPID public key
 * POST /api/push/subscribe     — save a push subscription
 * POST /api/push/unsubscribe   — remove a push subscription
 * GET  /api/push/status        — check if push is enabled + subscription count
 * POST /api/push/send          — send push to a specific user (manager+)
 * POST /api/push/broadcast     — send push to all org subscribers (admin+)
 */
import { Router } from 'express';
import { asyncHandler, badRequest, ok } from '../lib/http';
import { requireAuth, requirePermission, type AuthedRequest } from '../middleware/auth';
import { getVapidPublicKey, saveSubscription, removeSubscription, getUserSubscriptions, sendPushToUser, broadcastPush, isPushEnabled } from '../services/push-notifications';

const router = Router();

/** GET /api/push/vapid-key — returns the public VAPID key for client subscription. */
router.get(
  '/vapid-key',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const publicKey = await getVapidPublicKey(user.orgId);
    return ok(res, { publicKey, enabled: true });
  })
);

/** POST /api/push/subscribe — save a browser push subscription. */
router.post(
  '/subscribe',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const { endpoint, keys, userAgent } = req.body;

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      throw badRequest('Missing subscription endpoint or keys');
    }

    const result = await saveSubscription(user.orgId, {
      endpoint,
      keys: { p256dh: keys.p256dh, auth: keys.auth },
      userId: user.id,
      userAgent: userAgent || req.headers['user-agent'] || undefined,
    });

    return ok(res, { success: true, subscriptionCount: result.subscriptionCount });
  })
);

/** POST /api/push/unsubscribe — remove a push subscription. */
router.post(
  '/unsubscribe',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const { endpoint } = req.body;

    if (!endpoint) throw badRequest('Missing subscription endpoint');

    const result = await removeSubscription(user.orgId, user.id, endpoint);
    return ok(res, { success: true, subscriptionCount: result.subscriptionCount });
  })
);

/** GET /api/push/status — check push status + subscription count. */
router.get(
  '/status',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const [enabled, subscriptions] = await Promise.all([
      isPushEnabled(user.orgId),
      getUserSubscriptions(user.orgId, user.id),
    ]);

    return ok(res, {
      enabled,
      subscriptionCount: subscriptions.length,
      subscriptions: subscriptions.map((s) => ({
        userAgent: s.userAgent,
        createdAt: s.createdAt,
      })),
    });
  })
);

/** POST /api/push/send — send push notification to a specific user (manager+). */
router.post(
  '/send',
  requireAuth,
  requirePermission('inbox.send'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const { userId, title, body, icon, badge, url, data } = req.body;

    if (!userId || !title || !body) {
      throw badRequest('Missing userId, title, or body');
    }

    const result = await sendPushToUser(user.orgId, userId, { title, body, icon, badge, url, data });
    return ok(res, result);
  })
);

/** POST /api/push/broadcast — broadcast push to all org subscribers (admin+). */
router.post(
  '/broadcast',
  requireAuth,
  requirePermission('settings.manage'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const { title, body, icon, badge, url, data } = req.body;

    if (!title || !body) throw badRequest('Missing title or body');

    const result = await broadcastPush(user.orgId, { title, body, icon, badge, url, data });
    return ok(res, result);
  })
);

export default router;
