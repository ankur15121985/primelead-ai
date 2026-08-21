import { Router } from 'express';
import { asyncHandler, ok, validate } from '../lib/http';
import { requireAuth, requirePermission, type AuthedRequest } from '../middleware/auth';
import { z } from 'zod';
import { detectLeadDuplicates, mergeLeads, mergeContacts, mergeCompanies } from '../services/duplicates';

const router = Router();

router.get(
  '/',
  requireAuth,
  requirePermission('leads.view'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const duplicates = await detectLeadDuplicates(user.orgId);
    return ok(res, duplicates);
  })
);

const mergeSchema = z.object({
  winnerId: z.string().min(1),
  loserId: z.string().min(1),
});

router.post(
  '/merge/leads',
  requireAuth,
  requirePermission('leads.manage'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const input = validate(mergeSchema, req.body);
    const result = await mergeLeads(user.orgId, input.winnerId, input.loserId);
    return ok(res, result);
  })
);

router.post(
  '/merge/contacts',
  requireAuth,
  requirePermission('contacts.manage'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const input = validate(mergeSchema, req.body);
    const result = await mergeContacts(user.orgId, input.winnerId, input.loserId);
    return ok(res, result);
  })
);

router.post(
  '/merge/companies',
  requireAuth,
  requirePermission('companies.manage'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const input = validate(mergeSchema, req.body);
    const result = await mergeCompanies(user.orgId, input.winnerId, input.loserId);
    return ok(res, result);
  })
);

export default router;
