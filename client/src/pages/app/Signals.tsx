import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Zap, TrendingUp, DollarSign, Users, Briefcase, Building2, Newspaper, Plus } from 'lucide-react';

interface Signal {
  id: string;
  companyId?: string;
  type: string;
  title: string;
  description?: string | null;
  source: string;
  confidence: number;
  detectedAt: string;
}

const SIGNAL_TYPES = [
  { value: 'FUNDING', label: 'Funding', icon: DollarSign, color: 'text-emerald-600' },
  { value: 'HIRING', label: 'Hiring', icon: Users, color: 'text-blue-600' },
  { value: 'LEADERSHIP_CHANGE', label: 'Leadership', icon: Briefcase, color: 'text-purple-600' },
  { value: 'TECH_CHANGE', label: 'Tech Change', icon: Zap, color: 'text-amber-600' },
  { value: 'GROWTH', label: 'Growth', icon: TrendingUp, color: 'text-cyan-600' },
  { value: 'EXPANSION', label: 'Expansion', icon: Building2, color: 'text-indigo-600' },
  { value: 'NEWS', label: 'News', icon: Newspaper, color: 'text-rose-600' },
  { value: 'JOB_POSTING', label: 'Job Posting', icon: Briefcase, color: 'text-teal-600' },
];

export function Signals() {
  const queryClient = useQueryClient();
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [daysFilter, setDaysFilter] = useState(30);

  const { data, isLoading } = useQuery<{ signals: Signal[] }>({
    queryKey: ['signals', typeFilter, daysFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (typeFilter) params.set('type', typeFilter);
      params.set('days', String(daysFilter));
      return api<{ signals: Signal[] }>(`/signals/company?${params}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api<{ deleted: boolean }>(`/signals/company/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['signals'] }),
  });

  const signals = data?.signals || [];

  // Group by type
  const byType: Record<string, Signal[]> = {};
  for (const s of signals) {
    if (!byType[s.type]) byType[s.type] = [];
    byType[s.type].push(s);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Signals</h1>
          <p className="text-sm text-slate-500">Track company events and buying intent</p>
        </div>
      </div>

      {/* Signal Type Cards */}
      <div className="grid gap-3 sm:grid-cols-4">
        {SIGNAL_TYPES.map((st) => {
          const Icon = st.icon;
          const count = byType[st.value]?.length || 0;
          return (
            <button
              key={st.value}
              onClick={() => setTypeFilter(typeFilter === st.value ? '' : st.value)}
              className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                typeFilter === st.value ? 'border-blue-600 bg-blue-50' : 'bg-white hover:bg-slate-50'
              }`}
            >
              <Icon className={`h-5 w-5 ${st.color}`} />
              <div>
                <p className="text-sm font-medium">{st.label}</p>
                <p className="text-xs text-slate-500">{count} signals</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <select value={daysFilter} onChange={(e) => setDaysFilter(Number(e.target.value))} className="rounded-md border px-3 py-1.5 text-sm">
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
        {typeFilter && (
          <Button variant="ghost" size="sm" onClick={() => setTypeFilter('')}>Clear filter</Button>
        )}
      </div>

      {/* Signals List */}
      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-lg bg-slate-100" />)}</div>
      ) : signals.length === 0 ? (
        <div className="py-12 text-center text-slate-500">
          <Zap className="mx-auto mb-2 h-8 w-8 text-slate-300" />
          <p>No signals found for the selected period.</p>
        </div>
      ) : (
        <div className="divide-y rounded-lg border">
          {signals.map((signal) => {
            const st = SIGNAL_TYPES.find((s) => s.value === signal.type);
            const Icon = st?.icon || Zap;
            return (
              <div key={signal.id} className="flex items-start gap-3 bg-white px-4 py-3">
                <Icon className={`mt-0.5 h-5 w-5 ${st?.color || 'text-slate-400'}`} />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{signal.title}</p>
                    <Badge tone="muted">{signal.type}</Badge>
                  </div>
                  {signal.description && <p className="mt-1 text-sm text-slate-600">{signal.description}</p>}
                  <div className="mt-1 flex items-center gap-3 text-xs text-slate-400">
                    <span>Source: {signal.source}</span>
                    <span>Confidence: {Math.round(signal.confidence * 100)}%</span>
                    <span>{new Date(signal.detectedAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <button onClick={() => { if (confirm('Delete this signal?')) deleteMutation.mutate(signal.id); }} className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600">
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default Signals;
