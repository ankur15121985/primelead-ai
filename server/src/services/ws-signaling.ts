/**
 * WebSocket Signaling Server — real-time WebRTC signaling for video calls.
 *
 * Handles:
 *   - Room join/leave notifications
 *   - SDP offer/answer relay
 *   - ICE candidate relay
 *   - Participant mute/unmute
 *   - Recording start/stop
 *
 * In production, uses Socket.IO or ws library.
 * In demo mode, provides the message protocol.
 */
import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-prod';

interface WsClient {
  ws: WebSocket;
  userId: string;
  orgId: string;
  roomId: string;
  name: string;
}

// Connected clients by room
const rooms = new Map<string, Map<string, WsClient>>();

let wss: WebSocketServer | null = null;

/**
 * Initialize WebSocket server on an existing HTTP server.
 */
export function initWsSignaling(server: Server) {
  wss = new WebSocketServer({ server, path: '/ws/signaling' });

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const token = url.searchParams.get('token');
    const roomId = url.searchParams.get('room');

    if (!token || !roomId) {
      ws.close(4001, 'Missing token or room parameter');
      return;
    }

    // Verify JWT
    let payload: any;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch {
      ws.close(4002, 'Invalid token');
      return;
    }

    const client: WsClient = {
      ws,
      userId: payload.sub || payload.userId,
      orgId: payload.orgId,
      roomId,
      name: payload.name || 'Participant',
    };

    // Add to room
    if (!rooms.has(roomId)) rooms.set(roomId, new Map());
    rooms.get(roomId)!.set(client.userId, client);

    // Notify others
    broadcast(roomId, {
      type: 'participant-joined',
      userId: client.userId,
      name: client.name,
      participantCount: rooms.get(roomId)!.size,
    }, client.userId);

    // Send current participants to new joiner
    const participants = Array.from(rooms.get(roomId)!.values())
      .filter(c => c.userId !== client.userId)
      .map(c => ({ userId: c.userId, name: c.name }));

    send(client, {
      type: 'room-state',
      participants,
      participantCount: rooms.get(roomId)!.size,
    });

    // Handle messages
    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        handleMessage(client, msg);
      } catch {
        // Ignore malformed messages
      }
    });

    // Handle disconnect
    ws.on('close', () => {
      rooms.get(roomId)?.delete(client.userId);
      if (rooms.get(roomId)?.size === 0) {
        rooms.delete(roomId);
      } else {
        broadcast(roomId, {
          type: 'participant-left',
          userId: client.userId,
          participantCount: rooms.get(roomId)?.size || 0,
        }, client.userId);
      }
    });

    ws.on('error', () => {
      rooms.get(roomId)?.delete(client.userId);
    });
  });

  console.log('[WS] Signaling server initialized on /ws/signaling');
  return wss;
}

/**
 * Handle incoming WebSocket messages.
 */
function handleMessage(client: WsClient, msg: any) {
  switch (msg.type) {
    case 'sdp-offer':
      // Relay SDP offer to specific peer
      relay(client.roomId, client.userId, msg.targetUserId, {
        type: 'sdp-offer',
        userId: client.userId,
        sdp: msg.sdp,
      });
      break;

    case 'sdp-answer':
      relay(client.roomId, client.userId, msg.targetUserId, {
        type: 'sdp-answer',
        userId: client.userId,
        sdp: msg.sdp,
      });
      break;

    case 'ice-candidate':
      relay(client.roomId, client.userId, msg.targetUserId, {
        type: 'ice-candidate',
        userId: client.userId,
        candidate: msg.candidate,
      });
      break;

    case 'mute':
    case 'unmute':
      broadcast(client.roomId, {
        type: msg.type,
        userId: client.userId,
      }, client.userId);
      break;

    case 'video-on':
    case 'video-off':
      broadcast(client.roomId, {
        type: msg.type,
        userId: client.userId,
      }, client.userId);
      break;

    case 'recording-started':
      broadcast(client.roomId, {
        type: 'recording-started',
        userId: client.userId,
      }, client.userId);
      break;

    case 'recording-stopped':
      broadcast(client.roomId, {
        type: 'recording-stopped',
        userId: client.userId,
      }, client.userId);
      break;

    case 'chat':
      broadcast(client.roomId, {
        type: 'chat',
        userId: client.userId,
        name: client.name,
        message: msg.message?.slice(0, 500),
        timestamp: new Date().toISOString(),
      });
      break;

    case 'ping':
      send(client, { type: 'pong', timestamp: Date.now() });
      break;
  }
}

/**
 * Send a message to a specific client.
 */
function send(client: WsClient, msg: any) {
  if (client.ws.readyState === WebSocket.OPEN) {
    client.ws.send(JSON.stringify(msg));
  }
}

/**
 * Relay a message to a specific user in the room.
 */
function relay(roomId: string, fromUserId: string, toUserId: string, msg: any) {
  const room = rooms.get(roomId);
  if (!room) return;
  const target = room.get(toUserId);
  if (target) {
    send(target, msg);
  }
}

/**
 * Broadcast a message to all clients in a room except the sender.
 */
function broadcast(roomId: string, msg: any, excludeUserId?: string) {
  const room = rooms.get(roomId);
  if (!room) return;
  for (const [userId, client] of room) {
    if (userId !== excludeUserId) {
      send(client, msg);
    }
  }
}

/**
 * Get room info (for REST API).
 */
export function getRoomWsInfo(roomId: string) {
  const room = rooms.get(roomId);
  if (!room) return { connected: 0, participants: [] };
  return {
    connected: room.size,
    participants: Array.from(room.values()).map(c => ({
      userId: c.userId,
      name: c.name,
    })),
  };
}

/**
 * Cleanup on server shutdown.
 */
export function shutdownWs() {
  if (wss) {
    wss.clients.forEach(ws => ws.close(1001, 'Server shutting down'));
    wss.close();
  }
}
