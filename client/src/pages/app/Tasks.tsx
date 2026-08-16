import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  CheckCircle2, Phone, MessageCircle, Mail, CalendarClock, Users, AlertTriangle, ListChecks, Circle,
  Plus, Repeat, AlarmClock,
} from 'lucide-react';
import { useTasks, useCompleteTask, useCreateTask, useUpdateTask, useTeam } from '@/hooks/queries';
import { useToast } from '@/hooks/use-toast';
import { friendlyError, useAuth } from '@/hooks/use-auth';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { formatDateTime, dueLabel } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Task } from '@/types';

const VIEWS = [
  { key: 'today', label: 'Today', icon: CalendarClock },
  { key: 'overdue', label: 'Overdue', icon: AlertTriangle },
  { key: 'upcoming', label: 'Upcoming', icon: Circle },
  { key: 'missed', label: 'Missed', icon: Users },
  { key: 'done', label: 'Completed', icon: CheckCircle2 },
];

const KIND_ICONS: Record<string, typeof Phone> = {
  CALL: Phone, WHATSAPP: MessageCircle, EMAIL: Mail, MEETING: CalendarClock, FOLLOW_UP: CalendarClock, TASK: ListChecks,
};

const PRIORITY_TONE: Record<string, 'danger' | 'warning' | 'muted' | 'success'> = {
  URGENT: 'danger', HIGH: 'warning', MEDIUM: 'muted', LOW: 'success',
};

export function Tasks() {
  const [params, setParams] = useSearchParams();
  const view = params.get('view') || 'today';
  const { data, isLoading } = useTasks(view);
  const { user } = useAuth();
  const isManager = user && ['OWNER', 'ADMIN', 'MANAGER'].includes(user.role);
  const { success, error } = useToast();
  const [createOpen, setCreateOpen] = useState(false);

  const counts = data?.counts || {};
  const tasks = data?.tasks || [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Follow-ups"
        description="Who do I need to contact today? This page answers that."
        actions={<Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> New follow-up</Button>}
      />

      <div className="flex flex-wrap gap-2">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            onClick={() => setParams(v.key === 'today' ? {} : { view: v.key })}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition-all',
              view === v.key ? 'border-primary bg-primary text-primary-foreground shadow-sm' : 'bg-background hover:bg-accent'
            )}
          >
            <v.icon className="h-4 w-4" />
            {v.label}
            {counts[v.key] !== undefined && counts[v.key] > 0 && (
              <span className={cn('rounded-full px-1.5 text-[11px] font-bold', view === v.key ? 'bg-white/20' : 'bg-primary/10 text-primary')}>
                {counts[v.key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : tasks.length === 0 ? (
        <EmptyState
          icon={<ListChecks className="h-6 w-6" />}
          title={view === 'today' ? 'Nothing due today' : view === 'overdue' ? 'No overdue follow-ups 🎉' : `No ${view} follow-ups`}
          description="Follow-ups are created from lead pages or automatically when leads need attention."
          action={<Button className="mt-2" onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> New follow-up</Button>}
        />
      ) : (
        <ul className="space-y-2.5">
          {tasks.map((task) => <TaskRow key={task.id} task={task} isManager={Boolean(isManager)} />)}
        </ul>
      )}

      <CreateFollowUpDialog open={createOpen} onOpenChange={setCreateOpen} allowAssign={Boolean(isManager)} />
    </div>
  );
}

function TaskRow({ task, isManager }: { task: Task; isManager: boolean }) {
  const complete = useCompleteTask();
  const update = useUpdateTask();
  const { success, error } = useToast();
  const Icon = KIND_ICONS[task.kind] || CalendarClock;
  const dl = dueLabel(task.dueAt);
  const done = task.status === 'DONE';
  const missed = task.status === 'MISSED';

  const act = async (fn: () => Promise<unknown>, okMsg: string) => {
    try {
      await fn();
      success(okMsg);
    } catch {
      error('Could not update', 'Please try again.');
    }
  };

  const snooze = () => {
    const next = new Date(new Date(task.dueAt).getTime() + 24 * 60 * 60 * 1000);
    act(() => update.mutateAsync({ id: task.id, dueAt: next.toISOString() }), 'Snoozed by a day');
  };

  return (
    <Card className={cn('flex items-center gap-4 p-4 transition-colors', missed && 'border-amber-300/60 bg-amber-50/40')}>
      <button
        onClick={() => act(() => complete.mutateAsync(task.id), 'Done! Follow-up marked complete.')}
        disabled={done}
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 transition-all',
          done ? 'border-success bg-success text-success-foreground' : 'border-slate-300 text-transparent hover:border-primary hover:text-primary'
        )}
        aria-label={done ? 'Completed' : 'Mark complete'}
      >
        <CheckCircle2 className="h-5 w-5" />
      </button>
      <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
        dl.tone === 'danger' ? 'bg-destructive/10 text-destructive' : dl.tone === 'warning' ? 'bg-warning/15 text-warning-foreground' : 'bg-primary/10 text-primary')}>
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className={cn('font-semibold', done && 'text-muted-foreground line-through')}>{task.title}</p>
          {task.repeatEveryDays && (
            <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-700" title={`Repeats every ${task.repeatEveryDays} day${task.repeatEveryDays > 1 ? 's' : ''}`}>
              <Repeat className="h-3 w-3" /> every {task.repeatEveryDays}d
            </span>
          )}
          <Badge tone={PRIORITY_TONE[task.priority] || 'muted'}>{task.priority}</Badge>
          <Badge tone={dl.tone === 'danger' ? 'danger' : dl.tone === 'warning' ? 'warning' : 'muted'}>{dl.label}</Badge>
        </div>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {task.lead ? (
            <Link to={`/app/leads/${task.lead.id}`} className="font-medium text-primary hover:underline">{task.lead.name}</Link>
          ) : 'General task'}
          {task.lead?.phone ? ` · ${task.lead.phone}` : ''} · {formatDateTime(task.dueAt)} · {task.user?.name || 'you'}
        </p>
      </div>
      <div className="flex shrink-0 flex-col gap-1.5">
        {!done && !missed && (
          <Button size="sm" variant="outline" onClick={snooze} title="Reschedule to tomorrow"><AlarmClock className="h-3.5 w-3.5" /> Snooze</Button>
        )}
        {(done || missed) && (
          <Button size="sm" variant="outline" onClick={() => act(() => update.mutateAsync({ id: task.id, status: 'PENDING' }), 'Follow-up reopened')}>
            Reopen
          </Button>
        )}
      </div>
    </Card>
  );
}

