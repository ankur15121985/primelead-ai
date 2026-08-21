/**
 * Calls — call logging and disposition tracking.
 *  - GET    /          list calls
 *  - POST   /          log a call
 *  - GET    /:id       one call
 *  - PATCH  /:id       update (disposition, notes, transcript)
 *  - DELETE /:id       remove
 *  - GET    /stats     call statistics
 */
import { Router } from 'express';
import { asyncHandler, ok, validate } from '../lib/http';
import { requireAuth, requirePermission, type AuthedRequest } from '../middleware/auth';
import { logCall, updateCall, getCall, listCalls, deleteCall, getCallStats } from '../services/calls';
import { z } from 'zod';

const router = Router();
router.use(requireAuth);

router.get('/', requirePermission('contacts.view'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const q = req.query as Record<string, string>;
  const calls = await listCalls(user.orgId, {
    leadId: q.leadId,
    userId: q.userId,
    status: q.status,
    days: q.days ? Number(q.days) : undefined,
  });
  return ok(res, { calls });
}));

router.post('/', requirePermission('contacts.edit'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const input = validate(callCreateSchema, req.body);
  const call = await logCall({
    orgId: user.orgId,
    userId: user.id,
    ...input,
    startedAt: input.startedAt ? new Date(input.startedAt) : null,
    endedAt: input.endedAt ? new Date(input.endedAt) : null,
  });
  return ok(res, { call }, 201);
}));

router.get('/stats', requirePermission('contacts.view'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const stats = await getCallStats(user.orgId, req.query.userId as string | undefined);
  return ok(res, { stats });
}));

router.get('/:id', requirePermission('contacts.view'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const call = await getCall(req.params.id, user.orgId);
  return ok(res, { call });
}));

router.patch('/:id', requirePermission('contacts.edit'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const input = validate(callUpdateSchema, req.body);
  const call = await updateCall(req.params.id, user.orgId, input);
  return ok(res, { call });
}));

router.delete('/:id', requirePermission('contacts.edit'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const result = await deleteCall(req.params.id, user.orgId);
  return ok(res, result);
}));

const callCreateSchema = z.object({
  leadId: z.string().optional().nullable(),
  contactId: z.string().optional().nullable(),
  direction: z.enum(['OUTBOUND', 'INBOUND']).optional(),
  status: z.enum(['CONNECTED', 'NO_ANSWER', 'BUSY', 'VOICEMAIL', 'FAILED', 'CANCELLED']),
  fromNumber: z.string().max(20).optional().nullable(),
  toNumber: z.string().max(20).optional().nullable(),
  durationSeconds: z.coerce.number().int().min(0).optional(),
  disposition: z.enum(['CONNECTED', 'LEFT_VOICEMAIL', 'CALLBACK', 'NOT_INTERESTED', 'INTERESTED', 'MEETING_BOOKED', 'DO_NOT_CALL', 'WRONG_NUMBER']).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  recordingUrl: z.string().max(500).optional().nullable(),
  recordingConsent: z.boolean().optional(),
  startedAt: z.string().datetime().optional().nullable(),
  endedAt: z.string().datetime().optional().nullable(),
});

const callUpdateSchema = z.object({
  status: z.enum(['CONNECTED', 'NO_ANSWER', 'BUSY', 'VOICEMAIL', 'FAILED', 'CANCELLED']).optional(),
  disposition: z.enum(['CONNECTED', 'LEFT_VOICEMAIL', 'CALLBACK', 'NOT_INTERESTED', 'INTERESTED', 'MEETING_BOOKED', 'DO_NOT_CALL', 'WRONG_NUMBER']).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  durationSeconds: z.coerce.number().int().min(0).optional(),
  transcript: z.string().max(50000).optional().nullable(),
  summary: z.string().max(2000).optional().nullable(),
  sentiment: z.enum(['POSITIVE', 'NEUTRAL', 'NEGATIVE']).optional().nullable(),
  actionItems: z.array(z.string().max(200)).max(20).optional().nullable(),
});

export default router;
