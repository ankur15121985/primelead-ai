import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Shield, AlertTriangle, Clock, Mail, Copy, Trash2, RefreshCw, CheckCircle, XCircle } from 'lucide-react';

interface QualityReport {
  generatedAt: string;
  companies: { total: number; issues: number };
  contacts: { total: number; issues: number };
  summary: {
    duplicates: number;
    stale: number;
    missingFields: number;
    invalidEmails: number;
    unverified: number;
  };
}

interface DuplicateGroup {
  domain?: string;
  email?: string;
  count: number;
  items: { id: string; name?: string; firstName?: string; lastName?: string; email?: string; createdAt: string }[];
}

interface StaleRecord {
  id: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  domain?: string;
  updatedAt: string;
}

export function DataQuality() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'overview' | 'duplicates' | 'stale' | 'verification'>('overview');
  const [dupType, setDupType] = useState<'company' | 'contact'>('company');
  const [staleDays, setStaleDays] = useState(90);
  const [selectedForMerge, setSelectedForMerge] = useState<{ keepId: string; removeIds: string[] } | null>(null);

  const { data: report, isLoading: reportLoading, refetch: refetchReport } = useQuery<{ report: QualityReport }>({
    queryKey: ['data-quality-report'],
    queryFn: async () => api<{ report: QualityReport }>('/data-quality/report'),
  });

  const { data: dups } = useQuery<{ groups: DuplicateGroup[]; total: number }>({
    queryKey: ['data-quality-dups', dupType],
    queryFn: async () => api<{ groups: DuplicateGroup[]; total: number }>(`/data-quality/duplicates?type=${dupType}`),
    enabled: activeTab === 'duplicates',
  });

  const { data: stale } = useQuery<{ records: StaleRecord[]; total: number }>({
    queryKey: ['data-quality-stale', staleDays],
    queryFn: async () => api<{ records: StaleRecord[]; total: number }>(`/data-quality/stale?days=${staleDays}&type=contact`),
    enabled: activeTab === 'stale',
  });

  const mergeMutation = useMutation({
    mutationFn: async (input: { entityType: string; keepId: string; removeIds: string[] }) =>
      api<{ merged: boolean }>(`/data-quality/merge`, { method: 'POST', body: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['data-quality'] });
      setSelectedForMerge(null);
    },
  });

  const r = report?.report;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Data Quality</h1>
          <p className="text-sm text-slate-500">Monitor and clean your company and contact data</p>
        </div>
        <Button variant="outline" onClick={() => refetchReport()} disabled={reportLoading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${reportLoading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {/* Overview Cards */}
      {r && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard icon={<Copy />} label="Duplicates" value={r.summary.duplicates} color="text-red-600" bg="bg-red-50" />
          <StatCard icon={<Clock />} label="Stale Records" value={r.summary.stale} color="text-amber-600" bg="bg-amber-50" />
          <StatCard icon={<AlertTriangle />} label="Missing Fields" value={r.summary.missingFields} color="text-orange-600" bg="bg-orange-50" />
          <StatCard icon={<Mail />} label="Unverified" value={r.summary.unverified} color="text-blue-600" bg="bg-blue-50" />
          <StatCard icon={<Shield />} label="Total Issues" value={r.companies.issues + r.contacts.issues} color="text-slate-700" bg="bg-slate-50" />
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {(['overview', 'duplicates', 'stale', 'verification'] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${activeTab === tab ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && r && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-lg border bg-white p-4">
            <h3 className="mb-3 font-semibold">Companies</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span>Total companies</span><span className="font-medium">{r.companies.total}</span></div>
              <div className="flex justify-between"><span>With issues</span><span className="font-medium text-amber-600">{r.companies.issues}</span></div>
              <div className="flex justify-between"><span>Quality score</span><span className={`font-medium ${r.companies.issues === 0 ? 'text-emerald-600' : 'text-amber-600'}`}>{r.companies.total > 0 ? Math.round(((r.companies.total - r.companies.issues) / r.companies.total) * 100) : 100}%</span></div>
            </div>
          </div>
          <div className="rounded-lg border bg-white p-4">
            <h3 className="mb-3 font-semibold">Contacts</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span>Total contacts</span><span className="font-medium">{r.contacts.total}</span></div>
              <div className="flex justify-between"><span>With issues</span><span className="font-medium text-amber-600">{r.contacts.issues}</span></div>
              <div className="flex justify-between"><span>Quality score</span><span className={`font-medium ${r.contacts.issues === 0 ? 'text-emerald-600' : 'text-amber-600'}`}>{r.contacts.total > 0 ? Math.round(((r.contacts.total - r.contacts.issues) / r.contacts.total) * 100) : 100}%</span></div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'duplicates' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600">Showing:</span>
            <button onClick={() => setDupType('company')} className={`rounded-full px-3 py-1 text-xs font-medium ${dupType === 'company' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>Companies</button>
            <button onClick={() => setDupType('contact')} className={`rounded-full px-3 py-1 text-xs font-medium ${dupType === 'contact' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>Contacts</button>
          </div>

          {(!dups?.groups || dups.groups.length === 0) ? (
            <div className="py-8 text-center text-slate-500"><CheckCircle className="mx-auto mb-2 h-8 w-8 text-emerald-400" /><p>No duplicates found! 🎉</p></div>
          ) : (
            <div className="space-y-3">
              {dups.groups.map((group, i) => (
                <div key={i} className="rounded-lg border bg-white p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge tone="danger">{group.count} duplicates</Badge>
                      <span className="text-sm font-medium">{group.domain || group.email}</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {group.items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between rounded bg-slate-50 px-3 py-2">
                        <span className="text-sm">{item.name || [item.firstName, item.lastName].filter(Boolean).join(' ')}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-400">{new Date(item.createdAt).toLocaleDateString()}</span>
                          <button onClick={() => setSelectedForMerge({ keepId: item.id, removeIds: group.items.filter((g) => g.id !== item.id).map((g) => g.id) })} className="rounded bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700 hover:bg-emerald-100">
                            Keep this
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'stale' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600">Records not updated in</span>
            <select value={staleDays} onChange={(e) => setStaleDays(Number(e.target.value))} className="rounded border px-2 py-1 text-sm">
              <option value={30}>30 days</option>
              <option value={60}>60 days</option>
              <option value={90}>90 days</option>
              <option value={180}>180 days</option>
            </select>
          </div>

          {(!stale?.records || stale.records.length === 0) ? (
            <div className="py-8 text-center text-slate-500"><CheckCircle className="mx-auto mb-2 h-8 w-8 text-emerald-400" /><p>All records are up to date!</p></div>
          ) : (
            <div className="overflow-hidden rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Last Updated</th>
                    <th className="px-4 py-3">Age</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {stale.records.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium">{r.name || [r.firstName, r.lastName].filter(Boolean).join(' ')}</td>
                      <td className="px-4 py-3 text-slate-600">{r.email || r.domain || '—'}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{new Date(r.updatedAt).toLocaleDateString()}</td>
                      <td className="px-4 py-3"><Badge tone="warning">{Math.floor((Date.now() - new Date(r.updatedAt).getTime()) / 86400000)}d ago</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'verification' && (
        <div className="py-8 text-center text-slate-500">
          <Mail className="mx-auto mb-2 h-8 w-8 text-slate-300" />
          <p>Email verification is available in the Contacts section.</p>
          <p className="text-xs">Select contacts and use the "Verify" bulk action.</p>
        </div>
      )}

      {/* Merge Confirmation Dialog */}
      {selectedForMerge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-2 font-semibold">Merge Duplicates?</h3>
            <p className="mb-4 text-sm text-slate-600">
              Keep the selected record and soft-delete {selectedForMerge.removeIds.length} duplicate(s). This cannot be undone.
            </p>
            <div className="flex gap-2">
              <Button onClick={() => mergeMutation.mutate({ entityType: dupType, ...selectedForMerge })} disabled={mergeMutation.isPending}>
                {mergeMutation.isPending ? 'Merging...' : 'Merge'}
              </Button>
              <Button variant="outline" onClick={() => setSelectedForMerge(null)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, color, bg }: { icon: React.ReactNode; label: string; value: number; color: string; bg: string }) {
  return (
    <div className={`rounded-lg border bg-white p-4`}>
      <div className="flex items-center gap-2">
        <div className={`rounded-md p-1.5 ${bg} ${color}`}>{icon}</div>
        <span className="text-xs text-slate-500">{label}</span>
      </div>
      <p className={`mt-2 text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

export default DataQuality;