function CreateFollowUpDialog({ open, onOpenChange, allowAssign }: { open: boolean; onOpenChange: (v: boolean) => void; allowAssign: boolean }) {
  const create = useCreateTask();
  const { data: team } = useTeam();
  const { success, error } = useToast();
  const [form, setForm] = useState({
    title: '', kind: 'CALL', priority: 'MEDIUM', dueAt: '', repeatEveryDays: '', notes: '', userId: '',
  });

  const reset = () => setForm({ title: '', kind: 'CALL', priority: 'MEDIUM', dueAt: '', repeatEveryDays: '', notes: '', userId: '' });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.dueAt) return;
    try {
      await create.mutateAsync({
        title: form.title || 'Follow up',
        kind: form.kind,
        priority: form.priority,
        repeatEveryDays: form.repeatEveryDays ? Number(form.repeatEveryDays) : null,
        dueAt: new Date(form.dueAt).toISOString(),
        notes: form.notes || undefined,
        userId: allowAssign && form.userId ? form.userId : undefined,
      });
      success('Follow-up scheduled');
      reset();
      onOpenChange(false);
    } catch (err) {
      error('Could not schedule', friendlyError(err));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Schedule a follow-up" description="The assigned person will be reminded when it's due.">
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>What needs to happen?</Label>
            <Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Call about quotation" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
                {['CALL', 'WHATSAPP', 'EMAIL', 'MEETING', 'FOLLOW_UP', 'TASK'].map((k) => <option key={k} value={k}>{k[0] + k.slice(1).toLowerCase()}</option>)}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                {['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map((p) => <option key={p} value={p}>{p[0] + p.slice(1).toLowerCase()}</option>)}
              </Select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Due date & time</Label>
              <Input required type="datetime-local" value={form.dueAt} onChange={(e) => setForm({ ...form, dueAt: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Repeat every (days)</Label>
              <Input type="number" min={1} max={365} value={form.repeatEveryDays} onChange={(e) => setForm({ ...form, repeatEveryDays: e.target.value })} placeholder="e.g. 7 for weekly" />
              <p className="text-[11px] text-muted-foreground">Completing it auto-schedules the next one.</p>
            </div>
          </div>
          {allowAssign && team && team.users.length > 0 && (
            <div className="space-y-1.5">
              <Label>Assign to</Label>
              <Select value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })}>
                <option value="">Me</option>
                {team.users.filter((u) => u.active).map((u) => <option key={u.id} value={u.id}>{u.name} ({u.role.toLowerCase()})</option>)}
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Notes (optional)</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" loading={create.isPending}><CalendarClock className="h-4 w-4" /> Schedule</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
