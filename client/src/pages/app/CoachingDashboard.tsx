import { useState, useEffect, useCallback } from 'react';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Skeleton } from '../../components/ui/skeleton';

interface CoachingInsight {
  id: string;
  userId: string;
  user?: { id: string; name: string; email: string };
  period: string;
  periodType: string;
  activityScore: number;
  callMetrics: { made: number; connected: number; avgDuration: number; bookings: number };
  emailMetrics: { sent: number; opened: number; replied: number; positiveReplies: number };
  meetingMetrics: { held: number; noShows: number; conversionRate: number };
  pipelineMetrics: { created: number; value: number; won: number; winRate: number };
  strengths: string;
  improvements: string;
  recommendations: string;
  summary?: string;
  createdAt: string;
}

function parseJsonArray(s: string | null | undefined): string[] {
  if (!s) return [];
  try { return JSON.parse(s); } catch { return []; }
}

function getScoreColor(score: number): string {
  if (score >= 70) return 'text-green-600';
  if (score >= 40) return 'text-yellow-600';
  return 'text-red-600';
}

function getScoreBadge(score: number): 'success' | 'warning' | 'danger' {
  if (score >= 70) return 'success' as const;
  if (score >= 40) return 'warning' as const;
  return 'danger' as const;
}

function getCurrentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function CoachingDashboard() {
  const [insights, setInsights] = useState<CoachingInsight[]>([]);
  const [teamSummary, setTeamSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [tab, setTab] = useState<'team' | 'my' | 'generate'>('team');
  const [selectedInsight, setSelectedInsight] = useState<CoachingInsight | null>(null);
  const [genForm, setGenForm] = useState({ userId: '', period: getCurrentPeriod(), periodType: 'MONTH' as const });

  const loadTeam = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<{ summary: any }>('/coaching/summary', { method: 'GET' });
      setTeamSummary(data.summary);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  const loadMy = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<{ insights: CoachingInsight[] }>('/coaching/me');
      setInsights(data.insights || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  const loadInsights = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<{ insights: CoachingInsight[] }>('/coaching/insights');
      setInsights(data.insights || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (tab === 'team') loadTeam();
    else if (tab === 'my') loadMy();
    else loadInsights();
  }, [tab, loadTeam, loadMy, loadInsights]);

  const generateInsight = async () => {
    if (!genForm.userId || !genForm.period) return;
    setGenerating(true);
    try {
      const data = await api<{ insight: CoachingInsight }>('/coaching/generate', {
        body: genForm,
      });
      setInsights((prev) => [data.insight, ...prev.filter((i) => !(i.userId === genForm.userId && i.period === genForm.period))]);
      setTab('team');
    } catch { /* ignore */ }
    setGenerating(false);
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sales Coaching</h1>
          <p className="text-sm text-gray-500 mt-1">Rep performance metrics, AI insights, and coaching recommendations</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {(['team', 'my', 'generate'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t === 'team' ? 'Team Overview' : t === 'my' ? 'My Insights' : 'Generate Insight'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full" />)}</div>
      ) : (
        <>
          {/* Team Overview */}
          {tab === 'team' && teamSummary && (
            <div className="space-y-4">
              {/* Summary cards */}
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-white border rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-gray-900">{teamSummary.repCount}</div>
                  <div className="text-sm text-gray-500">Reps</div>
                </div>
                <div className="bg-white border rounded-lg p-4 text-center">
                  <div className={`text-2xl font-bold ${getScoreColor(teamSummary.averageScore)}`}>{teamSummary.averageScore}</div>
                  <div className="text-sm text-gray-500">Avg Score</div>
                </div>
                <div className="bg-white border rounded-lg p-4 text-center">
                  <div className="text-lg font-bold text-green-600">{teamSummary.topPerformer?.name || '—'}</div>
                  <div className="text-sm text-gray-500">Top Performer ({teamSummary.topPerformer?.score || 0})</div>
                </div>
                <div className="bg-white border rounded-lg p-4 text-center">
                  <div className="text-lg font-bold text-red-600">{teamSummary.needsHelp?.length || 0}</div>
                  <div className="text-sm text-gray-500">Need Coaching</div>
                </div>
              </div>

              {/* Rep list */}
              <div className="border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Rep</th>
                      <th className="text-center px-4 py-3 font-medium text-gray-600">Score</th>
                      <th className="text-center px-4 py-3 font-medium text-gray-600">Calls</th>
                      <th className="text-center px-4 py-3 font-medium text-gray-600">Emails</th>
                      <th className="text-center px-4 py-3 font-medium text-gray-600">Meetings</th>
                      <th className="text-center px-4 py-3 font-medium text-gray-600">Pipeline</th>
                      <th className="text-center px-4 py-3 font-medium text-gray-600">Win Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(teamSummary.insights || []).map((insight: CoachingInsight) => (
                      <tr key={insight.id} className="border-t hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedInsight(selectedInsight?.id === insight.id ? null : insight)}>
                        <td className="px-4 py-3">
                          <div className="font-medium">{insight.user?.name || 'Unknown'}</div>
                          <div className="text-xs text-gray-400">{insight.period}</div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge tone={getScoreBadge(insight.activityScore)}>{insight.activityScore}</Badge>
                        </td>
                        <td className="px-4 py-3 text-center">{insight.callMetrics?.made || 0}</td>
                        <td className="px-4 py-3 text-center">{insight.emailMetrics?.sent || 0}</td>
                        <td className="px-4 py-3 text-center">{insight.meetingMetrics?.held || 0}</td>
                        <td className="px-4 py-3 text-center">₹{((insight.pipelineMetrics?.value || 0) / 100).toLocaleString()}</td>
                        <td className="px-4 py-3 text-center">{insight.pipelineMetrics?.winRate || 0}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Expanded insight detail */}
              {selectedInsight && (
                <div className="border-2 border-blue-200 rounded-xl p-4 bg-blue-50/30 space-y-3">
                  <h3 className="font-semibold text-gray-900">{selectedInsight.user?.name} — {selectedInsight.period}</h3>
                  {selectedInsight.summary && <p className="text-sm text-gray-700">{selectedInsight.summary}</p>}
                  <div className="grid grid-cols-2 gap-4">
                    {parseJsonArray(selectedInsight.strengths).length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-green-700 mb-1">Strengths</h4>
                        <ul className="text-sm space-y-1">{parseJsonArray(selectedInsight.strengths).map((s, i) => <li key={i} className="flex items-start gap-1"><span className="text-green-500 mt-0.5">✓</span>{s}</li>)}</ul>
                      </div>
                    )}
                    {parseJsonArray(selectedInsight.improvements).length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-red-700 mb-1">Areas to Improve</h4>
                        <ul className="text-sm space-y-1">{parseJsonArray(selectedInsight.improvements).map((s, i) => <li key={i} className="flex items-start gap-1"><span className="text-red-500 mt-0.5">△</span>{s}</li>)}</ul>
                      </div>
                    )}
                  </div>
                  {parseJsonArray(selectedInsight.recommendations).length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-blue-700 mb-1">Recommendations</h4>
                      <ul className="text-sm space-y-1">{parseJsonArray(selectedInsight.recommendations).map((s, i) => <li key={i} className="flex items-start gap-1"><span className="text-blue-500 mt-0.5">→</span>{s}</li>)}</ul>
                    </div>
                  )}
                </div>
              )}

              {teamSummary.needsHelp?.length > 0 && (
                <div className="border border-orange-200 rounded-xl p-4 bg-orange-50/30">
                  <h3 className="font-medium text-orange-700 mb-2">Reps Needing Coaching</h3>
                  <div className="space-y-2">
                    {teamSummary.needsHelp.map((rep: any, i: number) => (
                      <div key={i} className="flex items-center gap-3">
                        <Badge tone="danger">{rep.score}</Badge>
                        <span className="text-sm font-medium">{rep.name}</span>
                        {rep.improvements?.length > 0 && <span className="text-xs text-gray-500">— {rep.improvements[0]}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'team' && !teamSummary && (
            <div className="border-2 border-dashed border-gray-200 rounded-xl p-12 text-center text-gray-400">
              <div className="text-4xl mb-2">📊</div>
              <div>No coaching data yet. Generate insights for your team!</div>
            </div>
          )}

          {/* My Insights */}
          {tab === 'my' && (
            <div className="space-y-3">
              {insights.length === 0 ? (
                <div className="border-2 border-dashed border-gray-200 rounded-xl p-12 text-center text-gray-400">
                  <div className="text-4xl mb-2">🎯</div>
                  <div>No coaching insights yet</div>
                </div>
              ) : (
                insights.map((insight) => (
                  <div key={insight.id} className="border rounded-xl p-4 hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedInsight(selectedInsight?.id === insight.id ? null : insight)}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Badge tone={getScoreBadge(insight.activityScore)}>{insight.activityScore}</Badge>
                        <div>
                          <span className="font-medium">{insight.period}</span>
                          <span className="text-sm text-gray-500 ml-2">{insight.periodType}</span>
                        </div>
                      </div>
                      <div className="text-xs text-gray-400">
                        {insight.callMetrics?.made || 0} calls · {insight.emailMetrics?.sent || 0} emails · {insight.meetingMetrics?.held || 0} meetings
                      </div>
                    </div>
                    {insight.summary && selectedInsight?.id === insight.id && (
                      <div className="mt-3 text-sm text-gray-700">{insight.summary}</div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* Generate */}
          {tab === 'generate' && (
            <div className="max-w-md space-y-4">
              <p className="text-sm text-gray-600">Generate a coaching insight for a team member.</p>
              <input placeholder="User ID" value={genForm.userId} onChange={(e) => setGenForm((p) => ({ ...p, userId: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
              <input placeholder="Period (e.g. 2024-01)" value={genForm.period} onChange={(e) => setGenForm((p) => ({ ...p, period: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
              <select value={genForm.periodType} onChange={(e) => setGenForm((p) => ({ ...p, periodType: e.target.value as any }))} className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="MONTH">Monthly</option>
                <option value="WEEK">Weekly</option>
                <option value="QUARTER">Quarterly</option>
              </select>
              <Button onClick={generateInsight} disabled={generating || !genForm.userId}>
                {generating ? 'Generating...' : 'Generate Insight'}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default CoachingDashboard;
