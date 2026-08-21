import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Target, Plus, Trash2, ChevronDown, ChevronUp, Building2, Users, Globe, Zap } from 'lucide-react';

interface Icp {
  id: string;
  name: string;
  description?: string | null;
  industries?: string[] | null;
  employeeRanges?: string[] | null;
  revenueRanges?: string[] | null;
  countries?: string[] | null;
  companyTypes?: string[] | null;
  technologies?: string[] | null;
  jobTitles?: string[] | null;
  seniorities?: string[] | null;
  departments?: string[] | null;
  buyingSignals?: string[] | null;
  painPoints?: string[] | null;
  keywords?: string[] | null;
  matchScore?: number;
  isActive?: boolean;
}

const INDUSTRIES = ['TECHNOLOGY', 'HEALTHCARE', 'FINANCE', 'MANUFACTURING', 'RETAIL', 'EDUCATION', 'REAL_ESTATE', 'ENERGY', 'CONSULTING', 'LEGAL', 'MEDIA', 'OTHER'];
const EMPLOYEE_RANGES = ['1-10', '11-50', '51-200', '201-500', '501-1000', '1001-5000', '5001-10000', '10001+'];
const REVENUE_RANGES = ['0-1M', '1M-10M', '10M-50M', '50M-100M', '100M-500M', '500M-1B', '1B+'];
const SENIORITY_LEVELS = ['C_LEVEL', 'VP', 'DIRECTOR', 'MANAGER', 'SENIOR', 'STAFF', 'INTERN'];
const DEPARTMENTS = ['ENGINEERING', 'SALES', 'MARKETING', 'FINANCE', 'HR', 'LEGAL', 'OPERATIONS', 'EXECUTIVE', 'PRODUCT', 'DESIGN'];

