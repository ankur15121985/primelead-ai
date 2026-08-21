import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Phone, PhoneOutgoing, PhoneIncoming, Clock, User, Plus, Trash2, TrendingUp } from 'lucide-react';

interface Call {
  id: string;
  leadId?: string | null;
  contactId?: string | null;
  direction: string;
  status: string;
  fromNumber?: string | null;
  toNumber?: string | null;
  durationSeconds: number;
  disposition?: string | null;
  notes?: string | null;
  sentiment?: string | null;
  createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  CONNECTED: 'bg-emerald-100 text-emerald-700',
  NO_ANSWER: 'bg-amber-100 text-amber-700',
  BUSY: 'bg-orange-100 text-orange-700',
  VOICEMAIL: 'bg-blue-100 text-blue-700',
  FAILED: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-slate-100 text-slate-600',
};

const DISPOSITIONS = [
  'CONNECTED', 'LEFT_VOICEMAIL', 'CALLBACK', 'NOT_INTERESTED', 'INTERESTED',
  'MEETING_BOOKED', 'DO_NOT_CALL', 'WRONG_NUMBER',
];

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function Calls() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [form, setForm] = useState({
    leadId: '', contactId: '', direction: 'OUTBOUND', status: 'CONNECTED',
    fromNumber: '', toNumber: '', durationSeconds: 0, disposition: '', notes: '',
  });

  const { data, isLoading } = useQuery<{ calls: Call[] }>({
    queryKey: ['calls', statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      return api<{ calls: Call[] }>(`/calls?${params}`);
    },
  });

  const { data: stats } = useQuery<{ stats: { total: number; connectionRate: number; avgDurationSeconds: number; byDisposition: Record<string, number> } }>({
    queryKey: ['call-stats'],
    queryFn: async () => api<{ stats: any }>('/calls/stats'),
  });

  const createMutation = useMutation({
    mutationFn: async (input: typeof form) => api<{ call: Call }>('/calls', {
      method: 'POST',
      body: {
        ...input,
        leadId: input.leadId || undefined,
        contactId: input.contactId || undefined,
        disposition: input.disposition || undefined,
        durationSeconds: Number(input.durationSeconds),
      },
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calls'] });
      queryClient.invalidateQueries({ queryKey: ['call-stats'] });
      setShowForm(false);
      setForm({ leadId: '', contactId: '', direction: 'OUTBOUND', status: 'CONNECTED', fromNumber: '', toNumber: '', durationSeconds: 0, disposition: '', notes: '' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api<{ deleted: boolean }>(`/calls/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['calls'] }),
  });

  const calls = data?.calls || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Calls</h1>
          <p className="text-sm text-slate-500">Log and track phone calls with prospects</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="mr-2 h-4 w-4" /> Log Call
        </Button>
      </div>

      {stats?.stats && (
        <div className="grid gap-4 sm:grid-cols-4">
          <StatCard icon={<Phone />} label="Total Calls" value={stats.stats.total} />
          <StatCard icon={<TrendingUp />} label="Connection Rate" value={`${stats.stats.connectionRate}%`} />
          <StatCard icon={<Clock />} label="Avg Duration" value={formatDuration(stats.stats.avgDurationSeconds)} />
          <StatCard icon={<PhoneOutgoing />} label="Meetings Booked" value={stats.stats.byDisposition?.MEETING_BOOKED || 0} />
        </div>
      )}

      {showForm && (
        <div className="rounded-lg border bg-white p-4 space-y-3">
          <h3 className="font-semibold">Log New Call</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <select value={form.direction} onChange={(e) => setForm((p) => ({ ...p, direction: e.target.value }))} className="rounded-md border px-3 py-1.5 text-sm">
              <option value="OUTBOUND">Outbound</option>
              <option value="INBOUND">Inbound</option>
            </select>
            <select value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))} className="rounded-md border px-3 py-1.5 text-sm">
              {Object.keys(STATUS_COLORS).map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
            </select>
            <select value={form.disposition} onChange={(e) => setForm((p) => ({ ...p, disposition: e.target.value }))} className="rounded-md border px-3 py-1.5 text-sm">
              <option value="">Disposition...</option>
              {DISPOSITIONS.map((d) => <option key={d} value={d}>{d.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Input placeholder="From number" value={form.fromNumber} onChange={(e) => setForm((p) => ({ ...p, fromNumber: e.target.value }))} />
            <Input placeholder="To number" value={form.toNumber} onChange={(e) => setForm((p) => ({ ...p, toNumber: e.target.value }))} />
            <Input type="number" placeholder="Duration (seconds)" value={form.durationSeconds} onChange={(e) => setForm((p) => ({ ...p, durationSeconds: Number(e.target.value) }))} />
          </div>
          <textarea placeholder="Notes..." value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} className="w-full rounded-md border px-3 py-2 text-sm" rows={2} />
          <div className="flex gap-2">
            <Button onClick={() => createMutation.mutate(form)} disabled={createMutation.isPending}>Log Call</Button>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        {['', ...Object.keys(STATUS_COLORS)].map((s) => (
          <button key={s} onClick={() => setStatusFilter(s)} className={`rounded-full px-3 py-1 text-xs font-medium ${statusFilter === s ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            {s ? s.replace(/_/g, ' ') : 'All'}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-14 animate-pulse rounded-lg bg-slate-100" />)}</div>
      ) : calls.length === 0 ? (
        <div className="py-12 text-center text-slate-500">
          <Phone className="mx-auto mb-2 h-8 w-8 text-slate-300" />
          <p>No calls logged yet.</p>
        </div>
      ) : (
        <div className="divide-y rounded-lg border">
          {calls.map((call) => (
            <div key={call.id} className="flex items-center justify-between bg-white px-4 py-3">
              <div className="flex items-center gap-3">
                {call.direction === 'OUTBOUND' ? <PhoneOutgoing className="h-4 w-4 text-blue-600" /> : <PhoneIncoming className="h-4 w-4 text-emerald-600" />}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{call.toNumber || call.fromNumber || 'Unknown'}</span>
                    <Badge className={STATUS_COLORS[call.status] || 'bg-slate-100'}>{call.status.replace(/_/g, ' ')}</Badge>
                    {call.disposition && <Badge tone="muted">{call.disposition.replace(/_/g, ' ')}</Badge>}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span>{formatDuration(call.durationSeconds)}</span>
                    <span>{new Date(call.createdAt).toLocaleDateString()}</span>
                    {call.sentiment && <span>Sentiment: {call.sentiment}</span>}
                  </div>
                </div>
              </div>
              <button onClick={() => { if (confirm('Delete this call?')) deleteMutation.mutate(call.id); }} className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="flex items-center gap-2"><span className="text-slate-400">{icon}</span><span className="text-xs text-slate-500">{label}</span></div>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}

export default Calls;
