import { useState, useEffect, useCallback } from 'react';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Skeleton } from '../../components/ui/skeleton';

interface DataProvider {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
  priority: number;
  status: string;
  lastError?: string;
  lastUsedAt?: string;
  costPerQuery: number;
  _count?: { dataProvenances: number };
  createdAt: string;
}

const PROVIDER_TYPES = [
  { value: 'COMPANY_SEARCH', label: 'Company Search', icon: '🏢' },
  { value: 'CONTACT_SEARCH', label: 'Contact Search', icon: '👤' },
  { value: 'ENRICHMENT', label: 'Enrichment', icon: '📊' },
  { value: 'VERIFICATION', label: 'Email Verification', icon: '✉️' },
  { value: 'INTENT', label: 'Intent Data', icon: '🎯' },
];

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  ERROR: 'bg-red-100 text-red-700',
  INACTIVE: 'bg-gray-100 text-gray-600',
  RATE_LIMITED: 'bg-yellow-100 text-yellow-700',
};

export function DataProviders() {
  const [providers, setProviders] = useState<DataProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    type: 'COMPANY_SEARCH',
    baseUrl: '',
    apiKey: '',
    priority: '0',
    costPerQuery: '0',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<{ providers: DataProvider[] }>('/data-providers');
      setProviders(data.providers || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const createProvider = async () => {
    if (!form.name) return;
    try {
      await api('/data-providers', {
        body: {
          name: form.name,
          type: form.type,
          baseUrl: form.baseUrl || undefined,
          config: form.apiKey ? { apiKey: form.apiKey } : undefined,
          priority: Number(form.priority),
          costPerQuery: Number(form.costPerQuery),
        },
      });
      setShowForm(false);
      setForm({ name: '', type: 'COMPANY_SEARCH', baseUrl: '', apiKey: '', priority: '0', costPerQuery: '0' });
      load();
    } catch { /* ignore */ }
  };

  const testProvider = async (id: string) => {
    setTesting(id);
    try {
      await api(`/data-providers/${id}/test`, { body: {} });
      load();
    } catch { /* ignore */ }
    setTesting(null);
  };

  const toggleProvider = async (id: string, enabled: boolean) => {
    try {
      await api(`/data-providers/${id}`, { method: 'PATCH', body: { enabled: !enabled } });
      load();
    } catch { /* ignore */ }
  };

  const deleteProvider = async (id: string) => {
    try {
      await api(`/data-providers/${id}`, { method: 'DELETE' });
      load();
    } catch { /* ignore */ }
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Data Providers</h1>
          <p className="text-sm text-gray-500 mt-1">Configure and manage external data source integrations</p>
        </div>
        <Button onClick={() => setShowForm(true)}>+ Add Provider</Button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="border rounded-xl p-4 bg-gray-50 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="Provider name" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} className="border rounded-lg px-3 py-2 text-sm" />
            <select value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))} className="border rounded-lg px-3 py-2 text-sm">
              {PROVIDER_TYPES.map((t) => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
            </select>
          </div>
          <input placeholder="Base URL (optional)" value={form.baseUrl} onChange={(e) => setForm((p) => ({ ...p, baseUrl: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
          <input placeholder="API Key (stored securely)" type="password" value={form.apiKey} onChange={(e) => setForm((p) => ({ ...p, apiKey: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="Priority (0-100)" type="number" value={form.priority} onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value }))} className="border rounded-lg px-3 py-2 text-sm" />
            <input placeholder="Cost per query (paise)" type="number" value={form.costPerQuery} onChange={(e) => setForm((p) => ({ ...p, costPerQuery: e.target.value }))} className="border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={createProvider}>Create</Button>
            <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Provider types legend */}
      <div className="flex flex-wrap gap-3">
        {PROVIDER_TYPES.map((t) => (
          <div key={t.value} className="flex items-center gap-1 text-xs text-gray-500">
            <span>{t.icon}</span>
            <span>{t.label}</span>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full" />)}</div>
      ) : (
        <div className="space-y-3">
          {providers.length === 0 ? (
            <div className="border-2 border-dashed border-gray-200 rounded-xl p-12 text-center text-gray-400">
              <div className="text-4xl mb-2">🔌</div>
              <div>No data providers configured yet</div>
              <div className="text-sm mt-1">Add a provider to start enriching your data</div>
            </div>
          ) : (
            providers.map((p) => {
              const typeDef = PROVIDER_TYPES.find((t) => t.value === p.type);
              return (
                <div key={p.id} className="border rounded-xl p-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{typeDef?.icon || '📦'}</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">{p.name}</span>
                          <Badge className={STATUS_COLORS[p.status] || STATUS_COLORS.INACTIVE}>{p.status}</Badge>
                          {!p.enabled && <Badge>INACTIVE</Badge>}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {typeDef?.label} · Priority {p.priority} · {p.costPerQuery > 0 ? `${p.costPerQuery}p/query` : 'Free'}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {p.lastUsedAt && <span className="text-xs text-gray-400">Used {new Date(p.lastUsedAt).toLocaleDateString()}</span>}
                      {p._count && <Badge>{p._count.dataProvenances} records</Badge>}
                      {p.lastError && <Badge tone="danger">Error</Badge>}
                      <Button variant="outline" size="sm" onClick={() => testProvider(p.id)} disabled={testing === p.id}>
                        {testing === p.id ? 'Testing...' : 'Test'}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => toggleProvider(p.id, p.enabled)}>
                        {p.enabled ? 'Disable' : 'Enable'}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => deleteProvider(p.id)} className="text-red-600 hover:text-red-700">Delete</Button>
                    </div>
                  </div>
                  {p.lastError && (
                    <div className="mt-2 text-xs text-red-600 bg-red-50 rounded-lg p-2">{p.lastError}</div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

export default DataProviders;
