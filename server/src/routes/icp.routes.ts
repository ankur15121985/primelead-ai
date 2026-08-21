/**
 * ICP Builder — org-scoped Ideal Customer Profiles.
 *  - GET    /          list all ICPs
 *  - POST   /          create
 *  - GET    /:id       one ICP
 *  - PATCH  /:id       update
 *  - DELETE /:id       remove
 *  - POST   /:id/match-count   calculate matching companies
 */
import { Router } from 'express';
import { asyncHandler, ok, validate } from '../lib/http';
import { requireAuth, requirePermission, type AuthedRequest } from '../middleware/auth';
import { createIcp, updateIcp, deleteIcp, listIcps, getIcp, getIcpMatchCount } from '../services/icp';
import { z } from 'zod';

const router = Router();
router.use(requireAuth);

router.get('/', requirePermission('contacts.view'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const icps = await listIcps(user.orgId);
  return ok(res, { icps });
}));

router.post('/', requirePermission('contacts.create'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const input = validate(icpCreateSchema, req.body);
  const icp = await createIcp({ orgId: user.orgId, ...input });
  return ok(res, { icp }, 201);
}));

router.get('/:id', requirePermission('contacts.view'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const icp = await getIcp(req.params.id, user.orgId);
  return ok(res, { icp });
}));

router.patch('/:id', requirePermission('contacts.edit'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const input = validate(icpUpdateSchema, req.body);
  const icp = await updateIcp(req.params.id, user.orgId, input);
  return ok(res, { icp });
}));

router.delete('/:id', requirePermission('contacts.delete'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const result = await deleteIcp(req.params.id, user.orgId);
  return ok(res, result);
}));

router.post('/:id/match-count', requirePermission('contacts.view'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const result = await getIcpMatchCount(user.orgId, req.params.id);
  return ok(res, { count: result.count, icp: result.icp });
}));

const icpCreateSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  description: z.string().max(1000).optional().nullable(),
  industries: z.array(z.string().max(100)).max(20).optional().nullable(),
  subIndustries: z.array(z.string().max(100)).max(20).optional().nullable(),
  employeeRanges: z.array(z.string().max(20)).max(10).optional().nullable(),
  revenueRanges: z.array(z.string().max(20)).max(10).optional().nullable(),
  countries: z.array(z.string().max(100)).max(20).optional().nullable(),
  states: z.array(z.string().max(100)).max(50).optional().nullable(),
  cities: z.array(z.string().max(100)).max(50).optional().nullable(),
  companyTypes: z.array(z.string().max(30)).max(10).optional().nullable(),
  technologies: z.array(z.string().max(100)).max(30).optional().nullable(),
  fundingRanges: z.array(z.string().max(20)).max(10).optional().nullable(),
  foundedAfter: z.coerce.number().int().min(1800).max(2100).optional().nullable(),
  foundedBefore: z.coerce.number().int().min(1800).max(2100).optional().nullable(),
  jobTitles: z.array(z.string().max(100)).max(30).optional().nullable(),
  seniorities: z.array(z.string().max(30)).max(10).optional().nullable(),
  departments: z.array(z.string().max(50)).max(10).optional().nullable(),
  buyingSignals: z.array(z.string().max(200)).max(20).optional().nullable(),
  painPoints: z.array(z.string().max(200)).max(20).optional().nullable(),
  keywords: z.array(z.string().max(100)).max(30).optional().nullable(),
});

const icpUpdateSchema = icpCreateSchema.partial();

export default router;
