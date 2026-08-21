/**
 * Signals — intent signals and company signals.
 *  - GET    /intent          list intent signals
 *  - POST   /intent          record intent
 *  - GET    /intent/:companyId   company intent summary
 *  - GET    /company         list company signals
 *  - POST   /company         record company signal
 *  - DELETE /company/:id     remove signal
 */
import { Router } from 'express';
import { asyncHandler, ok, validate } from '../lib/http';
import { requireAuth, requirePermission, type AuthedRequest } from '../middleware/auth';
import { recordIntent, getIntentSignals, getCompanyIntentSummary, recordCompanySignal, getCompanySignals, getAllSignals, deleteSignal } from '../services/intent';
import { z } from 'zod';

const router = Router();
router.use(requireAuth);

// ── Intent Signals ──────────────────────────────────────────

router.get('/intent', requirePermission('contacts.view'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const q = req.query as Record<string, string>;
  const signals = await getIntentSignals(user.orgId, {
    companyId: q.companyId,
    contactId: q.contactId,
    type: q.type,
  });
  return ok(res, { signals });
}));

router.post('/intent', requirePermission('contacts.edit'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const input = validate(intentCreateSchema, req.body);
  const signal = await recordIntent({ orgId: user.orgId, ...input });
  return ok(res, { signal }, 201);
}));

router.get('/intent/:companyId', requirePermission('contacts.view'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const summary = await getCompanyIntentSummary(user.orgId, req.params.companyId);
  return ok(res, { summary });
}));

// ── Company Signals ─────────────────────────────────────────

router.get('/company', requirePermission('contacts.view'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const q = req.query as Record<string, string>;
  const signals = await getAllSignals(user.orgId, {
    type: q.type,
    days: q.days ? Number(q.days) : undefined,
  });
  return ok(res, { signals });
}));

router.post('/company', requirePermission('contacts.edit'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const input = validate(signalCreateSchema, req.body);
  const signal = await recordCompanySignal({ orgId: user.orgId, ...input });
  return ok(res, { signal }, 201);
}));

router.get('/company/:companyId', requirePermission('contacts.view'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const signals = await getCompanySignals(user.orgId, req.params.companyId);
  return ok(res, { signals });
}));

router.delete('/company/:id', requirePermission('contacts.edit'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const result = await deleteSignal(req.params.id, user.orgId);
  return ok(res, result);
}));

const intentCreateSchema = z.object({
  companyId: z.string().optional().nullable(),
  contactId: z.string().optional().nullable(),
  type: z.enum(['SEARCH', 'CONTENT_ENGAGEMENT', 'WEBSITE_VISIT', 'HIRING', 'FUNDING', 'TECH_CHANGE', 'COMPETITOR_INTEREST']),
  topic: z.string().max(200).optional().nullable(),
  source: z.string().min(1).max(100),
  confidence: z.coerce.number().min(0).max(1).optional(),
  metadata: z.record(z.unknown()).optional().nullable(),
});

const signalCreateSchema = z.object({
  companyId: z.string().min(1),
  type: z.enum(['FUNDING', 'HIRING', 'LEADERSHIP_CHANGE', 'TECH_CHANGE', 'GROWTH', 'EXPANSION', 'NEWS', 'JOB_POSTING']),
  title: z.string().trim().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  source: z.string().min(1).max(100),
  confidence: z.coerce.number().min(0).max(1).optional(),
  evidence: z.array(z.record(z.unknown())).max(20).optional().nullable(),
  metadata: z.record(z.unknown()).optional().nullable(),
});

export default router;
