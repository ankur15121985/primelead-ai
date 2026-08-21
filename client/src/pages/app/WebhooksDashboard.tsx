import { useEffect, useState, useCallback } from 'react';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Skeleton } from '../../components/ui/skeleton';

interface WebhookEndpoint {
  id: string;
  name: string;
  url: string;
  secret?: string;
  events: string[];
  retryPolicy: string;
  maxRetries: number;
  timeoutMs: number;
  isActive: boolean;
  status: string;
  totalDeliveries: number;
  successCount: number;
  failureCount: number;
  lastTriggeredAt?: string;
  lastStatus?: string;
  createdAt: string;
}

interface WebhookDelivery {
  id: string;
  event: string;
  status: string;
  httpStatus?: number;
  attempt: number;
  durationMs?: number;
  error?: string;
  createdAt: string;
  endpoint: { id: string; name: string; url: string };
}

interface DeliveryStats {
  total: number;
  byEvent: Array<{ event: string; count: number }>;
  byStatus: Array<{ status: string; count: number }>;
  recentFailures: Array<WebhookDelivery>;
}

const AVAILABLE_EVENTS = [
  'lead.created', 'lead.updated', 'lead.deleted', 'lead.won', 'lead.lost',
  'contact.created', 'contact.updated', 'contact.enriched',
  'company.created', 'company.updated', 'company.enriched',
  'deal.created', 'deal.stage_changed', 'deal.won', 'deal.lost',
  'sequence.enrolled', 'sequence.replied', 'sequence.completed',
  'email.sent', 'email.opened', 'email.clicked', 'email.bounced', 'email.replied',
  'call.logged', 'meeting.booked', 'meeting.completed',
  'form.submitted', 'workflow.completed', 'import.completed',
  'signal.detected', 'score.changed',
  'test.ping',
];

function toneForStatus(status: string): 'success' | 'danger' | 'warning' | 'default' {
  if (['SUCCESS', 'DELIVERED', 'ACTIVE'].includes(status)) return 'success' as const;
  if (['FAILED', 'ERROR', 'TIMEOUT'].includes(status)) return 'danger' as const;
  if (['RETRYING', 'DELIVERING', 'PENDING'].includes(status)) return 'warning' as const;
  return 'default' as const;
}

