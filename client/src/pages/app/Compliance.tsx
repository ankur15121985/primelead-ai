import { useEffect, useState, useCallback } from 'react';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Skeleton } from '../../components/ui/skeleton';

interface ConsentRecord {
  id: string;
  type: string;
  status: string;
  source?: string;
  contactId?: string;
  grantedAt?: string;
  withdrawnAt?: string;
  createdAt: string;
}

interface SuppressionEntry {
  id: string;
  type: string;
  value: string;
  reason: string;
  isGlobal: boolean;
  expiresAt?: string;
  createdAt: string;
}

interface RetentionPolicy {
  id: string;
  name: string;
  entityType: string;
  retentionDays: number;
  autoDelete: boolean;
  isActive: boolean;
  lastRunAt?: string;
  recordsDeleted: number;
}

interface DataAccessRequest {
  id: string;
  type: string;
  status: string;
  contactEmail?: string;
  deadlineAt?: string;
  completedAt?: string;
  createdAt: string;
}

interface ComplianceDashboard {
  summary: {
    totalConsents: number;
    totalSuppressions: number;
    overdueDataRequests: number;
    activeRetentionPolicies: number;
  };
  dataRequests: { total: number; overdue: number; byType: Array<{ type: string; count: number }>; byStatus: Array<{ status: string; count: number }> };
  retentionPolicies: RetentionPolicy[];
  recentConsents: ConsentRecord[];
}

const TABS = ['Overview', 'Consent', 'Suppression', 'Retention', 'Data Requests'] as const;

const CONSENT_TYPES = [
  { value: 'MARKETING_EMAIL', label: 'Marketing Email' },
  { value: 'MARKETING_SMS', label: 'Marketing SMS' },
  { value: 'MARKETING_CALL', label: 'Marketing Call' },
  { value: 'DATA_PROCESSING', label: 'Data Processing' },
  { value: 'DATA_SHARING', label: 'Data Sharing' },
  { value: 'COOKIES', label: 'Cookies' },
  { value: 'THIRD_PARTY', label: 'Third-Party Sharing' },
];

const SUPPRESSION_TYPES = [
  { value: 'EMAIL', label: 'Email' },
  { value: 'EMAIL_DOMAIN', label: 'Email Domain' },
  { value: 'PHONE', label: 'Phone' },
  { value: 'IP', label: 'IP Address' },
  { value: 'CONTACT', label: 'Contact' },
  { value: 'DOMAIN', label: 'Domain' },
];

const SUPPRESSION_REASONS = [
  { value: 'UNSUBSCRIBE', label: 'Unsubscribe' },
  { value: 'BOUNCE', label: 'Bounce' },
  { value: 'SPAM_COMPLAINT', label: 'Spam Complaint' },
  { value: 'MANUAL', label: 'Manual' },
  { value: 'REGULATION', label: 'Regulation' },
  { value: 'DOMAIN_BLOCK', label: 'Domain Block' },
];

const ENTITY_TYPES = [
  'CONTACT', 'COMPANY', 'LEAD', 'CONVERSATION',
  'CALL_RECORDING', 'FORM_SUBMISSION', 'ACTIVITY', 'AUDIT_LOG',
];

const REQUEST_TYPES = [
  { value: 'ACCESS', label: 'Right to Access' },
  { value: 'DELETION', label: 'Right to Deletion' },
  { value: 'RECTIFICATION', label: 'Right to Rectification' },
  { value: 'PORTABILITY', label: 'Right to Portability' },
  { value: 'RESTRICTION', label: 'Right to Restriction' },
  { value: 'OBJECTION', label: 'Right to Object' },
];

function toneForStatus(status: string): 'success' | 'danger' | 'warning' | 'default' {
  if (['GRANTED', 'COMPLETED', 'SUCCESS'].includes(status)) return 'success' as const;
  if (['DENIED', 'FAILED', 'OVERDUE'].includes(status)) return 'danger' as const;
  if (['WITHDRAWN', 'EXPIRED'].includes(status)) return 'warning' as const;
  return 'default' as const;
}

