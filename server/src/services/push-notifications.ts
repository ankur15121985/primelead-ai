/**
 * Push Notification Service — VAPID + Web Push.
 *
 * Uses web-push (npm) for the Web Push protocol (ECIES encryption + JWT auth).
 * VAPID keys are auto-generated on first use and stored in org settings.
 * Subscriptions are stored per-user so targeted notifications work.
 */
import webPush from 'web-push';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';

// ── VAPID Key Management ─────────────────────────────────

interface VapidKeys {
  publicKey: string;
  privateKey: string;
}

/** Generate a new VAPID key pair. */
function generateVapidKeys(): VapidKeys {
  const keyPair = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const privDER = keyPair.privateKey.export({ type: 'pkcs8', format: 'der' });
  const pubDER = keyPair.publicKey.export({ type: 'spki', format: 'der' });

  // Extract raw 32-byte private scalar and 65-byte public point
  const privRaw = privDER.subarray(privDER.length - 32);
  const pubRaw = pubDER.subarray(pubDER.length - 65);

  return {
    publicKey: `e=${Buffer.from(pubRaw).toString('base64url')}`,
    privateKey: `p=${Buffer.from(privRaw).toString('base64url')}`,
  };
}

/** Resolve the VAPID keys for an org, generating them on first use. */
async function getOrCreateVapidKeys(orgId: string): Promise<VapidKeys> {
  const setting = await prisma.orgSetting.findUnique({
    where: { orgId_key: { orgId, key: 'vapidKeys' } },
  });
  const cfg = (setting?.value as VapidKeys | null) || null;
  if (cfg?.publicKey && cfg.privateKey) return cfg;

  const keys = generateVapidKeys();
  await prisma.orgSetting.upsert({
    where: { orgId_key: { orgId, key: 'vapidKeys' } },
    create: { orgId, key: 'vapidKeys', value: keys as any },
    update: { value: keys as any },
  });
  return keys;
}

/** Get the public VAPID key (sent to the client for subscription). */
export async function getVapidPublicKey(orgId: string): Promise<string> {
  const keys = await getOrCreateVapidKeys(orgId);
  return keys.publicKey;
}

// ── Subscription Management ───────────────────────────────

const SUBSCRIPTION_MODEL = 'PushSubscription' as const;

export interface PushSubscriptionData {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  userId: string;
  userAgent?: string;
}

/**
 * Save or update a push subscription for a user.
 * Each user can have multiple subscriptions (different devices/browsers).
 */
export async function saveSubscription(orgId: string, data: PushSubscriptionData) {
  // Use OrgSetting as a lightweight subscription store (JSON array per user)
  // to avoid adding a Prisma model for subscriptions.
  const key = `pushSubscriptions:${data.userId}`;
  const existing = await prisma.orgSetting.findUnique({
    where: { orgId_key: { orgId, key } },
  });
  const subs = ((existing?.value as any) || []) as Array<{
    endpoint: string;
    keys: { p256dh: string; auth: string };
    userAgent?: string;
    createdAt: string;
  }>;

  // Upsert: replace if endpoint already exists
  const filtered = subs.filter((s) => s.endpoint !== data.endpoint);
  filtered.push({
    endpoint: data.endpoint,
    keys: data.keys,
    userAgent: data.userAgent || undefined,
    createdAt: new Date().toISOString(),
  });

  await prisma.orgSetting.upsert({
    where: { orgId_key: { orgId, key } },
    create: { orgId, key, value: filtered as any },
    update: { value: filtered as any },
  });

  return { subscriptionCount: filtered.length };
}

/** Remove a push subscription (e.g. on unsubscribe or expired). */
export async function removeSubscription(orgId: string, userId: string, endpoint: string) {
  const key = `pushSubscriptions:${userId}`;
  const existing = await prisma.orgSetting.findUnique({
    where: { orgId_key: { orgId, key } },
  });
  const subs = ((existing?.value as any) || []) as Array<{ endpoint: string }>;
  const filtered = subs.filter((s) => s.endpoint !== endpoint);

  await prisma.orgSetting.update({
    where: { orgId_key: { orgId, key } },
    data: { value: filtered as any },
  });

  return { subscriptionCount: filtered.length };
}

