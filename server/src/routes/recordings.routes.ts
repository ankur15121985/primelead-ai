/**
 * Recordings Routes — manage call and video meeting recordings.
 *
 * POST   /api/recordings             — start a new recording
 * POST   /api/recordings/:id/complete — complete recording with file details
 * POST   /api/recordings/:id/transcript — save transcript + AI analysis
 * GET    /api/recordings             — list recordings
 * GET    /api/recordings/stats       — recording statistics
 * GET    /api/recordings/:id         — get recording details
 * DELETE /api/recordings/:id         — delete recording
 */
import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, ok, validate } from '../lib/http';
import { requireAuth, requirePermission, type AuthedRequest } from '../middleware/auth';
import * as recordings from '../services/recording';

const router = Router();

const startRecordingSchema = z.object({
  callId: z.string().optional(),
  meetingId: z.string().optional(),
  leadId: z.string().optional(),
  type: z.enum(['AUDIO', 'VIDEO', 'SCREEN_SHARE']).optional(),
  consentGiven: z.boolean().optional(),
});

const completeRecordingSchema = z.object({
  fileUrl: z.string().url(),
  fileName: z.string().optional(),
  fileSizeBytes: z.number().optional(),
  durationSeconds: z.number().min(0),
  mimeType: z.string().optional(),
});

const transcriptSchema = z.object({
  transcript: z.string().min(1),
  summary: z.string().optional(),
  sentiment: z.enum(['POSITIVE', 'NEUTRAL', 'NEGATIVE']).optional(),
  actionItems: z.array(z.string()).optional(),
  keyTopics: z.array(z.string()).optional(),
  speakers: z.array(z.object({
    name: z.string(),
    speakingTime: z.number(),
    sentiment: z.string().optional(),
  })).optional(),
});

/**
 * POST /api/recordings — start a new recording
 */
router.post(
  '/',
  requireAuth,
  requirePermission('calls.edit'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const input = validate(startRecordingSchema, req.body);
    const recording = await recordings.startRecording({
      orgId: user.orgId,
      userId: user.id,
      ...input,
    });
    return ok(res, recording, 201);
  })
);

/**
 * GET /api/recordings — list recordings
 */
router.get(
  '/',
  requireAuth,
  requirePermission('calls.view'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const { callId, meetingId, type, status, days, page, limit } = req.query;
    const result = await recordings.listRecordings(user.orgId, {
      callId: callId as string,
      meetingId: meetingId as string,
      type: type as string,
      status: status as string,
      days: days ? parseInt(days as string) : undefined,
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    });
    return ok(res, result);
  })
);

/**
 * GET /api/recordings/stats — recording statistics
 */
router.get(
  '/stats',
  requireAuth,
  requirePermission('calls.view'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const stats = await recordings.getRecordingStats(user.orgId);
    return ok(res, stats);
  })
);

/**
 * GET /api/recordings/:id — get recording details
 */
router.get(
  '/:id',
  requireAuth,
  requirePermission('calls.view'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const recording = await recordings.getRecording(req.params.id, user.orgId);
    return ok(res, recording);
  })
);

/**
 * POST /api/recordings/:id/complete — complete recording with file details
 */
router.post(
  '/:id/complete',
  requireAuth,
  requirePermission('calls.edit'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const input = validate(completeRecordingSchema, req.body);
    const recording = await recordings.completeRecording({
      orgId: user.orgId,
      recordingId: req.params.id,
      ...input,
    });
    return ok(res, recording);
  })
);

/**
 * POST /api/recordings/:id/transcript — save transcript + AI analysis
 */
router.post(
  '/:id/transcript',
  requireAuth,
  requirePermission('calls.edit'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const input = validate(transcriptSchema, req.body);
    const recording = await recordings.saveTranscript({
      orgId: user.orgId,
      recordingId: req.params.id,
      ...input,
    });
    return ok(res, recording);
  })
);

/**
 * DELETE /api/recordings/:id — delete recording
 */
router.delete(
  '/:id',
  requireAuth,
  requirePermission('calls.edit'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const result = await recordings.deleteRecording(req.params.id, user.orgId);
    return ok(res, result);
  })
);

export default router;
