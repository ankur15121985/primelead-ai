import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Calculator, Plus, Trash2, ToggleLeft, ToggleRight, Zap } from 'lucide-react';

interface ScoringRule {
  id: string;
  name: string;
  description?: string | null;
  field: string;
  operator: string;
  value?: unknown;
  points: number;
  enabled: boolean;
  priority: number;
}

const FIELDS = [
  { value: 'source', label: 'Lead Source' },
  { value: 'hasEmail', label: 'Has Email' },
  { value: 'hasPhone', label: 'Has Phone' },
  { value: 'priority', label: 'Priority' },
  { value: 'status', label: 'Status' },
  { value: 'company', label: 'Has Company' },
];

const OPERATORS = ['eq', 'neq', 'in', 'contains', 'gt', 'gte', 'lt', 'lte', 'exists'];

export function ScoringRules() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', field: 'source', operator: 'eq', value: '', points: 10 });

  const { data, isLoading } = useQuery<{ rules: ScoringRule[] }>({
    queryKey: ['scoring-rules'],
    queryFn: async () => api<{ rules: ScoringRule[] }>('/scoring'),
  });

  const createMutation = useMutation({
    mutationFn: async (input: typeof form) => api<{ rule: ScoringRule }>('/scoring', {
      method: 'POST',
      body: { ...input, points: Number(input.points), value: input.operator === 'exists' ? undefined : input.value || undefined },
    }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['scoring-rules'] }); setShowForm(false); setForm({ name: '', field: 'source', operator: 'eq', value: '', points: 10 }); },
  });

  const toggleMutation = useMutation({
    mutationFn: async (rule: ScoringRule) => api<{ rule: ScoringRule }>(`/scoring/${rule.id}`, {
      method: 'PATCH',
      body: { enabled: !rule.enabled },
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['scoring-rules'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api<{ deleted: boolean }>(`/scoring/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['scoring-rules'] }),
  });

  const rules = data?.rules || [];
  const totalPositive = rules.filter((r) => r.enabled && r.points > 0).reduce((sum, r) => sum + r.points, 0);
  const totalNegative = rules.filter((r) => r.enabled && r.points < 0).reduce((sum, r) => sum + r.points, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Scoring Rules</h1>
          <p className="text-sm text-slate-500">Configure how leads are scored based on your criteria</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="mr-2 h-4 w-4" /> New Rule
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border bg-white p-4">
          <p className="text-xs text-slate-500">Max Positive</p>
          <p className="text-2xl font-bold text-emerald-600">+{totalPositive}</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-xs text-slate-500">Max Negative</p>
          <p className="text-2xl font-bold text-red-600">{totalNegative}</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-xs text-slate-500">Active Rules</p>
          <p className="text-2xl font-bold text-blue-600">{rules.filter((r) => r.enabled).length}</p>
        </div>
      </div>

      {showForm && (
        <div className="rounded-lg border bg-white p-4 space-y-3">
          <h3 className="font-semibold">New Scoring Rule</h3>
          <Input placeholder="Rule name" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
          <div className="grid gap-3 sm:grid-cols-4">
            <select value={form.field} onChange={(e) => setForm((p) => ({ ...p, field: e.target.value }))} className="rounded-md border px-3 py-1.5 text-sm">
              {FIELDS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
            <select value={form.operator} onChange={(e) => setForm((p) => ({ ...p, operator: e.target.value }))} className="rounded-md border px-3 py-1.5 text-sm">
              {OPERATORS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
            {form.operator !== 'exists' && (
              <Input placeholder="Value" value={form.value} onChange={(e) => setForm((p) => ({ ...p, value: e.target.value }))} />
            )}
            <Input type="number" placeholder="Points" value={form.points} onChange={(e) => setForm((p) => ({ ...p, points: Number(e.target.value) }))} />
          </div>
          <div className="flex gap-2">
            <Button onClick={() => createMutation.mutate(form)} disabled={!form.name.trim() || createMutation.isPending}>Create</Button>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-14 animate-pulse rounded-lg bg-slate-100" />)}</div>
      ) : rules.length === 0 ? (
        <div className="py-12 text-center text-slate-500">
          <Calculator className="mx-auto mb-2 h-8 w-8 text-slate-300" />
          <p>No scoring rules yet. Create rules to define how leads are scored.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Rule</th>
                <th className="px-4 py-3">Condition</th>
                <th className="px-4 py-3">Points</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rules.map((rule) => (
                <tr key={rule.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium">{rule.name}</td>
                  <td className="px-4 py-3">
                    <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
                      {rule.field} {rule.operator} {rule.value != null ? String(rule.value) : '—'}
                    </code>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`font-bold ${rule.points > 0 ? 'text-emerald-600' : rule.points < 0 ? 'text-red-600' : 'text-slate-600'}`}>
                      {rule.points > 0 ? '+' : ''}{rule.points}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={rule.enabled ? 'success' : 'muted'}>{rule.enabled ? 'Active' : 'Disabled'}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => toggleMutation.mutate(rule)} className="rounded p-1 hover:bg-slate-100">
                        {rule.enabled ? <ToggleRight className="h-5 w-5 text-emerald-600" /> : <ToggleLeft className="h-5 w-5 text-slate-400" />}
                      </button>
                      <button onClick={() => { if (confirm('Delete this rule?')) deleteMutation.mutate(rule.id); }} className="rounded p-1 text-red-400 hover:bg-red-50 hover:text-red-600">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default ScoringRules;
