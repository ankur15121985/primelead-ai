/**
 * Sequences — email sequence management.
 *  - GET    /          list all
 *  - POST   /          create
 *  - GET    /:id       one with steps
 *  - PATCH  /:id       update
 *  - DELETE /:id       remove
 *  - POST   /:id/enroll     enroll contacts
 *  - GET    /:id/enrollments list enrollments
 *  - POST   /:id/enrollments/:eid/unenroll  stop
 *  - POST   /:id/enrollments/:eid/advance   next step
 *  - POST   /:id/enrollments/:eid/event     record email event
 *  - GET    /:id/stats     sequence stats
 */
import { Router } from 'express';
import { asyncHandler, ok, validate } from '../lib/http';
import { requireAuth, requirePermission, type AuthedRequest } from '../middleware/auth';
import { createSequence, updateSequence, deleteSequence, getSequence, listSequences, enrollContacts, getSequenceEnrollments, unenrollContact, advanceEnrollment, recordEmailEvent, getSequenceStats } from '../services/sequences';
import { z } from 'zod';

const router = Router();
router.use(requireAuth);

router.get('/', requirePermission('contacts.view'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const sequences = await listSequences(user.orgId);
  return ok(res, { sequences });
}));

router.post('/', requirePermission('contacts.edit'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const input = validate(sequenceCreateSchema, req.body);
  const sequence = await createSequence({ orgId: user.orgId, ...input });
  return ok(res, { sequence }, 201);
}));

router.get('/:id', requirePermission('contacts.view'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const sequence = await getSequence(req.params.id, user.orgId);
  return ok(res, { sequence });
}));

router.patch('/:id', requirePermission('contacts.edit'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const input = validate(sequenceUpdateSchema, req.body);
  const sequence = await updateSequence(req.params.id, user.orgId, input);
  return ok(res, { sequence });
}));

router.delete('/:id', requirePermission('contacts.edit'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const result = await deleteSequence(req.params.id, user.orgId);
  return ok(res, result);
}));

router.post('/:id/enroll', requirePermission('contacts.edit'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const input = validate(enrollSchema, req.body);
  const result = await enrollContacts(req.params.id, user.orgId, input.contacts);
  return ok(res, result);
}));

router.get('/:id/enrollments', requirePermission('contacts.view'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const enrollments = await getSequenceEnrollments(req.params.id, user.orgId);
  return ok(res, { enrollments });
}));

router.post('/:id/enrollments/:eid/unenroll', requirePermission('contacts.edit'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const result = await unenrollContact(req.params.eid, user.orgId);
  return ok(res, result);
}));

router.post('/:id/enrollments/:eid/advance', requirePermission('contacts.edit'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const result = await advanceEnrollment(req.params.eid, user.orgId);
  return ok(res, result);
}));

router.post('/:id/enrollments/:eid/event', requirePermission('contacts.edit'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const input = validate(emailEventSchema, req.body);
  const log = await recordEmailEvent(req.params.eid, user.orgId, input);
  return ok(res, { log });
}));

router.get('/:id/stats', requirePermission('contacts.view'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const stats = await getSequenceStats(req.params.id, user.orgId);
  return ok(res, { stats });
}));

const stepSchema = z.object({
  type: z.enum(['EMAIL', 'CALL_TASK', 'LINKEDIN_TASK', 'MANUAL_TASK', 'WAIT', 'CONDITION', 'WEBHOOK', 'AI_ACTION']),
  order: z.coerce.number().int().min(0),
  subject: z.string().max(200).optional().nullable(),
  body: z.string().max(5000).optional().nullable(),
  waitDays: z.coerce.number().int().min(0).max(365).optional().nullable(),
  waitHours: z.coerce.number().int().min(0).max(168).optional().nullable(),
  conditionType: z.string().max(50).optional().nullable(),
  conditionValue: z.string().max(200).optional().nullable(),
  aiPrompt: z.string().max(500).optional().nullable(),
  aiAction: z.string().max(50).optional().nullable(),
});

const sequenceCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().max(500).optional().nullable(),
  steps: z.array(stepSchema).min(1).max(20),
});

const sequenceUpdateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().max(500).optional().nullable(),
  status: z.enum(['DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED']).optional(),
});

const enrollSchema = z.object({
  contacts: z.array(z.object({
    email: z.string().email(),
    leadId: z.string().optional(),
    contactId: z.string().optional(),
  })).min(1).max(500),
});

const emailEventSchema = z.object({
  stepId: z.string().min(1),
  status: z.enum(['SENT', 'DELIVERED', 'OPENED', 'CLICKED', 'BOUNCED', 'FAILED', 'REPLIED']),
  subject: z.string().max(200).optional(),
  body: z.string().max(5000).optional(),
  errorMessage: z.string().max(500).optional(),
});

export default router;
