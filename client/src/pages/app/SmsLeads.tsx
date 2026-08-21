/**
 * SMS Leads — inbound SMS messages that converted to leads.
 * Shows list of inbound SMS, stats, and call-ready leads.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface SmsMessage {
  id: string;
  fromNumber: string;
  toNumber: string | null;
  body: string;
  status: string;
  leadId: string | null;
  createdAt: string;
}

interface SmsStats {
  total: number;
  today: number;
  byStatus: Record<string, number>;
}

export default function SmsLeads() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<SmsMessage[]>([]);
  const [stats, setStats] = useState<SmsStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('');

  useEffect(() => {
    loadData();
  }, [filter]);

  async function loadData() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter) params.set('status', filter);
      const [smsRes, statsRes] = await Promise.all([
        fetch(`/api/sms?${params}`),
        fetch('/api/sms/stats'),
      ]);
      const smsData = await smsRes.json();
      const statsData = await statsRes.json();
      setMessages(smsData.data?.messages || []);
      setStats(statsData.data || null);
    } catch (err) {
      console.error('Failed to load SMS data:', err);
    } finally {
      setLoading(false);
    }
  }

  function getStatusColor(status: string) {
    switch (status) {
      case 'LEAD_CREATED': return 'bg-green-100 text-green-800';
      case 'OPTED_OUT': return 'bg-red-100 text-red-800';
      case 'DUPLICATE': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">SMS Lead Generation</h1>
          <p className="text-gray-500 mt-1">Inbound SMS messages converted to leads</p>
        </div>
        <div className="flex gap-2">
          <a href="/api/sms/call-ready" target="_blank" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
            📞 Call-Ready Leads
          </a>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg border">
            <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
            <div className="text-sm text-gray-500">Total SMS</div>
          </div>
          <div className="bg-white p-4 rounded-lg border">
            <div className="text-2xl font-bold text-blue-600">{stats.today}</div>
            <div className="text-sm text-gray-500">Today</div>
          </div>
          <div className="bg-white p-4 rounded-lg border">
            <div className="text-2xl font-bold text-green-600">{stats.byStatus?.LEAD_CREATED || 0}</div>
            <div className="text-sm text-gray-500">Leads Created</div>
          </div>
          <div className="bg-white p-4 rounded-lg border">
            <div className="text-2xl font-bold text-red-600">{stats.byStatus?.OPTED_OUT || 0}</div>
            <div className="text-sm text-gray-500">Opted Out</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 mb-4">
        {['', 'LEAD_CREATED', 'DUPLICATE', 'OPTED_OUT', 'RECEIVED'].map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-sm ${filter === s ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      {/* Messages Table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : messages.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No SMS messages yet. Configure your SMS provider webhook to /webhooks/sms</div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">From</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Message</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Lead</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {messages.map(msg => (
                <tr key={msg.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-mono">{msg.fromNumber}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 max-w-xs truncate">{msg.body}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(msg.status)}`}>
                      {msg.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {msg.leadId ? (
                      <button onClick={() => navigate(`/app/leads/${msg.leadId}`)} className="text-blue-600 hover:underline text-sm">
                        View Lead →
                      </button>
                    ) : (
                      <span className="text-gray-400 text-sm">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {new Date(msg.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
