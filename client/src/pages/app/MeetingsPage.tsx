import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Calendar, Plus, Clock, CheckCircle, XCircle, AlertTriangle, Video } from 'lucide-react';

interface Meeting {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  meetingType: string;
  startAt: string;
  endAt: string;
  durationMinutes: number;
  meetingUrl?: string | null;
  summary?: string | null;
  lead?: { id: string; name: string } | null;
}

const STATUS_META: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  SCHEDULED: { label: 'Scheduled', color: 'bg-blue-100 text-blue-700', icon: <Calendar className="h-3 w-3" /> },
  COMPLETED: { label: 'Completed', color: 'bg-emerald-100 text-emerald-700', icon: <CheckCircle className="h-3 w-3" /> },
  CANCELLED: { label: 'Cancelled', color: 'bg-slate-100 text-slate-600', icon: <XCircle className="h-3 w-3" /> },
  NO_SHOW: { label: 'No Show', color: 'bg-red-100 text-red-700', icon: <AlertTriangle className="h-3 w-3" /> },
};

export function MeetingsPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [view, setView] = useState<'upcoming' | 'past' | 'all'>('upcoming');
  const [form, setForm] = useState({ title: '', description: '', startAt: '', endAt: '', meetingUrl: '', prepNotes: '' });

  const { data, isLoading } = useQuery<{ meetings: Meeting[] }>({
    queryKey: ['meetings', view],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (view === 'upcoming') params.set('from', new Date().toISOString());
      if (view === 'past') params.set('to', new Date().toISOString());
      params.set('status', view === 'upcoming' ? 'SCHEDULED' : '');
      return api<{ meetings: Meeting[] }>(`/meetings?${params}`);
    },
  });

  const createMutation = useMutation({
    mutationFn: async (input: typeof form) => api<{ meeting: Meeting }>('/meetings', {
      method: 'POST',
      body: {
        title: input.title,
        description: input.description || undefined,
        startAt: input.startAt,
        endAt: input.endAt,
        meetingUrl: input.meetingUrl || undefined,
        prepNotes: input.prepNotes || undefined,
      },
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
      setShowForm(false);
      setForm({ title: '', description: '', startAt: '', endAt: '', meetingUrl: '', prepNotes: '' });
    },
  });

  const completeMutation = useMutation({
    mutationFn: async ({ id, summary }: { id: string; summary?: string }) =>
      api<{ meeting: Meeting }>(`/meetings/${id}/complete`, { method: 'POST', body: { summary } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['meetings'] }),
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => api<{ meeting: Meeting }>(`/meetings/${id}/cancel`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['meetings'] }),
  });

  const meetings = data?.meetings || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Meetings</h1>
          <p className="text-sm text-slate-500">Schedule and manage sales meetings</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="mr-2 h-4 w-4" /> New Meeting
        </Button>
      </div>

      <div className="flex gap-2">
        {(['upcoming', 'past', 'all'] as const).map((v) => (
          <button key={v} onClick={() => setView(v)} className={`rounded-full px-4 py-1.5 text-sm font-medium ${view === v ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            {v.charAt(0).toUpperCase() + v.slice(1)}
          </button>
        ))}
      </div>

      {showForm && (
        <div className="rounded-lg border bg-white p-4 space-y-3">
          <h3 className="font-semibold">Schedule Meeting</h3>
          <Input placeholder="Meeting title" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} />
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-slate-500">Start</label>
              <Input type="datetime-local" value={form.startAt} onChange={(e) => setForm((p) => ({ ...p, startAt: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">End</label>
              <Input type="datetime-local" value={form.endAt} onChange={(e) => setForm((p) => ({ ...p, endAt: e.target.value }))} />
            </div>
          </div>
          <Input placeholder="Meeting URL (optional)" value={form.meetingUrl} onChange={(e) => setForm((p) => ({ ...p, meetingUrl: e.target.value }))} />
          <textarea placeholder="Prep notes (optional)" value={form.prepNotes} onChange={(e) => setForm((p) => ({ ...p, prepNotes: e.target.value }))} className="w-full rounded-md border px-3 py-2 text-sm" rows={2} />
          <div className="flex gap-2">
            <Button onClick={() => createMutation.mutate(form)} disabled={!form.title.trim() || !form.startAt || !form.endAt || createMutation.isPending}>Schedule</Button>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-lg bg-slate-100" />)}</div>
      ) : meetings.length === 0 ? (
        <div className="py-12 text-center text-slate-500">
          <Calendar className="mx-auto mb-2 h-8 w-8 text-slate-300" />
          <p>No {view} meetings.</p>
        </div>
      ) : (
        <div className="divide-y rounded-lg border">
          {meetings.map((m) => {
            const meta = STATUS_META[m.status] || STATUS_META.SCHEDULED;
            const startDate = new Date(m.startAt);
            return (
              <div key={m.id} className="flex items-center justify-between bg-white px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="text-center">
                    <p className="text-xs font-medium text-slate-500">{startDate.toLocaleDateString('en-US', { weekday: 'short' })}</p>
                    <p className="text-lg font-bold">{startDate.getDate()}</p>
                  </div>
                  <div>
                    <p className="font-medium">{m.title}</p>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Clock className="h-3 w-3" />
                      {startDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      <span>•</span>
                      <span>{m.durationMinutes}min</span>
                      {m.lead && <span>• {m.lead.name}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={meta.color}>{meta.label}</Badge>
                  {m.meetingUrl && (
                    <a href={m.meetingUrl} target="_blank" rel="noopener noreferrer" className="rounded p-1 text-blue-600 hover:bg-blue-50">
                      <Video className="h-4 w-4" />
                    </a>
                  )}
                  {m.status === 'SCHEDULED' && (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => completeMutation.mutate({ id: m.id })}>
                        <CheckCircle className="h-4 w-4 text-emerald-600" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => cancelMutation.mutate(m.id)}>
                        <XCircle className="h-4 w-4 text-red-500" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default MeetingsPage;