/** Get all push subscriptions for a user. */
export async function getUserSubscriptions(orgId: string, userId: string) {
  const key = `pushSubscriptions:${userId}`;
  const existing = await prisma.orgSetting.findUnique({
    where: { orgId_key: { orgId, key } },
  });
  return ((existing?.value as any) || []) as Array<{
    endpoint: string;
    keys: { p256dh: string; auth: string };
    userAgent?: string;
    createdAt: string;
  }>;
}

/** Get all subscriptions for an org (for broadcast). */
export async function getOrgSubscriptions(orgId: string) {
  const settings = await prisma.orgSetting.findMany({
    where: { orgId, key: { startsWith: 'pushSubscriptions:' } },
  });

  const allSubs: Array<{ userId: string; endpoint: string; keys: { p256dh: string; auth: string } }> = [];
  for (const s of settings) {
    const userId = s.key.replace('pushSubscriptions:', '');
    const subs = (s.value as any) || [];
    for (const sub of subs) {
      allSubs.push({ userId, endpoint: sub.endpoint, keys: sub.keys });
    }
  }
  return allSubs;
}

// ── Sending ───────────────────────────────────────────────

interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  url?: string;
  data?: Record<string, unknown>;
}

/**
 * Send a push notification to all subscriptions of a specific user.
 * Returns { sent, failed } counts.
 */
export async function sendPushToUser(orgId: string, userId: string, payload: PushPayload): Promise<{ sent: number; failed: number }> {
  const keys = await getOrCreateVapidKeys(orgId);
  const subscriptions = await getUserSubscriptions(orgId, userId);

  if (subscriptions.length === 0) return { sent: 0, failed: 0 };

  webPush.setVapidDetails(`mailto:${process.env.SMTP_FROM || 'admin@primelead.local'}`, keys.publicKey, keys.privateKey);

  let sent = 0;
  let failed = 0;
  const toRemove: string[] = [];

  for (const sub of subscriptions) {
    try {
      const subscription = {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
      };

      await webPush.sendNotification(subscription, JSON.stringify(payload));
      sent++;
    } catch (err: any) {
      // 404 = subscription expired, 410 = subscription gone — remove it
      if (err?.statusCode === 404 || err?.statusCode === 410) {
        toRemove.push(sub.endpoint);
      }
      failed++;
    }
  }

  // Clean up expired subscriptions
  for (const endpoint of toRemove) {
    await removeSubscription(orgId, userId, endpoint).catch(() => {});
  }

  return { sent, failed };
}

/**
 * Broadcast a push notification to all subscribers of an org.
 * Returns { total, sent, failed } counts.
 */
export async function broadcastPush(orgId: string, payload: PushPayload): Promise<{ total: number; sent: number; failed: number }> {
  const keys = await getOrCreateVapidKeys(orgId);
  const allSubs = await getOrgSubscriptions(orgId);

  if (allSubs.length === 0) return { total: 0, sent: 0, failed: 0 };

  webPush.setVapidDetails(`mailto:${process.env.SMTP_FROM || 'admin@primelead.local'}`, keys.publicKey, keys.privateKey);

  let sent = 0;
  let failed = 0;
  const toRemove: Array<{ userId: string; endpoint: string }> = [];

  for (const sub of allSubs) {
    try {
      const subscription = {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
      };

      await webPush.sendNotification(subscription, JSON.stringify(payload));
      sent++;
    } catch (err: any) {
      if (err?.statusCode === 404 || err?.statusCode === 410) {
        toRemove.push({ userId: sub.userId, endpoint: sub.endpoint });
      }
      failed++;
    }
  }

  // Clean up expired subscriptions
  for (const { userId, endpoint } of toRemove) {
    await removeSubscription(orgId, userId, endpoint).catch(() => {});
  }

  return { total: allSubs.length, sent, failed };
}

/** Check if push notifications are configured for an org. */
export async function isPushEnabled(orgId: string): Promise<boolean> {
  const setting = await prisma.orgSetting.findUnique({
    where: { orgId_key: { orgId, key: 'vapidKeys' } },
  });
  return Boolean(setting?.value);
}