export function WebhooksDashboard() {
  const [loading, setLoading] = useState(true);
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([]);
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [stats, setStats] = useState<DeliveryStats | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '', url: '', events: [] as string[],
    retryPolicy: 'EXPONENTIAL', maxRetries: 3, timeoutMs: 5000,
  });
  const [view, setView] = useState<'endpoints' | 'deliveries'>('endpoints');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [endpointsData, deliveriesData, statsData] = await Promise.all([
        api<{ endpoints: WebhookEndpoint[] }>('/webhooks-platform'),
        api<{ deliveries: WebhookDelivery[] }>('/webhooks-platform/deliveries'),
        api<DeliveryStats>('/webhooks-platform/stats'),
      ]);
      setEndpoints(endpointsData.endpoints);
      setDeliveries(deliveriesData.deliveries);
      setStats(statsData);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const createEndpoint = async () => {
    try {
      await api('/webhooks-platform', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setShowForm(false);
      setForm({ name: '', url: '', events: [], retryPolicy: 'EXPONENTIAL', maxRetries: 3, timeoutMs: 5000 });
      loadData();
    } catch (e: any) { alert(e.message || 'Failed to create webhook'); }
  };

  const deleteEndpoint = async (id: string) => {
    if (!confirm('Delete this webhook endpoint?')) return;
    try {
      await api(`/webhooks-platform/${id}`, { method: 'DELETE' });
      loadData();
    } catch (e: any) { alert(e.message || 'Failed to delete'); }
  };

  const rotateSecret = async (id: string) => {
    if (!confirm('Rotate the HMAC secret? Existing integrations will need updating.')) return;
    try {
      await api(`/webhooks-platform/${id}/rotate-secret`, { method: 'POST' });
      loadData();
    } catch (e: any) { alert(e.message || 'Failed to rotate secret'); }
  };

  const testEndpoint = async (id: string) => {
    try {
      await api(`/webhooks-platform/test/${id}`, { method: 'POST' });
      loadData();
    } catch (e: any) { alert(e.message || 'Failed to send test'); }
  };

  const toggleEvent = (event: string) => {
    setForm((p) => ({
      ...p,
      events: p.events.includes(event) ? p.events.filter((e) => e !== event) : [...p.events, event],
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Webhooks</h1>
          <p className="text-sm text-muted-foreground">Outgoing webhook endpoints with HMAC signatures and retry policies</p>
        </div>
        <Button onClick={() => setShowForm(true)}>Create Webhook</Button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total Deliveries', value: stats.total },
            { label: 'Successful', value: stats.byStatus.find((s) => s.status === 'SUCCESS')?.count ?? 0, color: 'text-green-600' },
            { label: 'Failed', value: stats.byStatus.find((s) => s.status === 'FAILED')?.count ?? 0, color: 'text-red-600' },
            { label: 'Active Endpoints', value: endpoints.filter((e) => e.isActive).length, color: 'text-blue-600' },
          ].map((s) => (
            <div key={s.label} className="p-3 bg-card rounded border">
              <div className={`text-xl font-bold ${s.color || ''}`}>{s.value}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Create Form */}
      {showForm && (
        <div className="p-4 bg-card rounded-lg border space-y-4">
          <h3 className="font-semibold">Create Webhook Endpoint</h3>
          <div className="grid grid-cols-2 gap-3">
            <input className="border rounded px-3 py-2 text-sm" placeholder="Name"
              value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
            <input className="border rounded px-3 py-2 text-sm" placeholder="URL (https://...)"
              value={form.url} onChange={(e) => setForm((p) => ({ ...p, url: e.target.value }))} />
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">Subscribe to Events</label>
            <div className="max-h-32 overflow-y-auto border rounded p-2 grid grid-cols-4 gap-1">
              {AVAILABLE_EVENTS.map((e) => (
                <button key={e}
                  className={`text-left px-2 py-1 rounded text-xs border transition-colors ${
                    form.events.includes(e)
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-muted text-muted-foreground border-transparent hover:border-border'
                  }`}
                  onClick={() => toggleEvent(e)}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <select className="border rounded px-3 py-2 text-sm" value={form.retryPolicy}
              onChange={(e) => setForm((p) => ({ ...p, retryPolicy: e.target.value }))}>
              <option value="EXPONENTIAL">Exponential Backoff</option>
              <option value="LINEAR">Linear</option>
              <option value="NONE">No Retries</option>
            </select>
            <input className="border rounded px-3 py-2 text-sm" type="number" placeholder="Max retries"
              value={form.maxRetries} onChange={(e) => setForm((p) => ({ ...p, maxRetries: parseInt(e.target.value) || 3 }))} />
            <input className="border rounded px-3 py-2 text-sm" type="number" placeholder="Timeout (ms)"
              value={form.timeoutMs} onChange={(e) => setForm((p) => ({ ...p, timeoutMs: parseInt(e.target.value) || 5000 }))} />
          </div>
          <div className="flex gap-2">
            <Button onClick={createEndpoint} disabled={!form.name || !form.url || form.events.length === 0}>Create</Button>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* View Toggle */}
      <div className="flex gap-1 border-b pb-1">
        {(['endpoints', 'deliveries'] as const).map((v) => (
          <button key={v} onClick={() => setView(v)}
            className={`px-4 py-2 text-sm font-medium rounded-t transition-colors capitalize ${
              view === v ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}>
            {v}
          </button>
        ))}
      </div>

      {/* Endpoints */}
      {view === 'endpoints' && (
        <div className="space-y-3">
          {loading ? <Skeleton className="h-16" /> : endpoints.length === 0 ? (
            <div className="text-center p-8 bg-card rounded-lg border text-muted-foreground">
              No webhook endpoints configured. Create one to receive real-time event notifications.
            </div>
          ) : endpoints.map((ep) => (
            <div key={ep.id} className={`p-4 bg-card rounded-lg border ${!ep.isActive ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{ep.name}</span>
                    <Badge tone={toneForStatus(ep.status)}>{ep.status}</Badge>
                    <Badge tone={ep.isActive ? 'success' : 'default'}>{ep.isActive ? 'Active' : 'Paused'}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 font-mono break-all">{ep.url}</div>
                  <div className="flex gap-1 mt-1.5 flex-wrap">
                    {ep.events.map((e) => (
                      <Badge key={e} tone="default" className="text-[10px]">{e}</Badge>
                    ))}
                  </div>
                  <div className="flex gap-3 mt-1.5 text-xs text-muted-foreground">
                    <span>{ep.totalDeliveries} deliveries</span>
                    <span>{ep.successCount} successful</span>
                    <span>{ep.failureCount} failed</span>
                    {ep.lastTriggeredAt && <span>Last: {new Date(ep.lastTriggeredAt).toLocaleDateString()}</span>}
                  </div>
                </div>
                <div className="flex gap-1 ml-4">
                  <Button size="sm" variant="outline" onClick={() => testEndpoint(ep.id)}>Test</Button>
                  <Button size="sm" variant="outline" onClick={() => rotateSecret(ep.id)}>Rotate Secret</Button>
                  <Button size="sm" variant="destructive" onClick={() => deleteEndpoint(ep.id)}>Delete</Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Deliveries */}
      {view === 'deliveries' && (
        <div className="space-y-3">
          {loading ? <Skeleton className="h-16" /> : deliveries.length === 0 ? (
            <div className="text-center p-8 bg-card rounded-lg border text-muted-foreground">
              No webhook deliveries yet. Deliveries will appear here once events trigger your endpoints.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 font-medium">Event</th>
                    <th className="pb-2 font-medium">Endpoint</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium">HTTP</th>
                    <th className="pb-2 font-medium">Attempt</th>
                    <th className="pb-2 font-medium">Duration</th>
                    <th className="pb-2 font-medium">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {deliveries.map((d) => (
                    <tr key={d.id} className="border-b last:border-0">
                      <td className="py-2"><code className="text-xs bg-muted px-1 rounded">{d.event}</code></td>
                      <td className="py-2 text-xs">{d.endpoint.name}</td>
                      <td className="py-2"><Badge tone={toneForStatus(d.status)}>{d.status}</Badge></td>
                      <td className="py-2 text-xs">{d.httpStatus || '—'}</td>
                      <td className="py-2 text-xs">{d.attempt}/{d.attempt}</td>
                      <td className="py-2 text-xs">{d.durationMs ? `${d.durationMs}ms` : '—'}</td>
                      <td className="py-2 text-xs text-muted-foreground">{new Date(d.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default WebhooksDashboard;
