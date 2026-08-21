import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { UserCircle, Plus, Trash2, ChevronDown, ChevronUp, Users, Target, Zap } from 'lucide-react';

interface Persona {
  id: string;
  name: string;
  description?: string | null;
  jobTitles?: string[] | null;
  seniorities?: string[] | null;
  departments?: string[] | null;
  industries?: string[] | null;
  companySizes?: string[] | null;
  locations?: string[] | null;
  painPoints?: string[] | null;
  goals?: string[] | null;
  objections?: string[] | null;
  messagingTips?: string[] | null;
  valuePropositions?: string[] | null;
  preferredChannels?: string[] | null;
  bestApproach?: string | null;
  contactCount?: number;
  isActive?: boolean;
}

const SENIORITY_LEVELS = ['C_LEVEL', 'VP', 'DIRECTOR', 'MANAGER', 'SENIOR', 'STAFF', 'INTERN'];
const DEPARTMENTS = ['ENGINEERING', 'SALES', 'MARKETING', 'FINANCE', 'HR', 'LEGAL', 'OPERATIONS', 'EXECUTIVE', 'PRODUCT', 'DESIGN'];
const CHANNELS = ['EMAIL', 'PHONE', 'LINKEDIN', 'WHATSAPP', 'IN_PERSON', 'WEBINAR', 'EVENT'];

