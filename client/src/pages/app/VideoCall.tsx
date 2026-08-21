/**
 * Video Call — create/join rooms, WebRTC controls, participant list.
 * In production this integrates with a real WebRTC library (e.g. simple-peer, PeerJS).
 * In demo mode, it shows the room management UI.
 */
import { useEffect, useState } from 'react';

interface VideoRoom {
  id: string;
  roomId: string;
  title: string;
  status: string;
  hostId: string;
  participantCount: number;
  maxParticipants: number;
  recordingEnabled: boolean;
  hasPassword: boolean;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  participants?: Participant[];
}

interface Participant {
  id: string;
  userId: string;
  name: string;
  role: string;
  joinedAt: string;
  isMuted: boolean;
  isVideoOff: boolean;
}

export default function VideoCall() {
  const [rooms, setRooms] = useState<VideoRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoom, setSelectedRoom] = useState<VideoRoom | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRoomTitle, setNewRoomTitle] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  useEffect(() => { loadRooms(); }, []);

  async function loadRooms() {
    setLoading(true);
    try {
      const res = await fetch('/api/video/rooms');
      const data = await res.json();
      setRooms(data.data?.rooms || []);
    } catch (err) {
      console.error('Failed to load rooms:', err);
    } finally {
      setLoading(false);
    }
  }

  async function createRoom() {
    if (!newRoomTitle.trim()) return;
    try {
      const res = await fetch('/api/video/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newRoomTitle, recordingEnabled: true }),
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedRoom(data.data);
        setShowCreateModal(false);
        setNewRoomTitle('');
        loadRooms();
      }
    } catch (err) {
      console.error('Failed to create room:', err);
    }
  }

  async function joinRoom(roomId: string) {
    try {
      const res = await fetch(`/api/video/rooms/${roomId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const roomRes = await fetch(`/api/video/rooms/${roomId}`);
        const data = await roomRes.json();
        setSelectedRoom(data.data);
      }
    } catch (err) {
      console.error('Failed to join room:', err);
    }
  }

  async function leaveRoom() {
    if (!selectedRoom) return;
    try {
      await fetch(`/api/video/rooms/${selectedRoom.roomId}/leave`, { method: 'POST' });
      setSelectedRoom(null);
      loadRooms();
    } catch (err) {
      console.error('Failed to leave room:', err);
    }
  }

  async function endRoom() {
    if (!selectedRoom) return;
    try {
      await fetch(`/api/video/rooms/${selectedRoom.roomId}/end`, { method: 'POST' });
      setSelectedRoom(null);
      loadRooms();
    } catch (err) {
      console.error('Failed to end room:', err);
    }
  }

  function getStatusColor(status: string) {
    switch (status) {
      case 'ACTIVE': return 'bg-green-100 text-green-800';
      case 'WAITING': return 'bg-yellow-100 text-yellow-800';
      case 'RECORDING': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Video Calls</h1>
          <p className="text-gray-500 mt-1">Create and join WebRTC video rooms</p>
        </div>
        <button onClick={() => setShowCreateModal(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          🎬 New Room
        </button>
      </div>

      {/* Active Call UI */}
      {selectedRoom && (
        <div className="mb-8 bg-gray-900 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold">{selectedRoom.title}</h2>
              <p className="text-gray-400 text-sm">Room: {selectedRoom.roomId}</p>
            </div>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(selectedRoom.status)}`}>
              {selectedRoom.status}
            </span>
          </div>

          {/* Video placeholder */}
          <div className="bg-gray-800 rounded-lg aspect-video flex items-center justify-center mb-4 relative">
            <div className="text-center">
              <div className="text-6xl mb-4">📹</div>
              <p className="text-gray-400">Video feed will appear here</p>
              <p className="text-sm text-gray-500 mt-2">Connect WebRTC to enable live video</p>
            </div>
            {selectedRoom.recordingEnabled && (
              <div className="absolute top-4 left-4 flex items-center gap-2 bg-red-600 px-3 py-1 rounded-full">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                <span className="text-sm font-medium">REC</span>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => setIsMuted(!isMuted)}
              className={`w-12 h-12 rounded-full flex items-center justify-center ${isMuted ? 'bg-red-600' : 'bg-gray-700 hover:bg-gray-600'}`}
            >
              {isMuted ? '🔇' : '🎤'}
            </button>
            <button
              onClick={() => setIsVideoOff(!isVideoOff)}
              className={`w-12 h-12 rounded-full flex items-center justify-center ${isVideoOff ? 'bg-red-600' : 'bg-gray-700 hover:bg-gray-600'}`}
            >
              {isVideoOff ? '📵' : '📹'}
            </button>
            <button onClick={leaveRoom} className="w-12 h-12 rounded-full bg-yellow-600 hover:bg-yellow-700 flex items-center justify-center">
              🚪
            </button>
            <button onClick={endRoom} className="w-12 h-12 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center">
              📞
            </button>
          </div>

          {/* Participants */}
          {selectedRoom.participants && selectedRoom.participants.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-medium text-gray-400 mb-2">Participants ({selectedRoom.participants.length})</h3>
              <div className="flex flex-wrap gap-2">
                {selectedRoom.participants.map(p => (
                  <div key={p.id} className="bg-gray-800 px-3 py-2 rounded-lg text-sm flex items-center gap-2">
                    <span>{p.isMuted ? '🔇' : '🎤'}</span>
                    <span>{p.name}</span>
                    <span className="text-gray-500">({p.role})</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Room List */}
      <div className="bg-white rounded-lg border overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading rooms...</div>
        ) : rooms.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No video rooms yet. Click "New Room" to create one.
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Room</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Participants</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Recording</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Created</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {rooms.map(room => (
                <tr key={room.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{room.title}</div>
                    <div className="text-xs text-gray-500 font-mono">{room.roomId}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(room.status)}`}>
                      {room.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {room.participantCount}/{room.maxParticipants}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {room.recordingEnabled ? '🔴 Yes' : '⬜ No'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {new Date(room.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    {room.status !== 'ENDED' && (
                      <button
                        onClick={() => joinRoom(room.roomId)}
                        className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                      >
                        Join
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create Room Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">Create Video Room</h3>
            <input
              type="text"
              value={newRoomTitle}
              onChange={e => setNewRoomTitle(e.target.value)}
              placeholder="Room title"
              className="w-full px-4 py-2 border rounded-lg mb-4"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg">
                Cancel
              </button>
              <button onClick={createRoom} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                Create Room
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
