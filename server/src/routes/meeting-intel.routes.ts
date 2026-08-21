/**
 * Meeting Intelligence routes (Phase 12).
 *
 *   GET    /api/meeting-intel/:meetingId/prep  — get/generate meeting prep
 *   POST   /api/meeting-intel/:meetingId/prep  — generate meeting prep
 *   POST   /api/meeting-intel/:meetingId/complete — complete meeting with summary
 *   GET    /api/meeting-intel/preps             — list all preps
 */
import { Router } from 'express';
import { asyncHandler, badRequest, ok } from '../lib/http';
import { requireAuth, requirePermission, type AuthedRequest } from '../middleware/auth';
import { audit } from '../lib/audit';
import { generateMeetingPrep, completeMeeting, getMeetingPrep, getAllPreps } from '../services/meeting-intelligence';

const router = Router();
router.use(requireAuth);

router.get('/:meetingId/prep', requirePermission('ai.use'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const prep = await getMeetingPrep(user.orgId, req.params.meetingId);
  return ok(res, { prep });
}));

router.post('/:meetingId/prep', requirePermission('ai.use'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const { prep, fromCache } = await generateMeetingPrep(user.orgId, req.params.meetingId, user.id);
  await audit({ orgId: user.orgId, userId: user.id, action: 'MEETING_PREP_GENERATED', entity: 'Meeting', entityId: req.params.meetingId, req });
  return ok(res, { prep, fromCache });
}));

router.post('/:meetingId/complete', requirePermission('ai.use'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const body = req.body as any;
  await completeMeeting(user.orgId, req.params.meetingId, {
    summary: body.summary,
    actionItems: body.actionItems,
    followUpTasks: body.followUpTasks,
    dealRisk: body.dealRisk,
    dealRiskReason: body.dealRiskReason,
    sentiment: body.sentiment,
  }, user.id);
  await audit({ orgId: user.orgId, userId: user.id, action: 'MEETING_COMPLETED', entity: 'Meeting', entityId: req.params.meetingId, req });
  return ok(res, { success: true });
}));

router.get('/preps', requirePermission('ai.use'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const preps = await getAllPreps(user.orgId, {
    contactId: (req.query.contactId as string) || undefined,
    companyId: (req.query.companyId as string) || undefined,
    limit: Number(req.query.limit) || 20,
  });
  return ok(res, { preps });
}));

export default router;
