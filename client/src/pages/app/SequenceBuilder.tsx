import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Mail, Plus, Trash2, Play, Pause, Archive, Users, BarChart3, ChevronDown, ChevronUp } from 'lucide-react';

interface Sequence {
  id: string;
  name: string;
  description?: string | null;
  status: string;
  steps?: SequenceStep[];
  totalEnrolled: number;
  totalCompleted: number;
  totalReplied: number;
  _count?: { enrollments: number };
}

interface SequenceStep {
  id: string;
  order: number;
  type: string;
  subject?: string | null;
  body?: string | null;
  waitDays?: number | null;
  waitHours?: number | null;
}

const STEP_TYPES = [
  { value: 'EMAIL', label: 'Send Email', color: 'bg-blue-100 text-blue-700' },
  { value: 'CALL_TASK', label: 'Call Task', color: 'bg-green-100 text-green-700' },
  { value: 'LINKEDIN_TASK', label: 'LinkedIn Task', color: 'bg-indigo-100 text-indigo-700' },
  { value: 'MANUAL_TASK', label: 'Manual Task', color: 'bg-amber-100 text-amber-700' },
  { value: 'WAIT', label: 'Wait', color: 'bg-slate-100 text-slate-700' },
  { value: 'CONDITION', label: 'Condition', color: 'bg-purple-100 text-purple-700' },
];

const STATUS_META: Record<string, { label: string; color: string }> = {
  DRAFT: { label: 'Draft', color: 'bg-slate-100 text-slate-700' },
  ACTIVE: { label: 'Active', color: 'bg-emerald-100 text-emerald-700' },
  PAUSED: { label: 'Paused', color: 'bg-amber-100 text-amber-700' },
  ARCHIVED: { label: 'Archived', color: 'bg-slate-100 text-slate-500' },
};

