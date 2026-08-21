import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Brain, Lightbulb, Building2, User, Trash2, Check, X, RefreshCw,
  TrendingUp, AlertTriangle, Target, Sparkles, Clock, BarChart3
} from 'lucide-react';

const TYPE_ICONS: Record<string, React.ReactNode> = {
  COMPANY_RESEARCH: <Building2 className="h-4 w-4" />,
  CONTACT_RESEARCH: <User className="h-4 w-4" />,
  DEAL_RESEARCH: <Target className="h-4 w-4" />,
  COMPETITOR_RESEARCH: <AlertTriangle className="h-4 w-4" />,
};

const TYPE_COLORS: Record<string, string> = {
  COMPANY_RESEARCH: 'bg-blue-100 text-blue-800',
  CONTACT_RESEARCH: 'bg-green-100 text-green-800',
  DEAL_RESEARCH: 'bg-purple-100 text-purple-800',
  COMPETITOR_RESEARCH: 'bg-orange-100 text-orange-800',
};

const LABEL_COLORS: Record<string, string> = {
  FACT: 'bg-green-100 text-green-700',
  INFERENCE: 'bg-yellow-100 text-yellow-700',
  AI_SUGGESTION: 'bg-purple-100 text-purple-700',
};

const REC_TYPE_ICONS: Record<string, React.ReactNode> = {
  NEXT_BEST_LEAD: <Target className="h-4 w-4" />,
  NEXT_BEST_ACTION: <TrendingUp className="h-4 w-4" />,
  DEAL_RISK: <AlertTriangle className="h-4 w-4" />,
  CROSS_SELL: <Sparkles className="h-4 w-4" />,
  UPSELL: <TrendingUp className="h-4 w-4" />,
  REACTIVATION: <RefreshCw className="h-4 w-4" />,
};

const PRIORITY_COLORS: Record<string, string> = {
  HIGH: 'bg-red-100 text-red-800',
  MEDIUM: 'bg-yellow-100 text-yellow-800',
  LOW: 'bg-gray-100 text-gray-800',
};

