/**
 * Video Call Routes — room management and WebRTC signaling.
 *
 * POST   /api/video/rooms              — create room
 * GET    /api/video/rooms              — list rooms
 * GET    /api/video/rooms/:roomId      — get room details
 * POST   /api/video/rooms/:roomId/join — join room
 * POST   /api/video/rooms/:roomId/leave — leave room
 * POST   /api/video/rooms/:roomId/end  — end room (host)
 * POST   /api/video/rooms/:roomId/sdp  — store SDP
 * POST   /api/video/rooms/:roomId/ice  — store ICE candidate
 * GET    /api/video/rooms/:roomId/signaling — get peer signaling data
 */
import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, ok, validate } from '../lib/http';
import { requireAuth, requirePermission, type AuthedRequest } from '../middleware/auth';
import * as videoCall from '../services/video-call';

const router = Router();

const createRoomSchema = z.object({
  title: z.string().min(1).max(200),
  leadId: z.string().optional(),
  meetingId: z.string().optional(),
  maxParticipants: z.number().min(2).max(50).optional(),
  recordingEnabled: z.boolean().optional(),
  password: z.string().min(4).max(50).optional(),
});

const joinRoomSchema = z.object({
  password: z.string().optional(),
});

const sdpSchema = z.object({
  sdp: z.string().min(1),
  type: z.enum(['offer', 'answer']),
});

const iceSchema = z.object({
  candidate: z.string().min(1),
});

/**
 * POST /api/video/rooms — create a video call room
 */
router.post(
  '/rooms',
  requireAuth,
  requirePermission('calls.edit'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const input = validate(createRoomSchema, req.body);
    const room = await videoCall.createRoom({
      orgId: user.orgId,
      userId: user.id,
      ...input,
    });
    return ok(res, room, 201);
  })
);

/**
 * GET /api/video/rooms — list rooms
 */
router.get(
  '/rooms',
  requireAuth,
  requirePermission('calls.view'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const { status, days } = req.query;
    const rooms = await videoCall.listRooms(user.orgId, {
      status: status as string,
      days: days ? parseInt(days as string) : undefined,
    });
    return ok(res, { rooms, total: rooms.length });
  })
);

/**
 * GET /api/video/rooms/:roomId — get room details
 */
router.get(
  '/rooms/:roomId',
  requireAuth,
  requirePermission('calls.view'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const room = await videoCall.getRoom(req.params.roomId, user.orgId);
    return ok(res, room);
  })
);

/**
 * POST /api/video/rooms/:roomId/join — join a room
 */
router.post(
  '/rooms/:roomId/join',
  requireAuth,
  requirePermission('calls.edit'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const { password } = validate(joinRoomSchema, req.body);
    const result = await videoCall.joinRoom(req.params.roomId, user.orgId, user.id, password);
    return ok(res, result);
  })
);

/**
 * POST /api/video/rooms/:roomId/leave — leave a room
 */
router.post(
  '/rooms/:roomId/leave',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const result = await videoCall.leaveRoom(req.params.roomId, user.orgId, user.id);
    return ok(res, result);
  })
);

/**
 * POST /api/video/rooms/:roomId/end — end a room (host only)
 */
router.post(
  '/rooms/:roomId/end',
  requireAuth,
  requirePermission('calls.edit'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const result = await videoCall.endRoom(req.params.roomId, user.orgId, user.id);
    return ok(res, result);
  })
);

/**
 * POST /api/video/rooms/:roomId/sdp — store SDP
 */
router.post(
  '/rooms/:roomId/sdp',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const input = validate(sdpSchema, req.body);
    const result = await videoCall.storeSdp(req.params.roomId, user.orgId, user.id, input.sdp, input.type);
    return ok(res, result);
  })
);

/**
 * POST /api/video/rooms/:roomId/ice — store ICE candidate
 */
router.post(
  '/rooms/:roomId/ice',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const input = validate(iceSchema, req.body);
    const result = await videoCall.storeIceCandidate(req.params.roomId, user.orgId, user.id, input.candidate);
    return ok(res, result);
  })
);

/**
 * GET /api/video/rooms/:roomId/signaling — get peer signaling data
 */
router.get(
  '/rooms/:roomId/signaling',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const data = await videoCall.getSignalingData(req.params.roomId, user.orgId, user.id);
    return ok(res, { peers: data });
  })
);

export default router;