export function SequenceBuilder() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formSteps, setFormSteps] = useState<{ type: string; order: number; subject?: string; body?: string; waitDays?: number }[]>([
    { type: 'EMAIL', order: 0, subject: '', body: '' },
  ]);

  const { data, isLoading } = useQuery<{ sequences: Sequence[] }>({
    queryKey: ['sequences'],
    queryFn: async () => api<{ sequences: Sequence[] }>('/sequences'),
  });

  const createMutation = useMutation({
    mutationFn: async () => api<{ sequence: Sequence }>('/sequences', {
      method: 'POST',
      body: { name: formName, steps: formSteps },
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sequences'] });
      setShowForm(false);
      setFormName('');
      setFormSteps([{ type: 'EMAIL', order: 0, subject: '', body: '' }]);
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) =>
      api<{ sequence: Sequence }>(`/sequences/${id}`, { method: 'PATCH', body: { status } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sequences'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api<{ deleted: boolean }>(`/sequences/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sequences'] }),
  });

  const addStep = () => {
    setFormSteps((prev) => [...prev, { type: 'EMAIL', order: prev.length, subject: '', body: '' }]);
  };

  const updateStep = (index: number, data: Partial<typeof formSteps[0]>) => {
    setFormSteps((prev) => prev.map((s, i) => i === index ? { ...s, ...data } : s));
  };

  const removeStep = (index: number) => {
    setFormSteps((prev) => prev.filter((_, i) => i !== index).map((s, i) => ({ ...s, order: i })));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Sequences</h1>
          <p className="text-sm text-slate-500">Automated multi-step email and task sequences</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="mr-2 h-4 w-4" /> New Sequence
        </Button>
      </div>

      {showForm && (
        <div className="rounded-lg border bg-white p-6 space-y-4">
          <h3 className="font-semibold">Create New Sequence</h3>
          <Input placeholder="Sequence name" value={formName} onChange={(e) => setFormName(e.target.value)} />

          <div className="space-y-3">
            {formSteps.map((step, i) => {
              const st = STEP_TYPES.find((s) => s.value === step.type);
              return (
                <div key={i} className="flex items-start gap-3 rounded-lg border p-3">
                  <div className={`rounded-full px-2 py-0.5 text-xs font-medium ${st?.color || 'bg-slate-100'}`}>{i + 1}</div>
                  <div className="flex-1 space-y-2">
                    <select value={step.type} onChange={(e) => updateStep(i, { type: e.target.value })} className="rounded border px-2 py-1 text-sm">
                      {STEP_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                    {step.type === 'EMAIL' && (
                      <>
                        <Input placeholder="Subject line" value={step.subject || ''} onChange={(e) => updateStep(i, { subject: e.target.value })} />
                        <textarea placeholder="Email body..." value={step.body || ''} onChange={(e) => updateStep(i, { body: e.target.value })} className="w-full rounded border px-3 py-2 text-sm" rows={3} />
                      </>
                    )}
                    {step.type === 'WAIT' && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-600">Wait</span>
                        <Input type="number" placeholder="Days" value={step.waitDays || ''} onChange={(e) => updateStep(i, { waitDays: Number(e.target.value) })} className="w-20" />
                        <span className="text-sm text-slate-600">days</span>
                      </div>
                    )}
                  </div>
                  {formSteps.length > 1 && (
                    <button onClick={() => removeStep(i)} className="rounded p-1 text-red-400 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
                  )}
                </div>
              );
            })}
          </div>

          <Button variant="ghost" size="sm" onClick={addStep}>
            <Plus className="mr-1 h-4 w-4" /> Add Step
          </Button>

          <div className="flex gap-2 pt-2">
            <Button onClick={() => createMutation.mutate()} disabled={!formName.trim() || createMutation.isPending}>Create Sequence</Button>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded-lg bg-slate-100" />)}</div>
      ) : data?.sequences?.length === 0 ? (
        <div className="py-12 text-center text-slate-500">
          <Mail className="mx-auto mb-2 h-8 w-8 text-slate-300" />
          <p>No sequences yet. Create one to start automating outreach.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {data?.sequences?.map((seq) => {
            const st = STATUS_META[seq.status] || STATUS_META.DRAFT;
            return (
              <div key={seq.id} className="rounded-lg border bg-white">
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Mail className="h-5 w-5 text-blue-600" />
                    <div>
                      <p className="font-semibold">{seq.name}</p>
                      {seq.description && <p className="text-xs text-slate-500">{seq.description}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={st.color}>{st.label}</Badge>
                    <Badge tone="muted">{seq.totalEnrolled} enrolled</Badge>
                    {seq.totalReplied > 0 && <Badge tone="success">{seq.totalReplied} replies</Badge>}
                    <div className="flex gap-1">
                      {seq.status === 'DRAFT' && (
                        <Button size="sm" variant="ghost" onClick={() => statusMutation.mutate({ id: seq.id, status: 'ACTIVE' })}>
                          <Play className="h-4 w-4 text-emerald-600" />
                        </Button>
                      )}
                      {seq.status === 'ACTIVE' && (
                        <Button size="sm" variant="ghost" onClick={() => statusMutation.mutate({ id: seq.id, status: 'PAUSED' })}>
                          <Pause className="h-4 w-4 text-amber-600" />
                        </Button>
                      )}
                      <button onClick={() => setExpandedId(expandedId === seq.id ? null : seq.id)} className="rounded p-1 hover:bg-slate-100">
                        {expandedId === seq.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>
                      <button onClick={() => { if (confirm('Delete this sequence?')) deleteMutation.mutate(seq.id); }} className="rounded p-1 text-red-400 hover:bg-red-50">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
                {expandedId === seq.id && seq.steps && (
                  <div className="border-t px-4 py-3">
                    <p className="mb-2 text-xs font-medium text-slate-500">STEPS</p>
                    <div className="space-y-2">
                      {seq.steps.map((step) => {
                        const stepMeta = STEP_TYPES.find((s) => s.value === step.type);
                        return (
                          <div key={step.id} className="flex items-center gap-3 rounded bg-slate-50 px-3 py-2">
                            <Badge className={stepMeta?.color || 'bg-slate-100'}>{step.type}</Badge>
                            <span className="text-xs text-slate-500">Step {step.order + 1}</span>
                            {step.type === 'EMAIL' && step.subject && <span className="text-sm">{step.subject}</span>}
                            {step.type === 'WAIT' && <span className="text-sm text-slate-600">Wait {step.waitDays || 0} days</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default SequenceBuilder;
