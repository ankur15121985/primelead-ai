/**
 * Personas — buyer persona builder for targeting specific roles.
 *  - GET    /          list all personas
 *  - POST   /          create
 *  - GET    /:id       one persona
 *  - PATCH  /:id       update
 *  - DELETE /:id       remove
 *  - POST   /:id/match-count   calculate matching contacts
 */
import { Router } from 'express';
import { asyncHandler, ok, validate } from '../lib/http';
import { requireAuth, requirePermission, type AuthedRequest } from '../middleware/auth';
import { createPersona, updatePersona, deletePersona, listPersonas, getPersona, getPersonaMatchCount } from '../services/persona';
import { z } from 'zod';

const router = Router();
router.use(requireAuth);

router.get('/', requirePermission('contacts.view'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const personas = await listPersonas(user.orgId);
  return ok(res, { personas });
}));

router.post('/', requirePermission('contacts.create'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const input = validate(personaCreateSchema, req.body);
  const persona = await createPersona({ orgId: user.orgId, ...input });
  return ok(res, { persona }, 201);
}));

router.get('/:id', requirePermission('contacts.view'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const persona = await getPersona(req.params.id, user.orgId);
  return ok(res, { persona });
}));

router.patch('/:id', requirePermission('contacts.edit'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const input = validate(personaUpdateSchema, req.body);
  const persona = await updatePersona(req.params.id, user.orgId, input);
  return ok(res, { persona });
}));

router.delete('/:id', requirePermission('contacts.delete'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const result = await deletePersona(req.params.id, user.orgId);
  return ok(res, result);
}));

router.post('/:id/match-count', requirePermission('contacts.view'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const result = await getPersonaMatchCount(user.orgId, req.params.id);
  return ok(res, { count: result.count, persona: result.persona });
}));

const personaCreateSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  description: z.string().max(1000).optional().nullable(),
  jobTitles: z.array(z.string().max(100)).max(30).optional().nullable(),
  seniorities: z.array(z.string().max(30)).max(10).optional().nullable(),
  departments: z.array(z.string().max(50)).max(10).optional().nullable(),
  industries: z.array(z.string().max(100)).max(20).optional().nullable(),
  companySizes: z.array(z.string().max(20)).max(10).optional().nullable(),
  locations: z.array(z.string().max(100)).max(20).optional().nullable(),
  painPoints: z.array(z.string().max(200)).max(20).optional().nullable(),
  goals: z.array(z.string().max(200)).max(20).optional().nullable(),
  objections: z.array(z.string().max(200)).max(20).optional().nullable(),
  messagingTips: z.array(z.string().max(300)).max(20).optional().nullable(),
  valuePropositions: z.array(z.string().max(300)).max(10).optional().nullable(),
  preferredChannels: z.array(z.string().max(30)).max(10).optional().nullable(),
  bestApproach: z.string().max(1000).optional().nullable(),
});

const personaUpdateSchema = personaCreateSchema.partial();

export default router;
