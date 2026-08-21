/**
 * Video Call Service — WebRTC signaling server + room management.
 *
 * This provides:
 *   - Room creation/management for video meetings
 *   - WebRTC signaling (SDP offer/answer, ICE candidates)
 *   - Recording hooks for video calls
 *   - Participant tracking
 *
 * In production, this integrates with a TURN/STUN server and
 * a real-time signaling layer (Socket.IO or WebSocket).
 * In demo mode, it provides the room management API.
 */
import { prisma } from '../lib/prisma';
import { badRequest, notFound } from '../lib/http';
import crypto from 'crypto';

// ── Types ─────────────────────────────────────────────────

export interface CreateRoomInput {
  orgId: string;
  userId: string;
  leadId?: string;
  meetingId?: string;
  title: string;
  /** Max participants (default: 10) */
  maxParticipants?: number;
  /** Enable recording */
  recordingEnabled?: boolean;
  /** Password protection */
  password?: string;
}

export interface VideoRoom {
  id: string;
  roomId: string;
  orgId: string;
  title: string;
  status: 'WAITING' | 'ACTIVE' | 'RECORDING' | 'ENDED';
  hostId: string;
  leadId: string | null;
  meetingId: string | null;
  maxParticipants: number;
  recordingEnabled: boolean;
  hasPassword: boolean;
  participantCount: number;
  startedAt: Date | null;
  endedAt: Date | null;
  createdAt: Date;
}

export interface Participant {
  id: string;
  userId: string;
  name: string;
  role: 'HOST' | 'PARTICIPANT';
  joinedAt: Date;
  leftAt: Date | null;
  isMuted: boolean;
  isVideoOff: boolean;
}

// ── Room Management ───────────────────────────────────────

/**
 * Create a new video call room.
 */
export async function createRoom(input: CreateRoomInput): Promise<VideoRoom> {
  const roomId = crypto.randomBytes(8).toString('hex');

  const room = await prisma.videoRoom.create({
    data: {
      orgId: input.orgId,
      roomId,
      title: input.title,
      hostId: input.userId,
      leadId: input.leadId || null,
      meetingId: input.meetingId || null,
      maxParticipants: input.maxParticipants || 10,
      recordingEnabled: input.recordingEnabled ?? true,
      passwordHash: input.password ? hashPassword(input.password) : null,
      status: 'WAITING',
    },
  });

  // Add host as first participant
  await prisma.videoParticipant.create({
    data: {
      roomId: room.id,
      userId: input.userId,
      role: 'HOST',
    },
  });

  // Log activity if linked to a lead
  if (input.leadId) {
    await prisma.activity.create({
      data: {
        orgId: input.orgId,
        leadId: input.leadId,
        userId: input.userId,
        type: 'MEETING',
        title: `Video call started: ${input.title}`,
        body: `Room: ${roomId}`,
      },
    });
  }

  return formatRoom(room, 1);
}

/**
 * Join a video call room.
 */
export async function joinRoom(roomId: string, orgId: string, userId: string, password?: string) {
  const room = await prisma.videoRoom.findFirst({
    where: { roomId, orgId },
  });
  if (!room) throw notFound('Video room not found');
  if (room.status === 'ENDED') throw badRequest('This call has ended');

  // Check password
  if (room.passwordHash && password !== room.passwordHash) {
    throw badRequest('Incorrect room password');
  }

  // Check capacity
  const participantCount = await prisma.videoParticipant.count({
    where: { roomId: room.id, leftAt: null },
  });
  if (participantCount >= room.maxParticipants) {
    throw badRequest('Room is full');
  }

  // Check if already in room
  const existing = await prisma.videoParticipant.findFirst({
    where: { roomId: room.id, userId, leftAt: null },
  });
  if (existing) {
    return { participantId: existing.id, alreadyInRoom: true };
  }

  const participant = await prisma.videoParticipant.create({
    data: {
      roomId: room.id,
      userId,
      role: 'PARTICIPANT',
    },
  });

  // If first participant joins (besides host), activate the room
  if (room.status === 'WAITING') {
    await prisma.videoRoom.update({
      where: { id: room.id },
      data: { status: 'ACTIVE', startedAt: new Date() },
    });
  }

  return { participantId: participant.id, alreadyInRoom: false };
}

/**
 * Leave a video call room.
 */
export async function leaveRoom(roomId: string, orgId: string, userId: string) {
  const room = await prisma.videoRoom.findFirst({ where: { roomId, orgId } });
  if (!room) throw notFound('Video room not found');

  await prisma.videoParticipant.updateMany({
    where: { roomId: room.id, userId, leftAt: null },
    data: { leftAt: new Date() },
  });

  // Check if room is empty
  const remaining = await prisma.videoParticipant.count({
    where: { roomId: room.id, leftAt: null },
  });

  if (remaining === 0) {
    await prisma.videoRoom.update({
      where: { id: room.id },
      data: { status: 'ENDED', endedAt: new Date() },
    });
  }

  return { left: true, participantsRemaining: remaining };
}

