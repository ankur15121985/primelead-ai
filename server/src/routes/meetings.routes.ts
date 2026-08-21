/**
 * Meetings — meeting scheduler.
 *  - GET    /          list meetings
 *  - POST   /          create
 *  - GET    /:id       one meeting
 *  - PATCH  /:id       update
 *  - POST   /:id/cancel   cancel
 *  - POST   /:id/complete complete with summary
 *  - DELETE /:id       remove
 *  - GET    /stats     meeting statistics
 */
import { Router } from 'express';
import { asyncHandler, ok, validate } from '../lib/http';
import { requireAuth, requirePermission, type AuthedRequest } from '../middleware/auth';
import { createMeeting, updateMeeting, getMeeting, listMeetings, cancelMeeting, completeMeeting, deleteMeeting, getMeetingStats } from '../services/meetings';
import { z } from 'zod';

const router = Router();
router.use(requireAuth);

router.get('/', requirePermission('contacts.view'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const q = req.query as Record<string, string>;
  const meetings = await listMeetings(user.orgId, {
    hostId: q.hostId,
    leadId: q.leadId,
    status: q.status,
    from: q.from ? new Date(q.from) : undefined,
    to: q.to ? new Date(q.to) : undefined,
  });
  return ok(res, { meetings });
}));

router.post('/', requirePermission('contacts.edit'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const input = validate(meetingCreateSchema, req.body);
  const meeting = await createMeeting({
    orgId: user.orgId,
    hostId: user.id,
    ...input,
    startAt: new Date(input.startAt),
    endAt: new Date(input.endAt),
  });
  return ok(res, { meeting }, 201);
}));

router.get('/stats', requirePermission('contacts.view'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const stats = await getMeetingStats(user.orgId, req.query.hostId as string | undefined);
  return ok(res, { stats });
}));

router.get('/:id', requirePermission('contacts.view'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const meeting = await getMeeting(req.params.id, user.orgId);
  return ok(res, { meeting });
}));

router.patch('/:id', requirePermission('contacts.edit'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const input = validate(meetingUpdateSchema, req.body);
  const data: Record<string, unknown> = {};
  if (input.title !== undefined) data.title = input.title;
  if (input.description !== undefined) data.description = input.description;
  if (input.status !== undefined) data.status = input.status;
  if (input.meetingUrl !== undefined) data.meetingUrl = input.meetingUrl;
  if (input.prepNotes !== undefined) data.prepNotes = input.prepNotes;
  if (input.summary !== undefined) data.summary = input.summary;
  if (input.actionItems !== undefined) data.actionItems = input.actionItems;
  const meeting = await updateMeeting(req.params.id, user.orgId, data);
  return ok(res, { meeting });
}));

router.post('/:id/cancel', requirePermission('contacts.edit'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const meeting = await cancelMeeting(req.params.id, user.orgId);
  return ok(res, { meeting });
}));

router.post('/:id/complete', requirePermission('contacts.edit'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const input = validate(z.object({
    summary: z.string().max(5000).optional().nullable(),
    actionItems: z.array(z.string().max(200)).max(20).optional().nullable(),
  }), req.body);
  const meeting = await completeMeeting(req.params.id, user.orgId, input.summary || undefined, input.actionItems || undefined);
  return ok(res, { meeting });
}));

router.delete('/:id', requirePermission('contacts.edit'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const result = await deleteMeeting(req.params.id, user.orgId);
  return ok(res, result);
}));

const meetingCreateSchema = z.object({
  leadId: z.string().optional().nullable(),
  contactId: z.string().optional().nullable(),
  title: z.string().trim().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  meetingType: z.enum(['1_1', 'ROUND_ROBIN', 'TEAM', 'MULTI_HOST']).optional(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  durationMinutes: z.coerce.number().int().min(5).max(480).optional(),
  timezone: z.string().max(50).optional(),
  meetingUrl: z.string().max(500).optional().nullable(),
  prepNotes: z.string().max(5000).optional().nullable(),
});

const meetingUpdateSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  status: z.enum(['SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW']).optional(),
  meetingUrl: z.string().max(500).optional().nullable(),
  prepNotes: z.string().max(5000).optional().nullable(),
  summary: z.string().max(5000).optional().nullable(),
  actionItems: z.array(z.string().max(200)).max(20).optional().nullable(),
});

export default router;