export function AiResearch() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'research' | 'recommendations' | 'usage'>('research');
  const [expandedReport, setExpandedReport] = useState<string | null>(null);
  const [expandedRec, setExpandedRec] = useState<string | null>(null);

  // Research reports
  const { data: reportsData, isLoading: reportsLoading } = useQuery({
    queryKey: ['ai-research-reports'],
    queryFn: async () => {
      const res = await api('/api/ai-research/reports');
      return res as any;
    },
    enabled: tab === 'research',
  });

  // Recommendations
  const { data: recsData, isLoading: recsLoading } = useQuery({
    queryKey: ['ai-recommendations'],
    queryFn: async () => {
      const res = await api('/api/ai-recommendations');
      return res as any;
    },
    enabled: tab === 'recommendations',
  });

  // Per-user usage
  const { data: usageData } = useQuery({
    queryKey: ['ai-usage-my'],
    queryFn: async () => {
      const res = await api('/api/ai-recommendations/usage/my');
      return res as any;
    },
    enabled: tab === 'usage',
  });

  // Global usage
  const { data: globalUsage } = useQuery({
    queryKey: ['ai-usage'],
    queryFn: async () => {
      const res = await api('/api/ai/usage');
      return res as any;
    },
    enabled: tab === 'usage',
  });

  // Generate recommendations
  const generateRecs = useMutation({
    mutationFn: async () => {
      return api('/api/ai-recommendations/generate', { method: 'POST', body: JSON.stringify({ limit: 10 }) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-recommendations'] });
    },
  });

  // Accept/dismiss recommendation
  const acceptRec = useMutation({
    mutationFn: async (id: string) => api(`/api/ai-recommendations/${id}/accept`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ai-recommendations'] }),
  });
  const dismissRec = useMutation({
    mutationFn: async (id: string) => api(`/api/ai-recommendations/${id}/dismiss`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ai-recommendations'] }),
  });

  // Delete report
  const deleteReport = useMutation({
    mutationFn: async (id: string) => api(`/api/ai-research/reports/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ai-research-reports'] }),
  });

  const reports: any[] = reportsData?.reports || [];
  const recommendations: any[] = recsData?.recommendations || [];
  const myUsage = usageData?.usage;
  const globalStats = globalUsage?.stats;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
            <Brain className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">AI Research & Intelligence</h1>
            <p className="text-sm text-gray-500">AI-powered company research, recommendations, and usage</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {([
          { key: 'research', label: 'Research Reports', icon: <Brain className="h-4 w-4" /> },
          { key: 'recommendations', label: 'Recommendations', icon: <Lightbulb className="h-4 w-4" /> },
          { key: 'usage', label: 'AI Usage', icon: <BarChart3 className="h-4 w-4" /> },
        ] as const).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key ? 'border-purple-500 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Research Tab */}
      {tab === 'research' && (
        <div className="space-y-4">
          {reportsLoading ? (
            <div className="text-center py-12 text-gray-500">Loading reports...</div>
          ) : reports.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Brain className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No research reports yet</h3>
                <p className="text-gray-500 mb-4">Generate AI research from company or contact detail pages.</p>
              </CardContent>
            </Card>
          ) : (
            reports.map((report: any) => {
              const isExpanded = expandedReport === report.id;
              const sections = (report.sections as any[]) || [];
              const sectionLabels = (report.sectionLabels as Record<string, string>) || {};

              return (
                <Card key={report.id}>
                  <CardHeader
                    className="cursor-pointer py-3"
                    onClick={() => setExpandedReport(isExpanded ? null : report.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${TYPE_COLORS[report.reportType] || 'bg-gray-100 text-gray-800'}`}>
                          {TYPE_ICONS[report.reportType] || <Brain className="h-4 w-4" />}
                        </div>
                        <div>
                          <CardTitle className="text-base">{report.title}</CardTitle>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge tone="info">{report.reportType.replace(/_/g, ' ')}</Badge>
                            <span className="text-xs text-gray-500">
                              Confidence: {Math.round(report.confidence * 100)}%
                            </span>
                            <span className="text-xs text-gray-500">
                              {new Date(report.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); deleteReport.mutate(report.id); }}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>

                  {isExpanded && (
                    <CardContent className="pt-0">
                      {report.summary && (
                        <p className="text-sm text-gray-700 mb-4 p-3 bg-gray-50 rounded-lg">{report.summary}</p>
                      )}

                      <div className="space-y-3">
                        {sections.map((section: any, i: number) => (
                          <div key={i} className="border rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-2">
                              <h4 className="text-sm font-medium">{section.title}</h4>
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${LABEL_COLORS[section.label] || 'bg-gray-100 text-gray-700'}`}>
                                {section.label}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600">{section.content}</p>
                          </div>
                        ))}
                      </div>

                      {report.sources && (report.sources as any[]).length > 0 && (
                        <div className="mt-4">
                          <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">Sources</h4>
                          <div className="space-y-1">
                            {(report.sources as any[]).map((source: any, i: number) => (
                              <div key={i} className="text-xs text-gray-600">
                                {source.url ? (
                                  <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                    {source.title || source.url}
                                  </a>
                                ) : (
                                  <span>{source.title}</span>
                                )}
                                {source.snippet && <span className="text-gray-400 ml-2">— {source.snippet.slice(0, 80)}</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  )}
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* Recommendations Tab */}
      {tab === 'recommendations' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button
              variant="primary"
              onClick={() => generateRecs.mutate()}
              disabled={generateRecs.isPending}
            >
              <Sparkles className="h-4 w-4 mr-2" />
              {generateRecs.isPending ? 'Generating...' : 'Generate Recommendations'}
            </Button>
          </div>

          {recsLoading ? (
            <div className="text-center py-12 text-gray-500">Loading recommendations...</div>
          ) : recommendations.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Lightbulb className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No recommendations yet</h3>
                <p className="text-gray-500 mb-4">Click "Generate" to get AI-powered next-best-action recommendations.</p>
              </CardContent>
            </Card>
          ) : (
            recommendations.map((rec: any) => {
              const isExpanded = expandedRec === rec.id;

              return (
                <Card key={rec.id} className={rec.status === 'ACCEPTED' ? 'border-green-200 bg-green-50/30' : rec.status === 'DISMISSED' ? 'opacity-60' : ''}>
                  <CardHeader
                    className="cursor-pointer py-3"
                    onClick={() => setExpandedRec(isExpanded ? null : rec.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${PRIORITY_COLORS[rec.priority] || 'bg-gray-100'}`}>
                          {REC_TYPE_ICONS[rec.type] || <Lightbulb className="h-4 w-4" />}
                        </div>
                        <div>
                          <CardTitle className="text-base">{rec.title}</CardTitle>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge tone={rec.priority === 'HIGH' ? 'danger' : rec.priority === 'MEDIUM' ? 'warning' : 'muted'}>
                              {rec.priority}
                            </Badge>
                            <Badge tone="info">{rec.type.replace(/_/g, ' ')}</Badge>
                            <span className="text-xs text-gray-500">
                              {Math.round(rec.confidence * 100)}% confidence
                            </span>
                            {rec.status !== 'PENDING' && (
                              <Badge tone={rec.status === 'ACCEPTED' ? 'success' : 'muted'}>
                                {rec.status}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      {rec.status === 'PENDING' && (
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => acceptRec.mutate(rec.id)}
                            className="text-green-600 hover:text-green-700"
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => dismissRec.mutate(rec.id)}
                            className="text-gray-500 hover:text-gray-700"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardHeader>

                  {isExpanded && (
                    <CardContent className="pt-0">
                      <p className="text-sm text-gray-700">{rec.reasoning}</p>
                      <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                        <span>Entity: {rec.entityType} ({rec.entityId?.slice(0, 8)}...)</span>
                        <span>{new Date(rec.createdAt).toLocaleDateString()}</span>
                        {rec.expiresAt && <span>Expires: {new Date(rec.expiresAt).toLocaleDateString()}</span>}
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* Usage Tab */}
      {tab === 'usage' && (
        <div className="space-y-6">
          {/* Global stats */}
          {globalStats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-purple-600">{globalStats.calls}</div>
                  <div className="text-xs text-gray-500">Total API Calls</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-blue-600">{(globalStats.totalTokens / 1000).toFixed(1)}K</div>
                  <div className="text-xs text-gray-500">Tokens Used</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-green-600">₹{globalStats.spentRupees?.toFixed(2) || '0'}</div>
                  <div className="text-xs text-gray-500">Total Spent</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    {globalStats.byCategory?.length || 0}
                  </div>
                  <div className="text-xs text-gray-500">Categories</div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Per-category breakdown */}
          {globalStats?.byCategory && globalStats.byCategory.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Usage by Category</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {globalStats.byCategory.map((cat: any) => {
                    const pct = globalStats.calls > 0 ? (cat.calls / globalStats.calls) * 100 : 0;
                    return (
                      <div key={cat.category}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="font-medium">{cat.category.replace(/_/g, ' ')}</span>
                          <span className="text-gray-500">{cat.calls} calls · {(cat.tokens / 1000).toFixed(1)}K tokens · ₹{cat.spentRupees?.toFixed(2) || '0'}</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-purple-500 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Per-user usage */}
          {myUsage && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Your Usage (This Month)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <div className="text-lg font-bold">{myUsage.calls}</div>
                    <div className="text-xs text-gray-500">API Calls</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold">{(myUsage.totalTokens / 1000).toFixed(1)}K</div>
                    <div className="text-xs text-gray-500">Tokens</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold">₹{(myUsage.spentPaise / 100).toFixed(2)}</div>
                    <div className="text-xs text-gray-500">Cost</div>
                  </div>
                </div>

                {myUsage.byCategory && myUsage.byCategory.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {myUsage.byCategory.map((cat: any) => (
                      <div key={cat.category} className="flex items-center justify-between text-sm p-2 bg-gray-50 rounded">
                        <span>{cat.category.replace(/_/g, ' ')}</span>
                        <span className="text-gray-500">{cat.calls} calls · ₹{(cat.spentPaise / 100).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
