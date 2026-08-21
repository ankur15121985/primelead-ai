/**
 * Recordings — call and video meeting recordings with transcription.
 * Start/stop recordings, view transcripts, generate AI meeting notes.
 */
import { useEffect, useState } from 'react';

interface Recording {
  id: string;
  type: string;
  status: string;
  fileName: string | null;
  fileUrl: string | null;
  durationSeconds: number;
  transcript: string | null;
  summary: string | null;
  sentiment: string | null;
  callId: string | null;
  meetingId: string | null;
  consentGiven: boolean;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
}

interface RecordingStats {
  total: number;
  totalDurationSeconds: number;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
}

export default function Recordings() {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [stats, setStats] = useState<RecordingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedRecording, setSelectedRecording] = useState<Recording | null>(null);
  const [generatingNotes, setGeneratingNotes] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [recRes, statsRes] = await Promise.all([
        fetch('/api/recordings'),
        fetch('/api/recordings/stats'),
      ]);
      const recData = await recRes.json();
      const statsData = await statsRes.json();
      setRecordings(recData.data?.recordings || []);
      setStats(statsData.data || null);
    } catch (err) {
      console.error('Failed to load recordings:', err);
    } finally {
      setLoading(false);
    }
  }

  function formatDuration(seconds: number) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  function getTypeIcon(type: string) {
    switch (type) {
      case 'VIDEO': return '📹';
      case 'SCREEN_SHARE': return '🖥️';
      default: return '🎙️';
    }
  }

  function getStatusColor(status: string) {
    switch (status) {
      case 'TRANSCRIBED': return 'bg-green-100 text-green-800';
      case 'TRANSCRIBING': return 'bg-yellow-100 text-yellow-800';
      case 'RECORDING': return 'bg-red-100 text-red-800';
      case 'FAILED': return 'bg-gray-100 text-gray-800';
      default: return 'bg-blue-100 text-blue-800';
    }
  }

  function getSentimentColor(sentiment: string | null) {
    if (!sentiment) return 'text-gray-500';
    switch (sentiment) {
      case 'POSITIVE': return 'text-green-600';
      case 'NEGATIVE': return 'text-red-600';
      default: return 'text-yellow-600';
    }
  }

  async function generateNotes(recordingId: string) {
    setGeneratingNotes(true);
    try {
      const res = await fetch('/api/meeting-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recordingId }),
      });
      if (res.ok) {
        alert('Meeting notes generated successfully!');
      } else {
        const err = await res.json();
        alert(err.message || 'Failed to generate notes');
      }
    } catch (err) {
      alert('Failed to generate notes');
    } finally {
      setGeneratingNotes(false);
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Call & Video Recordings</h1>
          <p className="text-gray-500 mt-1">Record, transcribe, and analyze calls and meetings</p>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-5 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg border">
            <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
            <div className="text-sm text-gray-500">Total Recordings</div>
          </div>
          <div className="bg-white p-4 rounded-lg border">
            <div className="text-2xl font-bold text-blue-600">{formatDuration(stats.totalDurationSeconds)}</div>
            <div className="text-sm text-gray-500">Total Duration</div>
          </div>
          <div className="bg-white p-4 rounded-lg border">
            <div className="text-2xl font-bold text-purple-600">{stats.byType?.VIDEO || 0}</div>
            <div className="text-sm text-gray-500">Video</div>
          </div>
          <div className="bg-white p-4 rounded-lg border">
            <div className="text-2xl font-bold text-green-600">{stats.byType?.AUDIO || 0}</div>
            <div className="text-sm text-gray-500">Audio</div>
          </div>
          <div className="bg-white p-4 rounded-lg border">
            <div className="text-2xl font-bold text-green-600">{stats.byStatus?.TRANSCRIBED || 0}</div>
            <div className="text-sm text-gray-500">Transcribed</div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recordings List */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg border overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-gray-500">Loading...</div>
            ) : recordings.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No recordings yet. Start a recording from a call or meeting to begin.
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {recordings.map(rec => (
                  <div
                    key={rec.id}
                    onClick={() => setSelectedRecording(rec)}
                    className={`p-4 cursor-pointer hover:bg-gray-50 ${selectedRecording?.id === rec.id ? 'bg-blue-50 border-l-4 border-blue-600' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{getTypeIcon(rec.type)}</span>
                        <div>
                          <div className="font-medium text-gray-900">
                            {rec.fileName || `${rec.type} Recording`}
                          </div>
                          <div className="text-sm text-gray-500">
                            {formatDuration(rec.durationSeconds)} • {new Date(rec.createdAt).toLocaleString()}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {rec.sentiment && (
                          <span className={`text-sm font-medium ${getSentimentColor(rec.sentiment)}`}>
                            {rec.sentiment}
                          </span>
                        )}
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(rec.status)}`}>
                          {rec.status}
                        </span>
                      </div>
                    </div>
                    {rec.summary && (
                      <p className="mt-2 text-sm text-gray-600 line-clamp-2">{rec.summary}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recording Detail */}
        <div className="lg:col-span-1">
          {selectedRecording ? (
            <div className="bg-white rounded-lg border p-6 sticky top-6">
              <h3 className="font-bold text-lg mb-4">Recording Details</h3>

              <div className="space-y-3 text-sm">
                <div><span className="text-gray-500">Type:</span> {selectedRecording.type}</div>
                <div><span className="text-gray-500">Duration:</span> {formatDuration(selectedRecording.durationSeconds)}</div>
                <div><span className="text-gray-500">Status:</span> {selectedRecording.status}</div>
                <div><span className="text-gray-500">Consent:</span> {selectedRecording.consentGiven ? '✅ Yes' : '❌ No'}</div>
                {selectedRecording.sentiment && (
                  <div>
                    <span className="text-gray-500">Sentiment:</span>{' '}
                    <span className={getSentimentColor(selectedRecording.sentiment)}>
                      {selectedRecording.sentiment}
                    </span>
                  </div>
                )}
              </div>

              {selectedRecording.summary && (
                <div className="mt-4">
                  <h4 className="font-medium text-gray-700 mb-2">Summary</h4>
                  <p className="text-sm text-gray-600">{selectedRecording.summary}</p>
                </div>
              )}

              {selectedRecording.transcript && (
                <div className="mt-4">
                  <h4 className="font-medium text-gray-700 mb-2">Transcript</h4>
                  <div className="bg-gray-50 rounded p-3 text-sm text-gray-700 max-h-60 overflow-y-auto whitespace-pre-wrap">
                    {selectedRecording.transcript}
                  </div>
                </div>
              )}

              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => generateNotes(selectedRecording.id)}
                  disabled={generatingNotes}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm disabled:opacity-50"
                >
                  {generatingNotes ? 'Generating...' : '🤖 Generate AI Notes'}
                </button>
                {selectedRecording.fileUrl && (
                  <a
                    href={selectedRecording.fileUrl}
                    target="_blank"
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"
                  >
                    ⬇️ Download
                  </a>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg border p-6 text-center text-gray-500">
              Select a recording to view details
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
