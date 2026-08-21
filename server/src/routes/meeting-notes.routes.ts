/**
 * Meeting Notes Routes — AI-generated meeting notes for calls and video meetings.
 *
 * POST   /api/meeting-notes         — generate AI notes from transcript
 * GET    /api/meeting-notes         — list notes
 * GET    /api/meeting-notes/:id     — get notes detail
 * PATCH  /api/meeting-notes/:id     — update notes (manual edits)
 * DELETE /api/meeting-notes/:id     — delete notes
 */
import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, ok, validate } from '../lib/http';
import { requireAuth, requirePermission, type AuthedRequest } from '../middleware/auth';
import * as meetingNotes from '../services/meeting-notes';

const router = Router();

const generateNotesSchema = z.object({
  callId: z.string().optional(),
  meetingId: z.string().optional(),
  recordingId: z.string().optional(),
  leadId: z.string().optional(),
  transcript: z.string().optional(),
  force: z.boolean().optional(),
});

const updateNotesSchema = z.object({
  title: z.string().optional(),
  notes: z.string().optional(),
  summary: z.string().optional(),
  keyDecisions: z.array(z.string()).optional(),
  actionItems: z.array(z.object({
    assignee: z.string(),
    task: z.string(),
    dueDate: z.string().optional(),
  })).optional(),
  followUpItems: z.array(z.string()).optional(),
});

/**
 * POST /api/meeting-notes — generate AI meeting notes
 */
router.post(
  '/',
  requireAuth,
  requirePermission('calls.edit'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const input = validate(generateNotesSchema, req.body);
    const notes = await meetingNotes.generateMeetingNotes({
      orgId: user.orgId,
      userId: user.id,
      ...input,
    });
    return ok(res, notes, 201);
  })
);

/**
 * GET /api/meeting-notes — list meeting notes
 */
router.get(
  '/',
  requireAuth,
  requirePermission('calls.view'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const { callId, meetingId, leadId, page, limit } = req.query;
    const result = await meetingNotes.listMeetingNotes(user.orgId, {
      callId: callId as string,
      meetingId: meetingId as string,
      leadId: leadId as string,
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    });
    return ok(res, result);
  })
);

/**
 * GET /api/meeting-notes/:id — get notes detail
 */
router.get(
  '/:id',
  requireAuth,
  requirePermission('calls.view'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const notes = await meetingNotes.getMeetingNotes(req.params.id, user.orgId);
    return ok(res, notes);
  })
);

/**
 * PATCH /api/meeting-notes/:id — update notes (manual edits)
 */
router.patch(
  '/:id',
  requireAuth,
  requirePermission('calls.edit'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const input = validate(updateNotesSchema, req.body);
    const notes = await meetingNotes.updateMeetingNotes(req.params.id, user.orgId, input);
    return ok(res, notes);
  })
);

/**
 * DELETE /api/meeting-notes/:id — delete notes
 */
router.delete(
  '/:id',
  requireAuth,
  requirePermission('calls.edit'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const result = await meetingNotes.deleteMeetingNotes(req.params.id, user.orgId);
    return ok(res, result);
  })
);

export default router;
