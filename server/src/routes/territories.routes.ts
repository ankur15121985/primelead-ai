/**
 * Phase 17 — Territory & Account Ownership routes.
 *
 * Territories: CRUD + matching
 * Ownership: assign, transfer, history, unowned entities
 */
import { Router } from 'express';
import { requireAuth, requirePermission, type AuthedRequest } from '../middleware/auth';
import { asyncHandler, notFound, ok, validate } from '../lib/http';
import {
  createTerritory, getTerritories, getTerritory, updateTerritory, deleteTerritory,
  assignOwnership, transferOwnership, getOwnershipHistory, getOwnerAccounts, getUnownedEntities,
} from '../services/territories';
import { z } from 'zod';

const router = Router();
router.use(requireAuth);

/* ── Territory CRUD ─────────────────────────────────────────── */

router.get('/', requirePermission('contacts.view'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const territories = await getTerritories(user.orgId);
  return ok(res, { territories });
}));

router.get('/:id', requirePermission('contacts.view'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const territory = await getTerritory(user.orgId, req.params.id);
  if (!territory) throw notFound('Territory not found');
  return ok(res, { territory });
}));

router.post('/', requirePermission('users.manage'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const input = validate(territorySchema, req.body);
  const territory = await createTerritory(user.orgId, input);
  return ok(res, { territory }, 201);
}));

router.patch('/:id', requirePermission('users.manage'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const input = validate(territorySchema.partial(), req.body);
  const territory = await updateTerritory(user.orgId, req.params.id, input);
  return ok(res, { territory });
}));

router.delete('/:id', requirePermission('users.manage'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  await deleteTerritory(user.orgId, req.params.id);
  return ok(res, { deleted: true });
}));

/* ── Account Ownership ──────────────────────────────────────── */

router.post('/ownership/assign', requirePermission('contacts.edit'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const input = validate(ownershipSchema, req.body);
  const ownership = await assignOwnership(user.orgId, user.id, input);
  return ok(res, { ownership }, 201);
}));

router.post('/ownership/:id/transfer', requirePermission('contacts.edit'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const input = validate(z.object({ newOwnerId: z.string().min(1), reason: z.string().optional() }), req.body);
  const ownership = await transferOwnership(user.orgId, user.id, req.params.id, input.newOwnerId, input.reason);
  return ok(res, { ownership });
}));

router.get('/ownership/history/:entityType/:entityId', requirePermission('contacts.view'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const history = await getOwnershipHistory(user.orgId, req.params.entityType, req.params.entityId);
  return ok(res, { history });
}));

router.get('/ownership/my', requirePermission('contacts.view'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const accounts = await getOwnerAccounts(user.orgId, user.id);
  return ok(res, { accounts });
}));

router.get('/ownership/unowned/:entityType', requirePermission('contacts.view'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const entities = await getUnownedEntities(user.orgId, req.params.entityType);
  return ok(res, { entities });
}));

/* ── Schemas ────────────────────────────────────────────────── */

const territorySchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().max(500).optional(),
  countries: z.array(z.string()).optional(),
  states: z.array(z.string()).optional(),
  cities: z.array(z.string()).optional(),
  zipCodes: z.array(z.string()).optional(),
  industries: z.array(z.string()).optional(),
  employeeRanges: z.array(z.string()).optional(),
  ownerId: z.string().optional(),
  teamId: z.string().optional(),
});

const ownershipSchema = z.object({
  entityType: z.enum(['COMPANY', 'LEAD', 'CONTACT']),
  entityId: z.string().min(1),
  ownerId: z.string().min(1),
  coOwnerId: z.string().optional(),
  territoryId: z.string().optional(),
  changeReason: z.string().max(500).optional(),
});

export default router;
