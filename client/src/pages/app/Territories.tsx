import { useState, useEffect, useCallback } from 'react';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Skeleton } from '../../components/ui/skeleton';

interface Territory {
  id: string;
  name: string;
  description?: string;
  countries: string;
  states: string;
  cities: string;
  industries: string;
  employeeRanges: string;
  ownerId?: string;
  owner?: { id: string; name: string; email: string };
  isActive: boolean;
  _count?: { accounts: number };
  createdAt: string;
}

interface AccountOwnership {
  id: string;
  entityType: string;
  entityId: string;
  ownerId: string;
  owner?: { id: string; name: string; email: string };
  coOwner?: { id: string; name: string };
  territory?: { id: string; name: string };
  isActive: boolean;
  changeReason?: string;
  createdAt: string;
}

function parseJsonArray(s: string | null | undefined): string[] {
  if (!s) return [];
  try { return JSON.parse(s); } catch { return []; }
}

export function Territories() {
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [myAccounts, setMyAccounts] = useState<AccountOwnership[]>([]);
  const [unowned, setUnowned] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'territories' | 'ownership' | 'unowned'>('territories');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', countries: '', states: '', cities: '', industries: '', employeeRanges: '' });
  const [selectedTerritory, setSelectedTerritory] = useState<Territory | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tRes, oRes] = await Promise.all([
        api<{ territories: Territory[] }>('/territories'),
        api<{ accounts: AccountOwnership[] }>('/territories/ownership/my'),
      ]);
      setTerritories(tRes.territories || []);
      setMyAccounts(oRes.accounts || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  const loadUnowned = useCallback(async () => {
    try {
      const data = await api<{ entities: any[] }>('/territories/ownership/unowned/COMPANY');
      setUnowned(data.entities || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (tab === 'unowned') loadUnowned(); }, [tab, loadUnowned]);

  const createTerritory = async () => {
    if (!form.name) return;
    try {
      await api('/territories', {
        body: {
          name: form.name,
          description: form.description || undefined,
          countries: form.countries ? form.countries.split(',').map((s) => s.trim()) : [],
          states: form.states ? form.states.split(',').map((s) => s.trim()) : [],
          cities: form.cities ? form.cities.split(',').map((s) => s.trim()) : [],
          industries: form.industries ? form.industries.split(',').map((s) => s.trim()) : [],
          employeeRanges: form.employeeRanges ? form.employeeRanges.split(',').map((s) => s.trim()) : [],
        },
      });
      setShowForm(false);
      setForm({ name: '', description: '', countries: '', states: '', cities: '', industries: '', employeeRanges: '' });
      load();
    } catch { /* ignore */ }
  };

  const deleteTerritory = async (id: string) => {
    try {
      await api(`/territories/${id}`, { method: 'DELETE' });
      load();
    } catch { /* ignore */ }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Territories & Ownership</h1>
          <p className="text-sm text-gray-500 mt-1">Manage geographic territories and account assignments</p>
        </div>
        <Button onClick={() => setShowForm(true)}>+ New Territory</Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {(['territories', 'ownership', 'unowned'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t === 'territories' ? `Territories (${territories.length})` : t === 'ownership' ? `My Accounts (${myAccounts.length})` : `Unowned (${unowned.length})`}
          </button>
        ))}
      </div>

      {/* Create form */}
      {showForm && (
        <div className="border rounded-xl p-4 bg-gray-50 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="Territory name" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} className="border rounded-lg px-3 py-2 text-sm" />
            <input placeholder="Description" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} className="border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <input placeholder="Countries (comma separated)" value={form.countries} onChange={(e) => setForm((p) => ({ ...p, countries: e.target.value }))} className="border rounded-lg px-3 py-2 text-sm" />
            <input placeholder="States (comma separated)" value={form.states} onChange={(e) => setForm((p) => ({ ...p, states: e.target.value }))} className="border rounded-lg px-3 py-2 text-sm" />
            <input placeholder="Cities (comma separated)" value={form.cities} onChange={(e) => setForm((p) => ({ ...p, cities: e.target.value }))} className="border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="Industries (comma separated)" value={form.industries} onChange={(e) => setForm((p) => ({ ...p, industries: e.target.value }))} className="border rounded-lg px-3 py-2 text-sm" />
            <input placeholder="Employee ranges (e.g. 51-200, 201-500)" value={form.employeeRanges} onChange={(e) => setForm((p) => ({ ...p, employeeRanges: e.target.value }))} className="border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={createTerritory}>Create</Button>
            <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
      ) : (
        <>
          {/* Territories Tab */}
          {tab === 'territories' && (
            <div className="space-y-3">
              {territories.length === 0 ? (
                <div className="border-2 border-dashed border-gray-200 rounded-xl p-12 text-center text-gray-400">
                  <div className="text-4xl mb-2">🌍</div>
                  <div>No territories defined yet</div>
                </div>
              ) : (
                territories.map((t) => (
                  <div key={t.id} className="border rounded-xl p-4 hover:bg-gray-50">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">{t.name}</span>
                          {!t.isActive && <Badge>INACTIVE</Badge>}
                          {t._count && <Badge>{t._count.accounts} accounts</Badge>}
                        </div>
                        {t.description && <div className="text-sm text-gray-500 mt-1">{t.description}</div>}
                        <div className="flex flex-wrap gap-1 mt-2">
                          {parseJsonArray(t.countries).map((c) => <Badge key={c}>{c}</Badge>)}
                          {parseJsonArray(t.states).map((s) => <Badge key={s} tone="info">{s}</Badge>)}
                          {parseJsonArray(t.cities).map((c) => <Badge key={c} tone="muted">{c}</Badge>)}
                          {parseJsonArray(t.industries).map((ind) => <Badge key={ind} tone="warning">{ind}</Badge>)}
                          {parseJsonArray(t.employeeRanges).map((r) => <Badge key={r} tone="muted">{r}</Badge>)}
                        </div>
                        {t.owner && <div className="text-xs text-gray-400 mt-2">Owner: {t.owner.name}</div>}
                      </div>
                      <div className="flex gap-1">
                        <Button variant="outline" size="sm" onClick={() => setSelectedTerritory(selectedTerritory?.id === t.id ? null : t)}>
                          {selectedTerritory?.id === t.id ? 'Close' : 'Details'}
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => deleteTerritory(t.id)} className="text-red-600 hover:text-red-700">Delete</Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* My Accounts Tab */}
          {tab === 'ownership' && (
            <div className="space-y-3">
              {myAccounts.length === 0 ? (
                <div className="border-2 border-dashed border-gray-200 rounded-xl p-12 text-center text-gray-400">
                  <div className="text-4xl mb-2">📋</div>
                  <div>No accounts assigned to you yet</div>
                </div>
              ) : (
                myAccounts.map((a) => (
                  <div key={a.id} className="border rounded-xl p-4 flex items-center justify-between hover:bg-gray-50">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge>{a.entityType}</Badge>
                        <span className="font-mono text-sm text-gray-500">{a.entityId}</span>
                        {a.territory && <Badge tone="info">{a.territory.name}</Badge>}
                      </div>
                      {a.changeReason && <div className="text-xs text-gray-400 mt-1">{a.changeReason}</div>}
                    </div>
                    <div className="text-xs text-gray-400">
                      Since {new Date(a.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Unowned Tab */}
          {tab === 'unowned' && (
            <div className="space-y-3">
              {unowned.length === 0 ? (
                <div className="border-2 border-dashed border-gray-200 rounded-xl p-12 text-center text-gray-400">
                  <div className="text-4xl mb-2">✅</div>
                  <div>All companies are owned!</div>
                </div>
              ) : (
                unowned.map((e) => (
                  <div key={e.id} className="border rounded-xl p-4 flex items-center justify-between hover:bg-gray-50">
                    <div>
                      <div className="font-medium text-gray-900">{e.name}</div>
                      <div className="text-sm text-gray-500">
                        {e.domain && <span>{e.domain} · </span>}
                        {e.industry && <span>{e.industry} · </span>}
                        {e.country && <span>{e.country}</span>}
                      </div>
                    </div>
                    <Button variant="outline" size="sm">Assign</Button>
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default Territories;
