/**
 * Conversation Intelligence — analysis, coaching, contact insights.
 *  - GET    /          list analyses
 *  - POST   /          create analysis
 *  - GET    /:id       one analysis
 *  - DELETE /:id       remove
 *  - GET    /contact/:contactId   contact intelligence summary
 *  - GET    /coaching/:userId     sales coaching insights
 */
import { Router } from 'express';
import { asyncHandler, ok, validate } from '../lib/http';
import { requireAuth, requirePermission, type AuthedRequest } from '../middleware/auth';
import { createAnalysis, getAnalysis, listAnalyses, deleteAnalysis, getContactIntelligence, getCoachingInsights } from '../services/intelligence';
import { z } from 'zod';

const router = Router();
router.use(requireAuth);

router.get('/', requirePermission('contacts.view'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const q = req.query as Record<string, string>;
  const analyses = await listAnalyses(user.orgId, {
    callId: q.callId,
    meetingId: q.meetingId,
    contactId: q.contactId,
    companyId: q.companyId,
    type: q.type,
  });
  return ok(res, { analyses });
}));

router.post('/', requirePermission('contacts.edit'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const input = validate(analysisCreateSchema, req.body);
  const analysis = await createAnalysis({ orgId: user.orgId, ...input });
  return ok(res, { analysis }, 201);
}));

router.get('/contact/:contactId', requirePermission('contacts.view'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const intel = await getContactIntelligence(user.orgId, req.params.contactId);
  return ok(res, { intelligence: intel });
}));

router.get('/coaching/:userId', requirePermission('contacts.view'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const insights = await getCoachingInsights(user.orgId, req.params.userId);
  return ok(res, { insights });
}));

router.get('/:id', requirePermission('contacts.view'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const analysis = await getAnalysis(req.params.id, user.orgId);
  return ok(res, { analysis });
}));

router.delete('/:id', requirePermission('contacts.edit'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const result = await deleteAnalysis(req.params.id, user.orgId);
  return ok(res, result);
}));

const analysisCreateSchema = z.object({
  callId: z.string().optional().nullable(),
  meetingId: z.string().optional().nullable(),
  contactId: z.string().optional().nullable(),
  companyId: z.string().optional().nullable(),
  type: z.enum(['CALL_SUMMARY', 'MEETING_SUMMARY', 'TOPIC_ANALYSIS', 'OBJECTION_TRACKING', 'SENTIMENT']),
  summary: z.string().max(5000).optional().nullable(),
  topics: z.array(z.string().max(100)).max(20).optional().nullable(),
  objections: z.array(z.object({
    objection: z.string().max(300),
    response: z.string().max(500).optional(),
    resolved: z.boolean().optional(),
  })).max(20).optional().nullable(),
  competitors: z.array(z.string().max(100)).max(10).optional().nullable(),
  pricingDiscussed: z.boolean().optional(),
  buyingSignals: z.array(z.string().max(200)).max(20).optional().nullable(),
  nextSteps: z.array(z.string().max(200)).max(10).optional().nullable(),
  sentiment: z.enum(['POSITIVE', 'NEUTRAL', 'NEGATIVE']).optional().nullable(),
  riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional().nullable(),
  sentimentScore: z.coerce.number().min(-1).max(1).optional().nullable(),
  metadata: z.record(z.unknown()).optional().nullable(),
});

export default router;
