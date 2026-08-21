import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  BarChart3, TrendingUp, TrendingDown, Users, Mail, Phone, Calendar,
  Target, DollarSign, Activity, Briefcase
} from 'lucide-react';

const METRIC_CARDS = [
  { key: 'newLeads', label: 'New Leads', icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
  { key: 'wonLeads', label: 'Won Deals', icon: Target, color: 'text-green-600', bg: 'bg-green-50' },
  { key: 'totalRevenue', label: 'Revenue', icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50', prefix: '₹' },
  { key: 'pipelineValue', label: 'Pipeline', icon: Briefcase, color: 'text-purple-600', bg: 'bg-purple-50', prefix: '₹' },
  { key: 'openRate', label: 'Email Open Rate', icon: Mail, color: 'text-indigo-600', bg: 'bg-indigo-50', suffix: '%' },
  { key: 'replyRate', label: 'Reply Rate', icon: Mail, color: 'text-cyan-600', bg: 'bg-cyan-50', suffix: '%' },
  { key: 'connectionRate', label: 'Call Connect', icon: Phone, color: 'text-orange-600', bg: 'bg-orange-50', suffix: '%' },
  { key: 'winRate', label: 'Win Rate', icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50', suffix: '%' },
];

export function AnalyticsDashboard() {
  const [period, setPeriod] = useState(30);

  const { data: dashData, isLoading } = useQuery({
    queryKey: ['analytics-dashboard', period],
    queryFn: async () => api(`/api/analytics/dashboard?days=${period}`) as any,
  });

  const { data: repData } = useQuery({
    queryKey: ['analytics-reps', period],
    queryFn: async () => api(`/api/analytics/reps?days=${period}`) as any,
  });

  const { data: pipelineData } = useQuery({
    queryKey: ['analytics-pipeline'],
    queryFn: async () => api('/api/analytics/pipeline') as any,
  });

  const { data: forecastData } = useQuery({
    queryKey: ['analytics-forecast'],
    queryFn: async () => api('/api/analytics/forecast') as any,
  });

  const metrics = dashData?.metrics;
  const reps: any[] = repData?.performance || [];
  const pipeline = pipelineData?.analytics;
  const forecast = forecastData?.forecast;

  if (isLoading) return <div className="text-center py-12 text-gray-500">Loading analytics...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
            <BarChart3 className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Analytics Dashboard</h1>
            <p className="text-sm text-gray-500">Sales performance and pipeline insights</p>
          </div>
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {[7, 30, 90].map((d) => (
            <button key={d} onClick={() => setPeriod(d)} className={`px-3 py-1 text-sm rounded-md transition-colors ${period === d ? 'bg-white shadow text-gray-900 font-medium' : 'text-gray-500 hover:text-gray-700'}`}>
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* Metric cards */}
      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {METRIC_CARDS.map((mc) => {
            const Icon = mc.icon;
            const value = (metrics as any)[mc.key];
            return (
              <Card key={mc.key}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${mc.bg}`}><Icon className={`h-5 w-5 ${mc.color}`} /></div>
                    <div>
                      <div className="text-2xl font-bold">{mc.prefix || ''}{typeof value === 'number' ? value.toLocaleString() : value}{mc.suffix || ''}</div>
                      <div className="text-xs text-gray-500">{mc.label}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Revenue Forecast */}
      {forecast && (
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Revenue Forecast</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center"><div className="text-xl font-bold text-green-600">₹{forecast.commit?.toLocaleString()}</div><div className="text-xs text-gray-500">Commit</div></div>
              <div className="text-center"><div className="text-xl font-bold text-blue-600">₹{forecast.bestCase?.toLocaleString()}</div><div className="text-xs text-gray-500">Best Case</div></div>
              <div className="text-center"><div className="text-xl font-bold text-purple-600">₹{forecast.pipelineValue?.toLocaleString()}</div><div className="text-xs text-gray-500">Pipeline</div></div>
              <div className="text-center"><div className="text-xl font-bold">{forecast.historicalWinRate}%</div><div className="text-xs text-gray-500">Win Rate</div></div>
              <div className="text-center"><div className="text-xl font-bold">{forecast.openDeals}</div><div className="text-xs text-gray-500">Open Deals</div></div>
            </div>
            {forecast.risks && forecast.risks.length > 0 && (
              <div className="mt-4">
                <h4 className="text-xs font-medium text-gray-500 mb-2">Risky Deals</h4>
                <div className="space-y-1">
                  {forecast.risks.map((r: any) => (
                    <div key={r.id} className="text-sm flex items-center gap-2 p-2 bg-red-50 rounded">
                      <TrendingDown className="h-3 w-3 text-red-500" />
                      <span className="font-medium">{r.name}</span>
                      <span className="text-gray-500">₹{r.value.toLocaleString()}</span>
                      <span className="text-xs text-red-500">{r.reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Pipeline & Reps side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Rep Performance */}
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" /> Rep Performance</CardTitle></CardHeader>
          <CardContent>
            {reps.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No data</p>
            ) : (
              <div className="space-y-3">
                {reps.map((r: any) => (
                  <div key={r.userId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <div className="font-medium text-sm">{r.name}</div>
                      <div className="text-xs text-gray-500">{r.leads} leads · {r.calls} calls · {r.meetings} meetings</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-sm">₹{r.revenue.toLocaleString()}</div>
                      <div className="text-xs text-gray-500">{r.winRate}% win</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Source breakdown */}
        {metrics?.bySource && (
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Activity className="h-4 w-4" /> By Source</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {metrics.bySource.map((s: any) => {
                  const maxCount = Math.max(...metrics.bySource.map((x: any) => x.count), 1);
                  return (
                    <div key={s.source}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="font-medium">{s.source}</span>
                        <span className="text-gray-500">{s.count} leads · ₹{s.revenue.toLocaleString()}</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(s.count / maxCount) * 100}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Pipeline stages */}
      {pipeline?.pipelines && pipeline.pipelines.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Briefcase className="h-4 w-4" /> Pipeline Stages</CardTitle></CardHeader>
          <CardContent>
            {pipeline.pipelines.map((p: any) => (
              <div key={p.id} className="mb-4">
                <h4 className="text-sm font-medium mb-2">{p.name} — {p.totalDeals} deals, ₹{p.totalValue?.toLocaleString()}</h4>
                <div className="flex gap-2 overflow-x-auto">
                  {p.stages.map((s: any) => (
                    <div key={s.id} className="flex-shrink-0 p-3 bg-gray-50 rounded-lg text-center min-w-[120px]">
                      <div className="text-lg font-bold">{s.leads}</div>
                      <div className="text-xs text-gray-500 truncate">{s.name}</div>
                      <div className="text-xs text-gray-400">₹{s.value?.toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
