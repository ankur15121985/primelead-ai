import { useEffect, useState, useCallback } from 'react';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Skeleton } from '../../components/ui/skeleton';

interface ApiKeyRecord {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  rateLimit?: number;
  isActive: boolean;
  lastUsedAt?: string;
  lastUsedIp?: string;
  totalRequests: number;
  expiresAt?: string;
  revokedAt?: string;
  createdAt: string;
}

const SCOPE_OPTIONS = [
  { value: 'contacts.read', label: 'Contacts — Read' },
  { value: 'contacts.write', label: 'Contacts — Write' },
  { value: 'companies.read', label: 'Companies — Read' },
  { value: 'companies.write', label: 'Companies — Write' },
  { value: 'leads.read', label: 'Leads — Read' },
  { value: 'leads.write', label: 'Leads — Write' },
  { value: 'deals.read', label: 'Deals — Read' },
  { value: 'deals.write', label: 'Deals — Write' },
  { value: 'sequences.read', label: 'Sequences — Read' },
  { value: 'sequences.write', label: 'Sequences — Write' },
  { value: 'emails.send', label: 'Emails — Send' },
  { value: 'calls.read', label: 'Calls — Read' },
  { value: 'calls.log', label: 'Calls — Log' },
  { value: 'meetings.read', label: 'Meetings — Read' },
  { value: 'meetings.manage', label: 'Meetings — Manage' },
  { value: 'webhooks.manage', label: 'Webhooks — Manage' },
  { value: 'analytics.read', label: 'Analytics — Read' },
  { value: 'exports.create', label: 'Exports — Create' },
];

export function ApiKeys() {
  const [loading, setLoading] = useState(true);
  const [keys, setKeys] = useState<ApiKeyRecord[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', scopes: [] as string[], rateLimit: 600, expiresAt: '' });
  const [newKey, setNewKey] = useState<string | null>(null);

  const loadKeys = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<{ keys: ApiKeyRecord[] }>('/api-keys');
      setKeys(data.keys);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { loadKeys(); }, [loadKeys]);

  const createKey = async () => {
    try {
      const data = await api<{ key: string; apiKey: ApiKeyRecord; message: string }>('/api-keys', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name,
          scopes: form.scopes,
          rateLimit: form.rateLimit || undefined,
          expiresAt: form.expiresAt || undefined,
        }),
      });
      setNewKey(data.key);
      setShowForm(false);
      setForm({ name: '', scopes: [], rateLimit: 600, expiresAt: '' });
      loadKeys();
    } catch (e: any) {
      alert(e.message || 'Failed to create API key');
    }
  };

  const revokeKey = async (id: string) => {
    if (!confirm('Revoke this API key? Applications using it will stop working.')) return;
    try {
      await api(`/api-keys/${id}`, { method: 'DELETE' });
      loadKeys();
    } catch (e: any) {
      alert(e.message || 'Failed to revoke key');
    }
  };

  const rotateKey = async (id: string) => {
    if (!confirm('Rotate this key? The old key will be revoked immediately.')) return;
    try {
      const data = await api<{ key: string; apiKey: ApiKeyRecord }>(`/api-keys/${id}/rotate`, { method: 'POST' });
      setNewKey(data.key);
      loadKeys();
    } catch (e: any) {
      alert(e.message || 'Failed to rotate key');
    }
  };

  const toggleScope = (scope: string) => {
    setForm((p) => ({
      ...p,
      scopes: p.scopes.includes(scope) ? p.scopes.filter((s) => s !== scope) : [...p.scopes, scope],
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">API Keys</h1>
          <p className="text-sm text-muted-foreground">Manage API access keys for external integrations</p>
        </div>
        <Button onClick={() => { setShowForm(true); setNewKey(null); }}>Create API Key</Button>
      </div>

      {/* New Key Display */}
      {newKey && (
        <div className="p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-semibold text-green-800 dark:text-green-200">API Key Created</h4>
            <button onClick={() => setNewKey(null)} className="text-green-600 hover:text-green-800">✕</button>
          </div>
          <p className="text-sm text-green-700 dark:text-green-300 mb-2">Save this key now — it will not be shown again.</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 p-2 bg-white dark:bg-black rounded border font-mono text-sm break-all">{newKey}</code>
            <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(newKey)}>Copy</Button>
          </div>
        </div>
      )}

      {/* Create Form */}
      {showForm && (
        <div className="p-4 bg-card rounded-lg border space-y-4">
          <h3 className="font-semibold">Create New API Key</h3>
          <div className="grid grid-cols-2 gap-3">
            <input className="border rounded px-3 py-2 text-sm" placeholder="Key name (e.g. Production, Zapier)"
              value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
            <input className="border rounded px-3 py-2 text-sm" type="number" placeholder="Rate limit (per minute)"
              value={form.rateLimit || ''} onChange={(e) => setForm((p) => ({ ...p, rateLimit: parseInt(e.target.value) || 0 }))} />
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">Scopes (select permissions)</label>
            <div className="grid grid-cols-3 gap-1">
              {SCOPE_OPTIONS.map((s) => (
                <button key={s.value}
                  className={`text-left px-2 py-1 rounded text-xs border transition-colors ${
                    form.scopes.includes(s.value)
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-muted text-muted-foreground border-transparent hover:border-border'
                  }`}
                  onClick={() => toggleScope(s.value)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={createKey} disabled={!form.name || form.scopes.length === 0}>Create Key</Button>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Keys List */}
      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : keys.length === 0 ? (
        <div className="text-center p-8 bg-card rounded-lg border text-muted-foreground">
          No API keys created yet. API keys allow external applications to access your data programmatically.
        </div>
      ) : (
        <div className="space-y-2">
          {keys.map((k) => (
            <div key={k.id} className={`flex items-center justify-between p-4 bg-card rounded-lg border ${!k.isActive ? 'opacity-60' : ''}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{k.name}</span>
                  <Badge tone={k.isActive ? 'success' : 'default'}>{k.isActive ? 'Active' : k.revokedAt ? 'Revoked' : 'Inactive'}</Badge>
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  <code className="font-mono">{k.keyPrefix}...</code>
                  <span>{k.totalRequests} requests</span>
                  {k.lastUsedAt && <span>Last used: {new Date(k.lastUsedAt).toLocaleDateString()}</span>}
                  {k.expiresAt && <span>Expires: {new Date(k.expiresAt).toLocaleDateString()}</span>}
                </div>
                <div className="flex gap-1 mt-1">
                  {k.scopes.map((s) => (
                    <Badge key={s} tone="default" className="text-[10px]">{s}</Badge>
                  ))}
                </div>
              </div>
              {k.isActive && (
                <div className="flex gap-1 ml-4">
                  <Button size="sm" variant="outline" onClick={() => rotateKey(k.id)}>Rotate</Button>
                  <Button size="sm" variant="destructive" onClick={() => revokeKey(k.id)}>Revoke</Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ApiKeys;
