import { useState } from 'react';
import { Workflow, Plus, Trash2, Play, Power, ChevronDown, X } from 'lucide-react';
import { useAutomations, useCreateAutomation, useUpdateAutomation, useDeleteAutomation, useRunAutomation, useLeads } from '@/hooks/queries';
import { useToast } from '@/hooks/use-toast';
import { friendlyError, useAuth } from '@/hooks/use-auth';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { timeAgo } from '@/lib/format';
import type { AutomationAction } from '@/types';

const TRIGGER_LABEL: Record<string, string> = {
  LEAD_CREATED: 'Lead created',
  LEAD_ASSIGNED: 'Lead assigned',
  STAGE_CHANGED: 'Stage changed',
  FOLLOW_UP_OVERDUE: 'Follow-up overdue',
  INVOICE_CREATED: 'Invoice created',
  PAYMENT_RECEIVED: 'Payment received',
  QUOTATION_CREATED: 'Quotation created',
};

const ACTION_TYPES = ['CREATE_TASK', 'ADD_TAG', 'CHANGE_STAGE', 'ASSIGN_USER', 'NOTIFY_TEAM'];

export function Automations() {
  const { user } = useAuth();
  const { data, isLoading } = useAutomations();
  const update = useUpdateAutomation();
  const del = useDeleteAutomation();
  const run = useRunAutomation();
  const { success, error } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const isManager = ['OWNER', 'ADMIN', 'MANAGER'].includes(user?.role || '');

  const toggle = async (id: string, enabled: boolean) => {
    try {
      await update.mutateAsync({ id, enabled: !enabled });
      success(enabled ? 'Paused' : 'Live', enabled ? 'This rule is paused.' : 'This rule is now live.');
    } catch (err) {
      error('Could not update', friendlyError(err));
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      await del.mutateAsync(id);
      success('Deleted', `"${name}" was removed.`);
    } catch (err) {
      error('Could not delete', friendlyError(err));
    }
  };

  const handleRun = async (id: string, name: string) => {
    try {
      const res = await run.mutateAsync({ id });
      success('Ran rule', res.run?.status === 'SKIPPED' ? `${name} ran but skipped (conditions not met).` : `${name} executed.`);
    } catch (err) {
      error('Could not run', friendlyError(err));
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeader
          title="Automations"
          description="When this happens, do that — rules are data, so new workflows never need a code change."
        />
        {isManager && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> New rule
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
      ) : (data?.rules || []).length === 0 ? (
        <EmptyState
          icon={<Workflow className="h-6 w-6" />}
          title="No automation rules yet"
          description="Create your first rule — e.g. 'When a lead is created from IndiaMART, add the tag hot-lead and assign it round-robin.'"
          action={isManager ? <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> New rule</Button> : undefined}
        />
      ) : (
        <div className="space-y-3">
          {(data?.rules || []).map((rule) => (
            <Card key={rule.id} className="flex flex-wrap items-center gap-3 p-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Workflow className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">{rule.name}</p>
                  <Badge tone="info">{TRIGGER_LABEL[rule.trigger] || rule.trigger}</Badge>
                  {!rule.enabled && <Badge tone="muted">Paused</Badge>}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {rule.actions.length} action{rule.actions.length === 1 ? '' : 's'}
                  {rule.triggerConfig?.source ? ` · source: ${String(rule.triggerConfig.source)}` : ''}
                  {rule.triggerConfig?.minValue ? ` · min value ₹${Number(rule.triggerConfig.minValue).toLocaleString('en-IN')}` : ''}
                  {' · '}{rule.runCount} run{rule.runCount === 1 ? '' : 's'}{rule.lastRunAt ? ` · last ${timeAgo(rule.lastRunAt)}` : ''}
                </p>
              </div>
              {isManager && (
                <div className="flex items-center gap-1.5">
                  <Button size="sm" variant="outline" onClick={() => handleRun(rule.id, rule.name)} loading={run.isPending && run.variables?.id === rule.id}>
                    <Play className="h-3.5 w-3.5" /> Run
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => toggle(rule.id, rule.enabled)}>
                    <Power className="h-3.5 w-3.5" /> {rule.enabled ? 'Pause' : 'Resume'}
                  </Button>
                  <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => handleDelete(rule.id, rule.name)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Recent runs */}
      <div>
        <h2 className="mb-2 text-sm font-semibold">Recent runs</h2>
        <Card className="divide-y">
          {(data?.runs || []).length === 0 && <p className="p-4 text-center text-xs text-muted-foreground">No runs yet — they appear as triggers fire.</p>}
          {(data?.runs || []).map((r) => (
            <div key={r.id} className="flex items-center gap-3 px-4 py-2.5 text-xs">
              <Badge tone={r.status === 'SUCCESS' ? 'success' : r.status === 'SKIPPED' ? 'info' : r.status === 'PARTIAL' ? 'warning' : 'danger'}>{r.status}</Badge>
              <span className="font-medium">{r.ruleName || TRIGGER_LABEL[r.trigger]}</span>
              <span className="truncate text-muted-foreground">
                {(r.result as any)?.actions?.map((a: any) => a.message).join(' · ') || (r.result as any)?.reason || r.entityType}
              </span>
              <span className="ml-auto shrink-0 text-muted-foreground">{timeAgo(r.createdAt)}</span>
            </div>
          ))}
        </Card>
      </div>

      {createOpen && <RuleDialog triggers={data?.triggers || []} onClose={() => setCreateOpen(false)} />}
    </div>
  );
}

function RuleDialog({ triggers, onClose }: { triggers: string[]; onClose: () => void }) {
  const create = useCreateAutomation();
  const { success, error } = useToast();
  const { data: leads } = useLeads({ pageSize: 50 });
  const run = useRunAutomation();
  const [name, setName] = useState('');
  const [trigger, setTrigger] = useState('LEAD_CREATED');
  const [source, setSource] = useState('');
  const [actions, setActions] = useState<AutomationAction[]>([{ type: 'CREATE_TASK', title: '', dueInDays: 1 }]);
  const [runLeadId, setRunLeadId] = useState('');
  const [busy, setBusy] = useState(false);

  const updateAction = (i: number, patch: Partial<AutomationAction>) => {
    setActions((prev) => prev.map((a, idx) => (idx === i ? { ...a, ...patch } : a)));
  };

  const save = async (andRun = false) => {
    if (name.trim().length < 2) return;
    setBusy(true);
    try {
      const payload = {
        name: name.trim(),
        trigger,
        ...(source ? { triggerConfig: { source } } : {}),
        actions: actions
          .filter((a) => a.type)
          .map((a) => ({
            type: a.type,
            ...(a.title ? { title: a.title } : {}),
            ...(a.tag ? { tag: a.tag } : {}),
            ...(a.stageName ? { stageName: a.stageName } : {}),
            ...(a.message ? { message: a.message } : {}),
            ...(a.dueInDays !== undefined && a.dueInDays > 0 ? { dueInDays: a.dueInDays } : {}),
          })),
      };
      const res = await create.mutateAsync(payload);
      success('Rule created', `"${res.rule.name}" is live.`);
      if (andRun && runLeadId) {
        await run.mutateAsync({ id: res.rule.id, leadId: runLeadId });
        success('Tested', 'Rule ran against the selected lead.');
      }
      onClose();
    } catch (err) {
      error('Could not create', friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent title="New automation rule" description="Rules are data — pick a trigger, optionally narrow it, and list the actions to run." className="max-w-xl">
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Rule name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. IndiaMART leads get a follow-up task" />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">When (trigger)</label>
              <Select value={trigger} onChange={(e) => setTrigger(e.target.value)}>
                {(triggers || []).map((t) => (
                  <option key={t} value={t}>{TRIGGER_LABEL[t] || t}</option>
                ))}
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Only from source (optional)</label>
              <Select value={source} onChange={(e) => setSource(e.target.value)}>
                <option value="">Any source</option>
                {['WEBSITE', 'WHATSAPP', 'INDIAMART', 'FACEBOOK', 'INSTAGRAM', 'GOOGLE_ADS', 'QR', 'MANUAL'].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </Select>
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">Then (actions)</p>
            <div className="space-y-2">
              {actions.map((a, i) => (
                <div key={i} className="rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    <Select value={a.type} onChange={(e) => updateAction(i, { type: e.target.value })} className="w-44" aria-label="Action type">
                      {ACTION_TYPES.map((t) => (
                        <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                      ))}
                    </Select>
                    <button onClick={() => setActions((prev) => prev.filter((_, idx) => idx !== i))} className="ml-auto rounded p-1 text-muted-foreground hover:bg-accent" aria-label="Remove action">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-3">
                    {a.type === 'CREATE_TASK' && (
                      <>
                        <Input value={a.title || ''} onChange={(e) => updateAction(i, { title: e.target.value })} placeholder="Task title" className="sm:col-span-2" />
                        <Input type="number" min={0} max={365} value={a.dueInDays ?? 1} onChange={(e) => updateAction(i, { dueInDays: Number(e.target.value) })} placeholder="Due in days" />
                      </>
                    )}
                    {a.type === 'ADD_TAG' && (
                      <Input value={a.tag || ''} onChange={(e) => updateAction(i, { tag: e.target.value })} placeholder="Tag name" className="sm:col-span-3" />
                    )}
                    {a.type === 'CHANGE_STAGE' && (
                      <Input value={a.stageName || ''} onChange={(e) => updateAction(i, { stageName: e.target.value })} placeholder="Stage name (e.g. Qualified)" className="sm:col-span-3" />
                    )}
                    {a.type === 'ASSIGN_USER' && (
                      <Select value={a.mode || 'roundRobin'} onChange={(e) => updateAction(i, { mode: e.target.value })} className="sm:col-span-3">
                        <option value="roundRobin">Round-robin (least-loaded salesperson)</option>
                        <option value="leadOwner">Keep the current owner</option>
                      </Select>
                    )}
                    {a.type === 'NOTIFY_TEAM' && (
                      <Input value={a.message || ''} onChange={(e) => updateAction(i, { message: e.target.value })} placeholder="Notification message" className="sm:col-span-3" />
                    )}
                  </div>
                </div>
              ))}
            </div>
            <Button size="sm" variant="ghost" className="mt-2" onClick={() => setActions((prev) => [...prev, { type: 'CREATE_TASK' }])}>
              <Plus className="h-3.5 w-3.5" /> Add action
            </Button>
          </div>

          <div className="rounded-lg border bg-muted/40 p-3">
            <p className="mb-1 text-xs font-semibold">Test the rule</p>
            <div className="flex items-center gap-2">
              <Select value={runLeadId} onChange={(e) => setRunLeadId(e.target.value)} aria-label="Pick a lead to test against">
                <option value="">Pick a lead (optional)…</option>
                {(leads?.rows || []).map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </Select>
              <Button size="sm" variant="outline" onClick={() => save(true)} disabled={busy || name.trim().length < 2 || !runLeadId}>
                <ChevronDown className="h-3.5 w-3.5 rotate-180" /> Save & test
              </Button>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={() => save(false)} loading={busy} disabled={name.trim().length < 2}>Create rule</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