export function Personas() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Persona>>({});

  const { data, isLoading } = useQuery<{ personas: Persona[] }>({
    queryKey: ['personas'],
    queryFn: async () => api<{ personas: Persona[] }>('/personas'),
  });

  const createMutation = useMutation({
    mutationFn: async (input: Partial<Persona>) => api<{ persona: Persona }>('/personas', { method: 'POST', body: input }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['personas'] }); setShowForm(false); setForm({}); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api<{ deleted: boolean }>(`/personas/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['personas'] }),
  });

  const matchMutation = useMutation({
    mutationFn: async (id: string) => api<{ count: number }>(`/personas/${id}/match-count`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['personas'] }),
  });

  const toggleArray = (field: string, value: string) => {
    setForm((prev) => {
      const arr = (prev as Record<string, unknown>)[field] as string[] | undefined;
      const current = arr || [];
      const updated = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
      return { ...prev, [field]: updated.length > 0 ? updated : null };
    });
  };

  const addTextItem = (field: string, value: string) => {
    if (!value.trim()) return;
    setForm((prev) => {
      const arr = (prev as Record<string, unknown>)[field] as string[] | undefined;
      const current = arr || [];
      return { ...prev, [field]: [...current, value.trim()] };
    });
  };

  const removeTextItem = (field: string, value: string) => {
    setForm((prev) => {
      const arr = (prev as Record<string, unknown>)[field] as string[] | undefined;
      return { ...prev, [field]: (arr || []).filter((v) => v !== value) };
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Personas</h1>
          <p className="text-sm text-slate-500">Define buyer personas to target the right decision makers</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="mr-2 h-4 w-4" /> New Persona
        </Button>
      </div>

      {showForm && (
        <div className="rounded-lg border bg-white p-6 space-y-4">
          <h3 className="font-semibold">Create New Persona</h3>
          <Input placeholder="Persona Name (e.g. 'CTO / VP Engineering')" value={form.name || ''} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
          <Input placeholder="Description (optional)" value={form.description || ''} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="mb-2 text-sm font-medium text-slate-700">Target Role</p>
              <ChipGroup label="Seniority" options={SENIORITY_LEVELS} selected={form.seniorities || []} onToggle={(v) => toggleArray('seniorities', v)} />
              <ChipGroup label="Departments" options={DEPARTMENTS} selected={form.departments || []} onToggle={(v) => toggleArray('departments', v)} />
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-slate-700">Context</p>
              <ChipGroup label="Preferred Channels" options={CHANNELS} selected={form.preferredChannels || []} onToggle={(v) => toggleArray('preferredChannels', v)} />
            </div>
          </div>

          <TextAreaList label="Pain Points" items={form.painPoints || []} onAdd={(v) => addTextItem('painPoints', v)} onRemove={(v) => removeTextItem('painPoints', v)} placeholder="e.g. 'Struggles with lead quality'" />
          <TextAreaList label="Goals" items={form.goals || []} onAdd={(v) => addTextItem('goals', v)} onRemove={(v) => removeTextItem('goals', v)} placeholder="e.g. 'Increase pipeline velocity'" />
          <TextAreaList label="Messaging Tips" items={form.messagingTips || []} onAdd={(v) => addTextItem('messagingTips', v)} onRemove={(v) => removeTextItem('messagingTips', v)} placeholder="e.g. 'Focus on ROI and time savings'" />

          <div className="flex gap-2 pt-2">
            <Button onClick={() => { if (form.name?.trim()) createMutation.mutate(form); }} disabled={!form.name?.trim() || createMutation.isPending}>Create Persona</Button>
            <Button variant="outline" onClick={() => { setShowForm(false); setForm({}); }}>Cancel</Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded-lg bg-slate-100" />)}</div>
      ) : data?.personas?.length === 0 ? (
        <div className="py-12 text-center text-slate-500">
          <UserCircle className="mx-auto mb-2 h-8 w-8 text-slate-300" />
          <p>No personas yet. Create one to define your ideal buyer.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {data?.personas?.map((persona) => (
            <div key={persona.id} className="rounded-lg border bg-white">
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <UserCircle className="h-5 w-5 text-purple-600" />
                  <div>
                    <p className="font-semibold">{persona.name}</p>
                    {persona.description && <p className="text-xs text-slate-500">{persona.description}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {persona.contactCount !== undefined && persona.contactCount > 0 && (
                    <Badge tone="info">{persona.contactCount} contacts</Badge>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => matchMutation.mutate(persona.id)} disabled={matchMutation.isPending}>
                    <Zap className="h-4 w-4" /> Count
                  </Button>
                  <button onClick={() => setExpandedId(expandedId === persona.id ? null : persona.id)} className="rounded p-1 hover:bg-slate-100">
                    {expandedId === persona.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                  <button onClick={() => { if (confirm('Delete this persona?')) deleteMutation.mutate(persona.id); }} className="rounded p-1 text-red-400 hover:bg-red-50 hover:text-red-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              {expandedId === persona.id && (
                <div className="border-t px-4 py-3 space-y-2">
                  {persona.seniorities && persona.seniorities.length > 0 && <ChipDisplay label="Seniority" values={persona.seniorities} />}
                  {persona.departments && persona.departments.length > 0 && <ChipDisplay label="Departments" values={persona.departments} />}
                  {persona.jobTitles && persona.jobTitles.length > 0 && <ChipDisplay label="Job Titles" values={persona.jobTitles} />}
                  {persona.preferredChannels && persona.preferredChannels.length > 0 && <ChipDisplay label="Channels" values={persona.preferredChannels} />}
                  {persona.painPoints && persona.painPoints.length > 0 && <ChipDisplay label="Pain Points" values={persona.painPoints} />}
                  {persona.goals && persona.goals.length > 0 && <ChipDisplay label="Goals" values={persona.goals} />}
                  {persona.messagingTips && persona.messagingTips.length > 0 && <ChipDisplay label="Messaging" values={persona.messagingTips} />}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ChipGroup({ label, options, selected, onToggle }: { label: string; options: string[]; selected: string[]; onToggle: (v: string) => void }) {
  return (
    <div className="mb-2">
      <p className="mb-1 text-xs text-slate-500">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => (
          <button key={opt} onClick={() => onToggle(opt)} className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${selected.includes(opt) ? 'border-purple-600 bg-purple-50 text-purple-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

function ChipDisplay({ label, values }: { label: string; values: string[] }) {
  return (
    <div className="flex items-start gap-2">
      <span className="min-w-[100px] text-xs font-medium text-slate-500">{label}</span>
      <div className="flex flex-wrap gap-1">{values.map((v) => <Badge key={v} tone="muted">{v}</Badge>)}</div>
    </div>
  );
}

function TextAreaList({ label, items, onAdd, onRemove, placeholder }: { label: string; items: string[]; onAdd: (v: string) => void; onRemove: (v: string) => void; placeholder: string }) {
  const [input, setInput] = useState('');
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-slate-600">{label}</p>
      <div className="flex gap-2">
        <Input placeholder={placeholder} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { onAdd(input); setInput(''); } }} />
        <Button type="button" variant="outline" size="sm" onClick={() => { onAdd(input); setInput(''); }}>Add</Button>
      </div>
      {items.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {items.map((item) => (
            <Badge key={item} tone="muted" className="gap-1">
              {item}
              <button onClick={() => onRemove(item)} className="ml-1 hover:text-red-600">×</button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

export default Personas;
