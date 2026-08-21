import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Brain, TrendingUp, Phone, Calendar, AlertTriangle, CheckCircle, XCircle, Target } from 'lucide-react';

interface CoachingInsights {
  stats: {
    totalCalls: number;
    connectedCalls: number;
    connectionRate: number;
    meetingsBooked: number;
    bookingRate: number;
    totalMeetings: number;
    completedMeetings: number;
    avgCallDuration: number;
    sentimentBreakdown: { positive: number; neutral: number; negative: number };
  };
  insights: string[];
}

interface Analysis {
  id: string;
  type: string;
  summary?: string | null;
  topics?: string[] | null;
  objections?: { objection: string; response?: string; resolved?: boolean }[] | null;
  competitors?: string[] | null;
  buyingSignals?: string[] | null;
  sentiment?: string | null;
  riskLevel?: string | null;
  createdAt: string;
}

export function Intelligence() {
  const [activeTab, setActiveTab] = useState<'coaching' | 'analyses'>('coaching');

  const { data: coachingData, isLoading: coachingLoading } = useQuery<{ insights: CoachingInsights }>({
    queryKey: ['coaching'],
    queryFn: async () => {
      // Use current user ID — in real app, get from auth context
      return api<{ insights: CoachingInsights }>('/intelligence/coaching/me');
    },
  });

  const { data: analysesData, isLoading: analysesLoading } = useQuery<{ analyses: Analysis[] }>({
    queryKey: ['analyses'],
    queryFn: async () => api<{ analyses: Analysis[] }>('/intelligence'),
    enabled: activeTab === 'analyses',
  });

  const coaching = coachingData?.insights;
  const analyses = analysesData?.analyses || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Intelligence</h1>
        <p className="text-sm text-slate-500">Conversation insights, coaching, and analytics</p>
      </div>

      <div className="flex gap-1 border-b">
        {(['coaching', 'analyses'] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${activeTab === tab ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'coaching' && (
        <>
          {coachingLoading ? (
            <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-lg bg-slate-100" />)}</div>
          ) : coaching ? (
            <>
              <div className="grid gap-4 sm:grid-cols-4">
                <MetricCard icon={<Phone />} label="Total Calls" value={coaching.stats.totalCalls} />
                <MetricCard icon={<TrendingUp />} label="Connection Rate" value={`${coaching.stats.connectionRate}%`} color={coaching.stats.connectionRate >= 30 ? 'text-emerald-600' : 'text-amber-600'} />
                <MetricCard icon={<Calendar />} label="Meetings Booked" value={coaching.stats.meetingsBooked} />
                <MetricCard icon={<Target />} label="Booking Rate" value={`${coaching.stats.bookingRate}%`} color={coaching.stats.bookingRate >= 10 ? 'text-emerald-600' : 'text-amber-600'} />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border bg-white p-4">
                  <h3 className="mb-3 font-semibold">Sentiment Breakdown</h3>
                  <div className="space-y-2">
                    <SentimentBar label="Positive" count={coaching.stats.sentimentBreakdown.positive} total={coaching.stats.sentimentBreakdown.positive + coaching.stats.sentimentBreakdown.neutral + coaching.stats.sentimentBreakdown.negative} color="bg-emerald-500" />
                    <SentimentBar label="Neutral" count={coaching.stats.sentimentBreakdown.neutral} total={coaching.stats.sentimentBreakdown.positive + coaching.stats.sentimentBreakdown.neutral + coaching.stats.sentimentBreakdown.negative} color="bg-slate-400" />
                    <SentimentBar label="Negative" count={coaching.stats.sentimentBreakdown.negative} total={coaching.stats.sentimentBreakdown.positive + coaching.stats.sentimentBreakdown.neutral + coaching.stats.sentimentBreakdown.negative} color="bg-red-500" />
                  </div>
                </div>

                <div className="rounded-lg border bg-white p-4">
                  <h3 className="mb-3 font-semibold">Coaching Insights</h3>
                  {coaching.insights.length === 0 ? (
                    <p className="text-sm text-slate-500">No insights yet. Log more calls to generate coaching tips.</p>
                  ) : (
                    <ul className="space-y-2">
                      {coaching.insights.map((insight, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <Brain className="mt-0.5 h-4 w-4 text-purple-500 flex-shrink-0" />
                          {insight}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="py-12 text-center text-slate-500">
              <Brain className="mx-auto mb-2 h-8 w-8 text-slate-300" />
              <p>No coaching data available yet. Start logging calls.</p>
            </div>
          )}
        </>
      )}

      {activeTab === 'analyses' && (
        <>
          {analysesLoading ? (
            <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded-lg bg-slate-100" />)}</div>
          ) : analyses.length === 0 ? (
            <div className="py-12 text-center text-slate-500">
              <Brain className="mx-auto mb-2 h-8 w-8 text-slate-300" />
              <p>No conversation analyses yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {analyses.map((a) => (
                <div key={a.id} className="rounded-lg border bg-white p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge tone="muted">{a.type.replace(/_/g, ' ')}</Badge>
                      {a.sentiment && (
                        <Badge tone={a.sentiment === 'POSITIVE' ? 'success' : a.sentiment === 'NEGATIVE' ? 'danger' : 'muted'}>
                          {a.sentiment}
                        </Badge>
                      )}
                      {a.riskLevel && (
                        <Badge tone={a.riskLevel === 'HIGH' ? 'danger' : a.riskLevel === 'MEDIUM' ? 'warning' : 'success'}>
                          {a.riskLevel} risk
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs text-slate-400">{new Date(a.createdAt).toLocaleDateString()}</span>
                  </div>
                  {a.summary && <p className="text-sm text-slate-600 mb-2">{a.summary}</p>}
                  {a.topics && a.topics.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {a.topics.map((t) => <Badge key={t} tone="info">{t}</Badge>)}
                    </div>
                  )}
                  {a.objections && a.objections.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs font-medium text-slate-500 mb-1">Objections</p>
                      {a.objections.map((o, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          {o.resolved ? <CheckCircle className="h-3 w-3 text-emerald-500" /> : <XCircle className="h-3 w-3 text-red-500" />}
                          <span>{o.objection}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {a.competitors && a.competitors.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      <span className="text-xs text-slate-500">Competitors:</span>
                      {a.competitors.map((c) => <Badge key={c} tone="warning">{c}</Badge>)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function MetricCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number | string; color?: string }) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="flex items-center gap-2"><span className="text-slate-400">{icon}</span><span className="text-xs text-slate-500">{label}</span></div>
      <p className={`mt-2 text-2xl font-bold ${color || ''}`}>{value}</p>
    </div>
  );
}

function SentimentBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-slate-600">{label}</span>
        <span className="text-slate-400">{count} ({pct}%)</span>
      </div>
      <div className="h-2 rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default Intelligence;
