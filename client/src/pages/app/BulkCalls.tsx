/**
 * Bulk Calls — select leads and initiate outbound calls in batch.
 * Shows dialer queue, batch history, and call script.
 */
import { useEffect, useState } from 'react';

interface Lead {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  company: string | null;
  score: number;
  status: string;
  lastContactedAt: string | null;
}

interface BatchResult {
  batchId: string;
  totalRequested: number;
  initiated: number;
  failed: number;
  calls: Array<{
    leadId: string;
    leadName: string;
    phone: string;
    callId: string;
    status: string;
    error?: string;
  }>;
}

export default function BulkCalls() {
  const [queue, setQueue] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [script, setScript] = useState('');
  const [calling, setCalling] = useState(false);
  const [lastResult, setLastResult] = useState<BatchResult | null>(null);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => { loadQueue(); loadHistory(); }, []);

  async function loadQueue() {
    setLoading(true);
    try {
      const res = await fetch('/api/bulk-calls/queue?limit=50');
      const data = await res.json();
      setQueue(data.data?.queue || []);
    } catch (err) {
      console.error('Failed to load queue:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadHistory() {
    try {
      const res = await fetch('/api/bulk-calls/history');
      const data = await res.json();
      setHistory(data.data?.history || []);
    } catch (err) {
      console.error('Failed to load history:', err);
    }
  }

  function toggleSelect(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  function selectAll() {
    if (selected.size === queue.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(queue.map(l => l.id)));
    }
  }

  async function initiateCalls() {
    if (selected.size === 0) return;
    setCalling(true);
    try {
      const res = await fetch('/api/bulk-calls/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadIds: Array.from(selected),
          script: script || undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setLastResult(data.data);
        setSelected(new Set());
        setScript('');
        loadHistory();
      }
    } catch (err) {
      console.error('Failed to initiate calls:', err);
    } finally {
      setCalling(false);
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bulk Outbound Calls</h1>
          <p className="text-gray-500 mt-1">Select leads and initiate calls in batch</p>
        </div>
        <div className="text-sm text-gray-500">
          {selected.size} leads selected
        </div>
      </div>

      {/* Call Script */}
      <div className="bg-white rounded-lg border p-4 mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Call Script (optional)</label>
        <textarea
          value={script}
          onChange={e => setScript(e.target.value)}
          placeholder="Enter a call script/prompt to display during calls..."
          className="w-full px-3 py-2 border rounded-lg text-sm"
          rows={3}
        />
      </div>

      {/* Batch Result */}
      {lastResult && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <h3 className="font-bold text-green-800 mb-2">✅ Batch Initiated</h3>
          <div className="grid grid-cols-4 gap-4 text-sm">
            <div><span className="text-gray-600">Total:</span> {lastResult.totalRequested}</div>
            <div><span className="text-green-600">Initiated:</span> {lastResult.initiated}</div>
            <div><span className="text-red-600">Failed:</span> {lastResult.failed}</div>
            <div><span className="text-gray-600">Batch ID:</span> <code className="text-xs">{lastResult.batchId.slice(0, 20)}...</code></div>
          </div>
          <div className="mt-3">
            {lastResult.calls.map(c => (
              <div key={c.leadId} className="text-sm flex items-center gap-2">
                <span>{c.status === 'INITIATED' ? '✅' : '❌'}</span>
                <span>{c.leadName}</span>
                <span className="text-gray-500">{c.phone}</span>
                {c.error && <span className="text-red-500 text-xs">({c.error})</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dialer Queue */}
      <div className="bg-white rounded-lg border overflow-hidden mb-6">
        <div className="px-4 py-3 bg-gray-50 border-b flex items-center justify-between">
          <h2 className="font-medium text-gray-900">📞 Dialer Queue ({queue.length} leads)</h2>
          <div className="flex gap-2">
            <button onClick={selectAll} className="px-3 py-1 text-sm bg-gray-200 rounded hover:bg-gray-300">
              {selected.size === queue.length ? 'Deselect All' : 'Select All'}
            </button>
            <button
              onClick={initiateCalls}
              disabled={selected.size === 0 || calling}
              className="px-4 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {calling ? '📞 Calling...' : `📞 Call ${selected.size} Leads`}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading queue...</div>
        ) : queue.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No leads in the dialer queue.</div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 w-10">
                  <input type="checkbox" checked={selected.size === queue.length && queue.length > 0} onChange={selectAll} />
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Name</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Phone</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Company</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Score</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Status</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Last Contact</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {queue.map(lead => (
                <tr key={lead.id} className={`hover:bg-gray-50 ${selected.has(lead.id) ? 'bg-blue-50' : ''}`}>
                  <td className="px-4 py-3">
                    <input type="checkbox" checked={selected.has(lead.id)} onChange={() => toggleSelect(lead.id)} />
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">{lead.name}</td>
                  <td className="px-4 py-3 text-sm font-mono">{lead.phone}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{lead.company || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-sm font-medium ${lead.score >= 80 ? 'text-green-600' : lead.score >= 50 ? 'text-yellow-600' : 'text-gray-600'}`}>
                      {lead.score}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 bg-gray-100 rounded text-xs">{lead.status}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {lead.lastContactedAt ? new Date(lead.lastContactedAt).toLocaleDateString() : 'Never'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Recent History */}
      {history.length > 0 && (
        <div className="bg-white rounded-lg border overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b">
            <h2 className="font-medium text-gray-900">📋 Recent Batches</h2>
          </div>
          <div className="divide-y divide-gray-200">
            {history.slice(0, 10).map((call: any) => (
              <div key={call.id} className="px-4 py-3 flex items-center justify-between text-sm">
                <div>
                  <span className="font-medium">{call.toNumber}</span>
                  <span className="text-gray-500 ml-2">{call.notes?.slice(0, 50)}</span>
                </div>
                <div className="text-gray-500">{new Date(call.createdAt).toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