function toneForType(type: string) {
  if (type.includes('EMAIL')) return 'info' as const;
  if (type.includes('PHONE') || type.includes('CALL')) return 'warning' as const;
  if (type.includes('DATA') || type.includes('PROCESSING')) return 'default' as const;
  return 'default' as const;
}

export function Compliance() {
  const [tab, setTab] = useState<string>('Overview');
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState<ComplianceDashboard | null>(null);
  const [consents, setConsents] = useState<ConsentRecord[]>([]);
  const [suppressions, setSuppressions] = useState<SuppressionEntry[]>([]);
  const [suppressionStats, setSuppressionStats] = useState<{ total: number; byType: Array<{ type: string; reason: string; count: number }> } | null>(null);
  const [dataRequests, setDataRequests] = useState<DataAccessRequest[]>([]);
  const [dataRequestStats, setDataRequestStats] = useState<{ total: number; overdue: number; byType: Array<{ type: string; count: number }>; byStatus: Array<{ status: string; count: number }> } | null>(null);

  // Form states
  const [showSuppressionForm, setShowSuppressionForm] = useState(false);
  const [suppressionForm, setSuppressionForm] = useState({ type: 'EMAIL', value: '', reason: 'MANUAL', isGlobal: false });
  const [showRetentionForm, setShowRetentionForm] = useState(false);
  const [retentionForm, setRetentionForm] = useState({ name: '', entityType: 'ACTIVITY', retentionDays: 30, autoDelete: false });
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [requestForm, setRequestForm] = useState({ type: 'ACCESS', contactEmail: '', description: '' });

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<{ dashboard: ComplianceDashboard }>('/compliance/dashboard');
      setDashboard(data.dashboard);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  const loadConsents = useCallback(async () => {
    try {
      const data = await api<{ records: ConsentRecord[] }>('/compliance/consent');
      setConsents(data.records);
    } catch { /* ignore */ }
  }, []);

  const loadSuppressions = useCallback(async () => {
    try {
      const [suppData, statsData] = await Promise.all([
        api<{ entries: SuppressionEntry[] }>('/compliance/suppression'),
        api<{ total: number; byType: Array<{ type: string; reason: string; count: number }> }>('/compliance/suppression/stats'),
      ]);
      setSuppressions(suppData.entries);
      setSuppressionStats(statsData);
    } catch { /* ignore */ }
  }, []);

  const loadDataRequests = useCallback(async () => {
    try {
      const [reqsData, statsData] = await Promise.all([
        api<{ requests: DataAccessRequest[] }>('/compliance/data-requests'),
        api<{ total: number; overdue: number; byType: Array<{ type: string; count: number }>; byStatus: Array<{ status: string; count: number }> }>('/compliance/data-requests/stats'),
      ]);
      setDataRequests(reqsData.requests);
      setDataRequestStats(statsData);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (tab === 'Overview') loadDashboard();
    if (tab === 'Consent') loadConsents();
    if (tab === 'Suppression') loadSuppressions();
    if (tab === 'Data Requests') loadDataRequests();
    if (tab === 'Retention' && dashboard) { /* loaded via dashboard */ }
  }, [tab, loadDashboard, loadConsents, loadSuppressions, loadDataRequests, dashboard]);

  const addSuppression = async () => {
    try {
      await api('/compliance/suppression', { method: 'POST', body: JSON.stringify(suppressionForm) });
      setShowSuppressionForm(false);
      setSuppressionForm({ type: 'EMAIL', value: '', reason: 'MANUAL', isGlobal: false });
      loadSuppressions();
    } catch (e: any) { alert(e.message || 'Failed to add suppression'); }
  };

  const addRetentionPolicy = async () => {
    try {
      await api('/compliance/retention', { method: 'POST', body: JSON.stringify(retentionForm) });
      setShowRetentionForm(false);
      setRetentionForm({ name: '', entityType: 'ACTIVITY', retentionDays: 30, autoDelete: false });
      loadDashboard();
    } catch (e: any) { alert(e.message || 'Failed to create policy'); }
  };

  const createDataRequest = async () => {
    try {
      await api('/compliance/data-requests', { method: 'POST', body: JSON.stringify(requestForm) });
      setShowRequestForm(false);
      setRequestForm({ type: 'ACCESS', contactEmail: '', description: '' });
      loadDataRequests();
    } catch (e: any) { alert(e.message || 'Failed to create request'); }
  };

  const runRetentionPolicy = async (id: string) => {
    try {
      await api(`/compliance/retention/${id}/run`, { method: 'POST' });
      loadDashboard();
    } catch (e: any) { alert(e.message || 'Failed to run policy'); }
  };

  // Fix tone for overdue badges
  const overdueTone = 'danger' as const;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Compliance Center</h1>
          <p className="text-sm text-muted-foreground">GDPR, CCPA, and data protection management</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b pb-1">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium rounded-t transition-colors ${
              tab === t ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === 'Overview' && (
        <div className="space-y-6">
          {loading ? <Skeleton className="h-24" /> : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Consent Records', value: dashboard?.summary.totalConsents ?? 0, color: 'text-blue-600' },
                { label: 'Suppressed Entries', value: dashboard?.summary.totalSuppressions ?? 0, color: 'text-orange-600' },
                { label: 'Overdue Data Requests', value: dashboard?.summary.overdueDataRequests ?? 0, color: 'text-red-600' },
                { label: 'Active Retention Policies', value: dashboard?.summary.activeRetentionPolicies ?? 0, color: 'text-green-600' },
              ].map((s) => (
                <div key={s.label} className="p-4 bg-card rounded-lg border">
                  <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                  <div className="text-sm text-muted-foreground">{s.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Data Request Stats */}
          {dataRequestStats && (
            <div className="p-4 bg-card rounded-lg border">
              <h3 className="font-semibold mb-3">Data Access Requests by Type</h3>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                {dataRequestStats.byType.map((r) => (
                  <div key={r.type} className="text-center p-2 bg-muted rounded">
                    <div className="font-bold">{r.count}</div>
                    <div className="text-xs text-muted-foreground">{r.type}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Consents */}
          {dashboard?.recentConsents && dashboard.recentConsents.length > 0 && (
            <div className="p-4 bg-card rounded-lg border">
              <h3 className="font-semibold mb-3">Recent Consent Changes</h3>
              <div className="space-y-2">
                {dashboard.recentConsents.slice(0, 5).map((c) => (
                  <div key={c.id} className="flex items-center justify-between p-2 bg-muted rounded text-sm">
                    <div className="flex items-center gap-2">
                      <Badge tone={toneForStatus(c.status)}>{c.status}</Badge>
                      <span className="font-medium">{c.type.replace(/_/g, ' ')}</span>
                    </div>
                    <span className="text-muted-foreground">{new Date(c.createdAt).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Consent Tab */}
      {tab === 'Consent' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold">Consent Records</h3>
          </div>
          {consents.length === 0 ? (
            <div className="text-center p-8 bg-card rounded-lg border text-muted-foreground">
              No consent records yet. Consent is recorded when contacts grant or withdraw permissions.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 font-medium">Type</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium">Source</th>
                    <th className="pb-2 font-medium">Granted</th>
                    <th className="pb-2 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {consents.map((c) => (
                    <tr key={c.id} className="border-b last:border-0">
                      <td className="py-2"><Badge tone={toneForType(c.type)}>{c.type.replace(/_/g, ' ')}</Badge></td>
                      <td className="py-2"><Badge tone={toneForStatus(c.status)}>{c.status}</Badge></td>
                      <td className="py-2 text-muted-foreground">{c.source || '—'}</td>
                      <td className="py-2 text-muted-foreground">{c.grantedAt ? new Date(c.grantedAt).toLocaleDateString() : '—'}</td>
                      <td className="py-2 text-muted-foreground">{new Date(c.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Suppression Tab */}
      {tab === 'Suppression' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold">Suppression List</h3>
            <Button size="sm" onClick={() => setShowSuppressionForm(true)}>Add Suppression</Button>
          </div>

          {suppressionStats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
              {suppressionStats.byType.slice(0, 8).map((r) => (
                <div key={`${r.type}-${r.reason}`} className="p-3 bg-card rounded border text-center">
                  <div className="text-lg font-bold">{r.count}</div>
                  <div className="text-xs text-muted-foreground">{r.type} — {r.reason.replace(/_/g, ' ')}</div>
                </div>
              ))}
            </div>
          )}

          {showSuppressionForm && (
            <div className="p-4 bg-card rounded-lg border space-y-3">
              <h4 className="font-medium">Add Suppression</h4>
              <div className="grid grid-cols-3 gap-3">
                <select className="border rounded px-2 py-1.5 text-sm" value={suppressionForm.type}
                  onChange={(e) => setSuppressionForm((p) => ({ ...p, type: e.target.value }))}>
                  {SUPPRESSION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <input className="border rounded px-2 py-1.5 text-sm" placeholder="Value (email, domain, etc.)"
                  value={suppressionForm.value}
                  onChange={(e) => setSuppressionForm((p) => ({ ...p, value: e.target.value }))} />
                <select className="border rounded px-2 py-1.5 text-sm" value={suppressionForm.reason}
                  onChange={(e) => setSuppressionForm((p) => ({ ...p, reason: e.target.value }))}>
                  {SUPPRESSION_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={addSuppression} disabled={!suppressionForm.value}>Add</Button>
                <Button size="sm" variant="outline" onClick={() => setShowSuppressionForm(false)}>Cancel</Button>
              </div>
            </div>
          )}

          {suppressions.length === 0 ? (
            <div className="text-center p-8 bg-card rounded-lg border text-muted-foreground">
              No suppressed entries. Add entries to block specific emails, domains, or phones from outreach.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 font-medium">Type</th>
                    <th className="pb-2 font-medium">Value</th>
                    <th className="pb-2 font-medium">Reason</th>
                    <th className="pb-2 font-medium">Global</th>
                    <th className="pb-2 font-medium">Added</th>
                  </tr>
                </thead>
                <tbody>
                  {suppressions.map((s) => (
                    <tr key={s.id} className="border-b last:border-0">
                      <td className="py-2"><Badge tone={toneForType(s.type)}>{s.type}</Badge></td>
                      <td className="py-2 font-mono text-xs">{s.value}</td>
                      <td className="py-2">{s.reason.replace(/_/g, ' ')}</td>
                      <td className="py-2">{s.isGlobal ? '✓' : '—'}</td>
                      <td className="py-2 text-muted-foreground">{new Date(s.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Retention Tab */}
      {tab === 'Retention' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold">Data Retention Policies</h3>
            <Button size="sm" onClick={() => setShowRetentionForm(true)}>Add Policy</Button>
          </div>

          {showRetentionForm && (
            <div className="p-4 bg-card rounded-lg border space-y-3">
              <h4 className="font-medium">Create Retention Policy</h4>
              <div className="grid grid-cols-3 gap-3">
                <input className="border rounded px-2 py-1.5 text-sm" placeholder="Policy name"
                  value={retentionForm.name}
                  onChange={(e) => setRetentionForm((p) => ({ ...p, name: e.target.value }))} />
                <select className="border rounded px-2 py-1.5 text-sm" value={retentionForm.entityType}
                  onChange={(e) => setRetentionForm((p) => ({ ...p, entityType: e.target.value }))}>
                  {ENTITY_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                </select>
                <input className="border rounded px-2 py-1.5 text-sm" type="number" placeholder="Days to keep"
                  value={retentionForm.retentionDays}
                  onChange={(e) => setRetentionForm((p) => ({ ...p, retentionDays: parseInt(e.target.value) || 0 }))} />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={addRetentionPolicy} disabled={!retentionForm.name || retentionForm.retentionDays <= 0}>Create</Button>
                <Button size="sm" variant="outline" onClick={() => setShowRetentionForm(false)}>Cancel</Button>
              </div>
            </div>
          )}

          {dashboard?.retentionPolicies && dashboard.retentionPolicies.length > 0 ? (
            <div className="space-y-2">
              {dashboard.retentionPolicies.map((p) => (
                <div key={p.id} className="flex items-center justify-between p-3 bg-card rounded-lg border">
                  <div>
                    <div className="font-medium">{p.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {p.entityType.replace(/_/g, ' ')} — keep for {p.retentionDays} days
                      {p.autoDelete ? ' — auto-delete' : ' — flag for review'}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge tone={p.isActive ? 'success' : 'default'}>{p.isActive ? 'Active' : 'Paused'}</Badge>
                    {p.lastRunAt && <span className="text-xs text-muted-foreground">Last run: {new Date(p.lastRunAt).toLocaleDateString()}</span>}
                    {p.recordsDeleted > 0 && <span className="text-xs text-muted-foreground">{p.recordsDeleted} deleted</span>}
                    <Button size="sm" variant="outline" onClick={() => runRetentionPolicy(p.id)}>Run Now</Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center p-8 bg-card rounded-lg border text-muted-foreground">
              No retention policies configured. Create policies to automatically manage data lifecycle.
            </div>
          )}
        </div>
      )}

      {/* Data Requests Tab */}
      {tab === 'Data Requests' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold">Data Access Requests (GDPR/CCPA)</h3>
            <Button size="sm" onClick={() => setShowRequestForm(true)}>New Request</Button>
          </div>

          {dataRequestStats && (
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="p-3 bg-card rounded border text-center">
                <div className="text-lg font-bold">{dataRequestStats.total}</div>
                <div className="text-xs text-muted-foreground">Total Requests</div>
              </div>
              <div className="p-3 bg-card rounded border text-center">
                <div className="text-lg font-bold text-red-600">{dataRequestStats.overdue}</div>
                <div className="text-xs text-muted-foreground">Overdue (30-day limit)</div>
              </div>
              <div className="p-3 bg-card rounded border text-center">
                <div className="text-lg font-bold text-green-600">
                  {dataRequestStats.byStatus.find((s) => s.status === 'COMPLETED')?.count ?? 0}
                </div>
                <div className="text-xs text-muted-foreground">Completed</div>
              </div>
            </div>
          )}

          {showRequestForm && (
            <div className="p-4 bg-card rounded-lg border space-y-3">
              <h4 className="font-medium">New Data Access Request</h4>
              <div className="grid grid-cols-3 gap-3">
                <select className="border rounded px-2 py-1.5 text-sm" value={requestForm.type}
                  onChange={(e) => setRequestForm((p) => ({ ...p, type: e.target.value }))}>
                  {REQUEST_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <input className="border rounded px-2 py-1.5 text-sm" placeholder="Contact email"
                  value={requestForm.contactEmail}
                  onChange={(e) => setRequestForm((p) => ({ ...p, contactEmail: e.target.value }))} />
                <input className="border rounded px-2 py-1.5 text-sm" placeholder="Description"
                  value={requestForm.description}
                  onChange={(e) => setRequestForm((p) => ({ ...p, description: e.target.value }))} />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={createDataRequest} disabled={!requestForm.contactEmail}>Create Request</Button>
                <Button size="sm" variant="outline" onClick={() => setShowRequestForm(false)}>Cancel</Button>
              </div>
            </div>
          )}

          {dataRequests.length === 0 ? (
            <div className="text-center p-8 bg-card rounded-lg border text-muted-foreground">
              No data access requests. When data subjects request access, deletion, or portability, manage them here.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 font-medium">Type</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium">Contact</th>
                    <th className="pb-2 font-medium">Deadline</th>
                    <th className="pb-2 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {dataRequests.map((r) => {
                    const isOverdue = r.status !== 'COMPLETED' && r.deadlineAt && new Date(r.deadlineAt) < new Date();
                    return (
                      <tr key={r.id} className="border-b last:border-0">
                        <td className="py-2"><Badge tone="default">{r.type}</Badge></td>
                        <td className="py-2">
                          <Badge tone={isOverdue ? overdueTone : toneForStatus(r.status)}>{isOverdue ? 'OVERDUE' : r.status}</Badge>
                        </td>
                        <td className="py-2">{r.contactEmail || '—'}</td>
                        <td className="py-2 text-muted-foreground">{r.deadlineAt ? new Date(r.deadlineAt).toLocaleDateString() : '—'}</td>
                        <td className="py-2 text-muted-foreground">{new Date(r.createdAt).toLocaleDateString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default Compliance;