export function IcpBuilder() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Icp>>({});

  const { data, isLoading } = useQuery<{ icps: Icp[] }>({
    queryKey: ['icps'],
    queryFn: async () => api<{ icps: Icp[] }>('/icps'),
  });

  const createMutation = useMutation({
    mutationFn: async (input: Partial<Icp>) => api<{ icp: Icp }>('/icps', { method: 'POST', body: input }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['icps'] }); setShowForm(false); setForm({}); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api<{ deleted: boolean }>(`/icps/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['icps'] }),
  });

  const matchMutation = useMutation({
    mutationFn: async (id: string) => api<{ count: number }>(`/icps/${id}/match-count`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['icps'] }),
  });

  const toggleArray = (field: string, value: string) => {
    setForm((prev) => {
      const arr = (prev as Record<string, unknown>)[field] as string[] | undefined;
      const current = arr || [];
      const updated = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
      return { ...prev, [field]: updated.length > 0 ? updated : null };
    });
  };

  const handleCreate = () => {
    if (!form.name?.trim()) return;
    createMutation.mutate(form);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">ICP Builder</h1>
          <p className="text-sm text-slate-500">Define your Ideal Customer Profile to find best-fit companies</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="mr-2 h-4 w-4" /> New ICP
        </Button>
      </div>

      {showForm && (
        <div className="rounded-lg border bg-white p-6 space-y-4">
          <h3 className="font-semibold">Create New ICP</h3>
          <Input placeholder="ICP Name (e.g. 'Indian SaaS 50-500')" value={form.name || ''} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
          <Input placeholder="Description (optional)" value={form.description || ''} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />

          <Section title="Company Criteria" icon={<Building2 className="h-4 w-4" />}>
            <ChipGroup label="Industries" options={INDUSTRIES} selected={form.industries || []} onToggle={(v) => toggleArray('industries', v)} />
            <ChipGroup label="Employee Size" options={EMPLOYEE_RANGES} selected={form.employeeRanges || []} onToggle={(v) => toggleArray('employeeRanges', v)} />
            <ChipGroup label="Revenue" options={REVENUE_RANGES} selected={form.revenueRanges || []} onToggle={(v) => toggleArray('revenueRanges', v)} />
            <ChipGroup label="Company Type" options={['PRIVATE', 'PUBLIC', 'NON_PROFIT', 'PARTNERSHIP']} selected={form.companyTypes || []} onToggle={(v) => toggleArray('companyTypes', v)} />
          </Section>

          <Section title="Contact Criteria" icon={<Users className="h-4 w-4" />}>
            <ChipGroup label="Seniority" options={SENIORITY_LEVELS} selected={form.seniorities || []} onToggle={(v) => toggleArray('seniorities', v)} />
            <ChipGroup label="Departments" options={DEPARTMENTS} selected={form.departments || []} onToggle={(v) => toggleArray('departments', v)} />
          </Section>

          <div className="flex gap-2 pt-2">
            <Button onClick={handleCreate} disabled={!form.name?.trim() || createMutation.isPending}>Create ICP</Button>
            <Button variant="outline" onClick={() => { setShowForm(false); setForm({}); }}>Cancel</Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded-lg bg-slate-100" />)}</div>
      ) : data?.icps?.length === 0 ? (
        <div className="py-12 text-center text-slate-500">
          <Target className="mx-auto mb-2 h-8 w-8 text-slate-300" />
          <p>No ICPs yet. Create one to start defining your ideal customer.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {data?.icps?.map((icp) => (
            <div key={icp.id} className="rounded-lg border bg-white">
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <Target className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="font-semibold">{icp.name}</p>
                    {icp.description && <p className="text-xs text-slate-500">{icp.description}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {icp.matchScore !== undefined && (
                    <Badge tone="info">{icp.matchScore} matches</Badge>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => matchMutation.mutate(icp.id)} disabled={matchMutation.isPending}>
                    <Zap className="h-4 w-4" /> Count
                  </Button>
                  <button onClick={() => setExpandedId(expandedId === icp.id ? null : icp.id)} className="rounded p-1 hover:bg-slate-100">
                    {expandedId === icp.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                  <button onClick={() => { if (confirm('Delete this ICP?')) deleteMutation.mutate(icp.id); }} className="rounded p-1 text-red-400 hover:bg-red-50 hover:text-red-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              {expandedId === icp.id && (
                <div className="border-t px-4 py-3 space-y-2">
                  {icp.industries && icp.industries.length > 0 && <ChipDisplay label="Industries" values={icp.industries} />}
                  {icp.employeeRanges && icp.employeeRanges.length > 0 && <ChipDisplay label="Size" values={icp.employeeRanges} />}
                  {icp.revenueRanges && icp.revenueRanges.length > 0 && <ChipDisplay label="Revenue" values={icp.revenueRanges} />}
                  {icp.countries && icp.countries.length > 0 && <ChipDisplay label="Countries" values={icp.countries} />}
                  {icp.seniorities && icp.seniorities.length > 0 && <ChipDisplay label="Seniority" values={icp.seniorities} />}
                  {icp.departments && icp.departments.length > 0 && <ChipDisplay label="Departments" values={icp.departments} />}
                  {icp.jobTitles && icp.jobTitles.length > 0 && <ChipDisplay label="Job Titles" values={icp.jobTitles} />}
                  {icp.technologies && icp.technologies.length > 0 && <ChipDisplay label="Technologies" values={icp.technologies} />}
                  {icp.keywords && icp.keywords.length > 0 && <ChipDisplay label="Keywords" values={icp.keywords} />}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">{icon}{title}</div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function ChipGroup({ label, options, selected, onToggle }: { label: string; options: string[]; selected: string[]; onToggle: (v: string) => void }) {
  return (
    <div>
      <p className="mb-1 text-xs text-slate-500">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => (
          <button key={opt} onClick={() => onToggle(opt)} className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${selected.includes(opt) ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
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
      <div className="flex flex-wrap gap-1">
        {values.map((v) => <Badge key={v} tone="muted">{v}</Badge>)}
      </div>
    </div>
  );
}

export default IcpBuilder;