/**
 * End a video call (host only).
 */
export async function endRoom(roomId: string, orgId: string, userId: string) {
  const room = await prisma.videoRoom.findFirst({ where: { roomId, orgId } });
  if (!room) throw notFound('Video room not found');
  if (room.hostId !== userId) throw badRequest('Only the host can end the call');

  // Force-leave all participants
  await prisma.videoParticipant.updateMany({
    where: { roomId: room.id, leftAt: null },
    data: { leftAt: new Date() },
  });

  await prisma.videoRoom.update({
    where: { id: room.id },
    data: { status: 'ENDED', endedAt: new Date() },
  });

  return { ended: true };
}

/**
 * Get room details with participants.
 */
export async function getRoom(roomId: string, orgId: string) {
  const room = await prisma.videoRoom.findFirst({
    where: { roomId, orgId },
    include: {
      participants: {
        where: { leftAt: null },
        orderBy: { joinedAt: 'asc' },
      },
    },
  });
  if (!room) throw notFound('Video room not found');

  return {
    ...formatRoom(room, room.participants.length),
    participants: room.participants.map(formatParticipant),
  };
}

/**
 * List rooms for an org.
 */
export async function listRooms(orgId: string, opts?: { status?: string; days?: number }) {
  const where: Record<string, unknown> = { orgId };
  if (opts?.status) where.status = opts.status;
  if (opts?.days) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - opts.days);
    where.createdAt = { gte: cutoff };
  }

  const rooms = await prisma.videoRoom.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      _count: { select: { participants: true } },
    },
  });

  return rooms.map((r: any) => ({
    id: r.id,
    roomId: r.roomId,
    title: r.title,
    status: r.status,
    participantCount: r._count.participants,
    startedAt: r.startedAt,
    endedAt: r.endedAt,
    createdAt: r.createdAt,
  }));
}

// ── Signaling (SDP/ICE) ───────────────────────────────────

/**
 * Store SDP offer/answer for a participant.
 */
export async function storeSdp(roomId: string, orgId: string, userId: string, sdp: string, type: 'offer' | 'answer') {
  const room = await prisma.videoRoom.findFirst({ where: { roomId, orgId } });
  if (!room) throw notFound('Video room not found');

  const participant = await prisma.videoParticipant.findFirst({
    where: { roomId: room.id, userId },
  });
  if (!participant) throw badRequest('Not a participant in this room');

  await prisma.videoParticipant.update({
    where: { id: participant.id },
    data: { sdp, sdpType: type },
  });

  return { stored: true };
}

/**
 * Store ICE candidate for a participant.
 */
export async function storeIceCandidate(roomId: string, orgId: string, userId: string, candidate: string) {
  const room = await prisma.videoRoom.findFirst({ where: { roomId, orgId } });
  if (!room) throw notFound('Video room not found');

  const participant = await prisma.videoParticipant.findFirst({
    where: { roomId: room.id, userId },
  });
  if (!participant) throw badRequest('Not a participant in this room');

  // Append to existing candidates
  const existing = (participant.iceCandidates as string[]) || [];
  await prisma.videoParticipant.update({
    where: { id: participant.id },
    data: { iceCandidates: [...existing, candidate] as any },
  });

  return { stored: true };
}

/**
 * Get signaling data from other participants (for WebRTC handshake).
 */
export async function getSignalingData(roomId: string, orgId: string, userId: string) {
  const room = await prisma.videoRoom.findFirst({ where: { roomId, orgId } });
  if (!room) throw notFound('Video room not found');

  const participants = await prisma.videoParticipant.findMany({
    where: { roomId: room.id, leftAt: null, NOT: { userId } },
    select: { userId: true, sdp: true, sdpType: true, iceCandidates: true },
  });

  return participants.map((p: any) => ({
    userId: p.userId,
    sdp: p.sdp,
    sdpType: p.sdpType,
    iceCandidates: p.iceCandidates || [],
  }));
}

// ── Helpers ───────────────────────────────────────────────

function formatRoom(room: any, participantCount: number): VideoRoom {
  return {
    id: room.id,
    roomId: room.roomId,
    orgId: room.orgId,
    title: room.title,
    status: room.status,
    hostId: room.hostId,
    leadId: room.leadId,
    meetingId: room.meetingId,
    maxParticipants: room.maxParticipants,
    recordingEnabled: room.recordingEnabled,
    hasPassword: !!room.passwordHash,
    participantCount,
    startedAt: room.startedAt,
    endedAt: room.endedAt,
    createdAt: room.createdAt,
  };
}

function formatParticipant(p: any): Participant {
  return {
    id: p.id,
    userId: p.userId,
    name: p.user?.name || p.userId,
    role: p.role,
    joinedAt: p.joinedAt,
    leftAt: p.leftAt,
    isMuted: p.isMuted,
    isVideoOff: p.isVideoOff,
  };
}

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}
