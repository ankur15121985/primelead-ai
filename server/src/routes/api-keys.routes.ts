/**
 * Phase 14 — API key management routes.
 *
 * POST   /api/api-keys              — create key (shown once)
 * GET    /api/api-keys              — list keys (secrets hidden)
 * DELETE /api/api-keys/:id          — revoke key
 * POST   /api/api-keys/:id/rotate   — rotate key (returns new, revokes old)
 * POST   /api/api-keys/validate     — validate a key (for internal/middleware use)
 */
import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, badRequest, ok, validate } from '../lib/http';
import { requireAuth, requirePermission, type AuthedRequest } from '../middleware/auth';
import { audit } from '../lib/audit';
import {
  createApiKey,
  listApiKeys,
  revokeApiKey,
  rotateApiKey,
  validateApiKey,
} from '../services/api-keys';

const router = Router();
router.use(requireAuth);

const createSchema = z.object({
  name: z.string().min(1).max(100),
  scopes: z.array(z.string()).min(1),
  rateLimit: z.number().int().min(1).max(10000).optional(),
  expiresAt: z.string().datetime().optional(),
});

router.get('/', requirePermission('integrations.manage'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const keys = await listApiKeys(user.orgId);
  return ok(res, { keys });
}));

router.post('/', requirePermission('integrations.manage'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const input = validate(createSchema, req.body);
  const { apiKey, key } = await createApiKey(user.orgId, user.id, {
    ...input,
    expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
  });
  await audit({
    orgId: user.orgId,
    userId: user.id,
    action: 'API_KEY_CREATED',
    entity: 'ApiKey',
    entityId: apiKey.id,
    metadata: { name: input.name, scopes: input.scopes },
    req,
  });
  // Key is shown ONCE — the caller must save it
  return ok(res, {
    key,
    apiKey: {
      id: apiKey.id,
      name: apiKey.name,
      keyPrefix: apiKey.keyPrefix,
      scopes: apiKey.scopes,
      createdAt: apiKey.createdAt,
    },
    message: 'Save this key now. It will not be shown again.',
  }, 201);
}));

router.delete('/:id', requirePermission('integrations.manage'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  await revokeApiKey(user.orgId, req.params.id, 'Manual revocation');
  await audit({
    orgId: user.orgId,
    userId: user.id,
    action: 'API_KEY_REVOKED',
    entity: 'ApiKey',
    entityId: req.params.id,
    req,
  });
  return ok(res, { revoked: true });
}));

router.post('/:id/rotate', requirePermission('integrations.manage'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const { apiKey, key } = await rotateApiKey(user.orgId, user.id, req.params.id);
  await audit({
    orgId: user.orgId,
    userId: user.id,
    action: 'API_KEY_ROTATED',
    entity: 'ApiKey',
    entityId: apiKey.id,
    req,
  });
  return ok(res, {
    key,
    apiKey: {
      id: apiKey.id,
      name: apiKey.name,
      keyPrefix: apiKey.keyPrefix,
      scopes: apiKey.scopes,
      createdAt: apiKey.createdAt,
    },
    message: 'Save this key now. It will not be shown again.',
  });
}));

router.post('/validate', asyncHandler(async (req, res) => {
  const { key } = req.body as { key?: string };
  if (!key) throw badRequest('key is required.');
  const result = await validateApiKey(key);
  if (!result) throw badRequest('Invalid or expired API key.');
  return ok(res, { valid: true, orgId: result.orgId, scopes: result.scopes });
}));

export default router;
