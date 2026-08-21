import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { GitBranch, Plus, Trash2, Globe, Users, TrendingUp, Filter, Zap } from 'lucide-react';

export function InboundRouting() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'routing' | 'visitors'>('routing');
  const [showCreate, setShowCreate] = useState(false);
  const [newRule, setNewRule] = useState({ name: '', description: '', conditions: '{}', actions: '[]' });

  // Routing rules
  const { data: rulesData } = useQuery({
    queryKey: ['inbound-rules'],
    queryFn: async () => api('/api/inbound/rules') as any,
    enabled: tab === 'routing',
  });

  // Visitor stats
  const { data: visitorStats } = useQuery({
    queryKey: ['visitor-stats'],
    queryFn: async () => api('/api/inbound/visitors/stats') as any,
    enabled: tab === 'visitors',
  });

  // Visitor list
  const { data: visitorsData } = useQuery({
    queryKey: ['visitors'],
    queryFn: async () => api('/api/inbound/visitors?limit=50') as any,
    enabled: tab === 'visitors',
  });

  const createMut = useMutation({
    mutationFn: async () => {
      const conditions = JSON.parse(newRule.conditions || '{}');
      const actions = JSON.parse(newRule.actions || '[]');
      return api('/api/inbound/rules', { method: 'POST', body: JSON.stringify({ name: newRule.name, description: newRule.description, conditions, actions }) });
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['inbound-rules'] }); setShowCreate(false); },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => api(`/api/inbound/rules/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['inbound-rules'] }),
  });

  const rules: any[] = rulesData?.rules || [];
  const visitors: any[] = visitorsData?.visits || [];
  const stats = visitorStats?.stats;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-indigo-100 flex items-center justify-center">
          <GitBranch className="h-5 w-5 text-indigo-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Inbound & Visitors</h1>
          <p className="text-sm text-gray-500">Lead routing rules and website visitor tracking</p>
        </div>
      </div>

      <div className="flex gap-1 border-b">
        {([
          { key: 'routing', label: 'Routing Rules', icon: <GitBranch className="h-4 w-4" /> },
          { key: 'visitors', label: 'Website Visitors', icon: <Globe className="h-4 w-4" /> },
        ] as const).map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t.key ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Routing Rules Tab */}
      {tab === 'routing' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button variant="primary" onClick={() => setShowCreate(!showCreate)}><Plus className="h-4 w-4 mr-2" /> New Rule</Button>
          </div>

          {showCreate && (
            <Card>
              <CardHeader><CardTitle className="text-base">Create Routing Rule</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <input value={newRule.name} onChange={(e) => setNewRule({ ...newRule, name: e.target.value })} className="w-full px-3 py-2 border rounded-md text-sm" placeholder="Rule name" />
                  <input value={newRule.description} onChange={(e) => setNewRule({ ...newRule, description: e.target.value })} className="w-full px-3 py-2 border rounded-md text-sm" placeholder="Description (optional)" />
                  <div><label className="text-xs font-medium text-gray-500">Conditions (JSON)</label><textarea value={newRule.conditions} onChange={(e) => setNewRule({ ...newRule, conditions: e.target.value })} className="w-full mt-1 px-3 py-2 border rounded-md text-sm font-mono" rows={3} /></div>
                  <div><label className="text-xs font-medium text-gray-500">Actions (JSON array)</label><textarea value={newRule.actions} onChange={(e) => setNewRule({ ...newRule, actions: e.target.value })} className="w-full mt-1 px-3 py-2 border rounded-md text-sm font-mono" rows={3} /></div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
                    <Button variant="primary" onClick={() => createMut.mutate()} disabled={!newRule.name.trim()}>Create</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {rules.length === 0 ? (
            <Card><CardContent className="p-12 text-center"><GitBranch className="h-12 w-12 text-gray-300 mx-auto mb-4" /><h3 className="text-lg font-medium">No routing rules</h3><p className="text-gray-500 text-sm">Create rules to automatically route inbound leads.</p></CardContent></Card>
          ) : (
            rules.map((rule: any) => (
              <Card key={rule.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{rule.name}</div>
                      <div className="text-xs text-gray-500 mt-1">{rule.description || 'No description'} · Priority: {rule.priority} · Ran {rule.runCount}×</div>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge tone={rule.isActive ? 'success' : 'muted'}>{rule.isActive ? 'Active' : 'Paused'}</Badge>
                        {Object.keys(rule.conditions || {}).length > 0 && (
                          <span className="text-xs text-gray-500">When: {Object.entries(rule.conditions).map(([k, v]) => `${k}=${Array.isArray(v) ? v.join('|') : v}`).join(', ')}</span>
                        )}
                      </div>
                      {Array.isArray(rule.actions) && rule.actions.length > 0 && (
                        <div className="flex gap-1 mt-2">
                          {rule.actions.map((a: any, i: number) => <Badge key={i} tone="info">{a.type?.replace(/_/g, ' ')}</Badge>)}
                        </div>
                      )}
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => deleteMut.mutate(rule.id)} className="text-red-500"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Visitors Tab */}
      {tab === 'visitors' && (
        <div className="space-y-4">
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card><CardContent className="p-4 text-center"><div className="text-2xl font-bold text-indigo-600">{stats.totalVisits}</div><div className="text-xs text-gray-500">Total Visits</div></CardContent></Card>
              <Card><CardContent className="p-4 text-center"><div className="text-2xl font-bold text-blue-600">{stats.uniqueVisitors}</div><div className="text-xs text-gray-500">Unique Visitors</div></CardContent></Card>
              <Card><CardContent className="p-4 text-center"><div className="text-2xl font-bold text-green-600">{stats.identifiedVisits}</div><div className="text-xs text-gray-500">Identified</div></CardContent></Card>
              <Card><CardContent className="p-4 text-center"><div className="text-2xl font-bold text-orange-600">{stats.avgScore}</div><div className="text-xs text-gray-500">Avg Score</div></CardContent></Card>
            </div>
          )}

          {/* Top pages */}
          {stats?.byPage && stats.byPage.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Top Pages</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {stats.byPage.slice(0, 8).map((p: any) => (
                    <div key={p.url} className="flex items-center justify-between text-sm">
                      <span className="font-mono text-gray-600 truncate max-w-md">{p.url}</span>
                      <span className="font-medium">{p.visits} visits</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recent visitors */}
          <Card>
            <CardHeader><CardTitle className="text-base">Recent Visitors</CardTitle></CardHeader>
            <CardContent>
              {visitors.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">No visitors tracked yet. Add the tracking script to your website.</p>
              ) : (
                <div className="space-y-2">
                  {visitors.map((v: any) => (
                    <div key={v.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-sm">
                      <div>
                        <span className="font-medium">{v.pageUrl}</span>
                        <span className="text-xs text-gray-500 ml-2">{v.company?.name || v.anonymousId?.slice(0, 8)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge tone={v.visitScore >= 70 ? 'danger' : v.visitScore >= 40 ? 'warning' : 'muted'}>Score: {v.visitScore}</Badge>
                        <span className="text-xs text-gray-400">{new Date(v.visitedAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
