/**
 * Phase 14 — API key management + webhook platform.
 *
 * API keys are scoped, time-limited, and tracked for usage.
 * Webhooks support HMAC signatures, retries, and delivery logs.
 */
import crypto from 'crypto';
import { prisma } from '../lib/prisma';

/* ── API Keys ────────────────────────────────────────────────── */

const KEY_PREFIX = 'pk_live_';

export function generateApiKey(): { key: string; prefix: string; hash: string } {
  const random = crypto.randomBytes(32).toString('base64url');
  const key = `${KEY_PREFIX}${random}`;
  const prefix = key.slice(0, 12); // "pk_live_XXXX"
  const hash = crypto.createHash('sha256').update(key).digest('hex');
  return { key, prefix, hash };
}

export interface ApiKeyInput {
  name: string;
  scopes: string[];
  rateLimit?: number;
  expiresAt?: Date;
}

export async function createApiKey(orgId: string, userId: string, input: ApiKeyInput) {
  const { key, prefix, hash } = generateApiKey();

  const apiKey = await prisma.apiKey.create({
    data: {
      orgId,
      name: input.name,
      keyPrefix: prefix,
      keyHash: hash,
      scopes: input.scopes,
      rateLimit: input.rateLimit || null,
      expiresAt: input.expiresAt || null,
      createdBy: userId,
    },
  });

  return { apiKey, key }; // key shown ONCE
}

export async function listApiKeys(orgId: string) {
  return prisma.apiKey.findMany({
    where: { orgId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      scopes: true,
      rateLimit: true,
      isActive: true,
      lastUsedAt: true,
      lastUsedIp: true,
      totalRequests: true,
      expiresAt: true,
      revokedAt: true,
      createdAt: true,
    },
  });
}

export async function revokeApiKey(orgId: string, id: string, reason?: string) {
  return prisma.apiKey.update({
    where: { id },
    data: {
      isActive: false,
      revokedAt: new Date(),
      revokedReason: reason || null,
    },
  });
}

export async function rotateApiKey(orgId: string, userId: string, id: string) {
  const existing = await prisma.apiKey.findFirst({ where: { id, orgId } });
  if (!existing) throw Object.assign(new Error('API key not found.'), { status: 404 });

  // Revoke old
  await prisma.apiKey.update({
    where: { id },
    data: { isActive: false, revokedAt: new Date(), revokedReason: 'ROTATED' },
  });

  // Create new with same config
  return createApiKey(orgId, userId, {
    name: `${existing.name} (rotated)`,
    scopes: (existing.scopes as string[]) || [],
    rateLimit: existing.rateLimit || undefined,
    expiresAt: existing.expiresAt || undefined,
  });
}

export async function validateApiKey(key: string): Promise<{ orgId: string; scopes: string[] } | null> {
  if (!key.startsWith(KEY_PREFIX)) return null;
  const hash = crypto.createHash('sha256').update(key).digest('hex');
  const prefix = key.slice(0, 12);

  const apiKey = await prisma.apiKey.findFirst({
    where: { keyPrefix: prefix, keyHash: hash, isActive: true },
  });

  if (!apiKey) return null;

  // Check expiry
  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) return null;

  // Update usage stats (fire-and-forget)
  prisma.apiKey.update({
    where: { id: apiKey.id },
    data: {
      lastUsedAt: new Date(),
      totalRequests: { increment: 1 },
    },
  }).catch(() => {});

  return { orgId: apiKey.orgId, scopes: (apiKey.scopes as string[]) || [] };
}

/* ── Webhook Endpoints ───────────────────────────────────────── */

export interface WebhookEndpointInput {
  name: string;
  url: string;
  events: string[];
  retryPolicy?: string;
  maxRetries?: number;
  timeoutMs?: number;
  ipWhitelist?: string[];
  secret?: string;
}

export async function createWebhookEndpoint(orgId: string, input: WebhookEndpointInput) {
  const secret = input.secret || crypto.randomBytes(24).toString('hex');

  return prisma.webhookEndpoint.create({
    data: {
      orgId,
      name: input.name,
      url: input.url,
      secret,
      events: input.events,
      retryPolicy: input.retryPolicy || 'EXPONENTIAL',
      maxRetries: input.maxRetries ?? 3,
      timeoutMs: input.timeoutMs ?? 5000,
      ipWhitelist: input.ipWhitelist || undefined,
    },
  });
}

export async function listWebhookEndpoints(orgId: string) {
  return prisma.webhookEndpoint.findMany({
    where: { orgId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function updateWebhookEndpoint(orgId: string, id: string, data: Partial<WebhookEndpointInput & { isActive: boolean; status: string }>) {
  return prisma.webhookEndpoint.update({
    where: { id },
    data: {
      name: data.name || undefined,
      url: data.url || undefined,
      events: data.events || undefined,
      retryPolicy: data.retryPolicy || undefined,
      maxRetries: data.maxRetries ?? undefined,
      timeoutMs: data.timeoutMs ?? undefined,
      ipWhitelist: data.ipWhitelist || undefined,
      isActive: data.isActive ?? undefined,
      status: data.status || undefined,
    },
  });
}

export async function deleteWebhookEndpoint(orgId: string, id: string) {
  return prisma.webhookEndpoint.delete({ where: { id } });
}

/* ── Webhook Delivery ────────────────────────────────────────── */

export async function recordWebhookDelivery(
  endpointId: string,
  orgId: string,
  event: string,
  payload: unknown,
  data: {
    status: string;
    httpStatus?: number;
    responseBody?: string;
    attempt?: number;
    maxAttempts?: number;
    signature?: string;
    durationMs?: number;
    error?: string;
    nextRetryAt?: Date;
  }
) {
  return prisma.webhookDelivery.create({
    data: {
      orgId,
      endpointId,
      event,
      payload: payload as any,
      status: data.status,
      httpStatus: data.httpStatus || null,
      responseBody: data.responseBody || null,
      attempt: data.attempt || 1,
      maxAttempts: data.maxAttempts || 3,
      signature: data.signature || null,
      durationMs: data.durationMs || null,
      error: data.error || null,
      nextRetryAt: data.nextRetryAt || null,
    },
  });
}

export async function getWebhookDeliveries(orgId: string, endpointId?: string, event?: string) {
  return prisma.webhookDelivery.findMany({
    where: {
      orgId,
      ...(endpointId ? { endpointId } : {}),
      ...(event ? { event } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { endpoint: { select: { id: true, name: true, url: true } } },
  });
}

export async function getWebhookDeliveryStats(orgId: string) {
  const [total, byEvent, byStatus, recentFailures] = await Promise.all([
    prisma.webhookDelivery.count({ where: { orgId } }),
    prisma.webhookDelivery.groupBy({
      by: ['event'],
      where: { orgId },
      _count: { _all: true },
      orderBy: { _count: { event: 'desc' } },
      take: 10,
    }),
    prisma.webhookDelivery.groupBy({
      by: ['status'],
      where: { orgId },
      _count: { _all: true },
    }),
    prisma.webhookDelivery.findMany({
      where: { orgId, status: 'FAILED' },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { endpoint: { select: { id: true, name: true } } },
    }),
  ]);

  return {
    total,
    byEvent: byEvent.map((r) => ({ event: r.event, count: r._count._all })),
    byStatus: byStatus.map((r) => ({ status: r.status, count: r._count._all })),
    recentFailures,
  };
}
