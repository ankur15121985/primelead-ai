import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  CheckCircle2, Phone, MessageCircle, Mail, CalendarClock, Users, AlertTriangle, ListChecks, Circle,
} from 'lucide-react';
import { useTasks, useCompleteTask } from '@/hooks/queries';
import { useToast } from '@/hooks/use-toast';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
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

export function Tasks() {
  const [params, setParams] = useSearchParams();
  const view = params.get('view') || 'today';
  const { data, isLoading } = useTasks(view);
  const complete = useCompleteTask();
  const { success, error } = useToast();

  const counts = data?.counts || {};
  const tasks = data?.tasks || [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Follow-ups"
        description="Who do I need to contact today? This page answers that."
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
          action={<Link to="/app/leads"><Button className="mt-2">Go to leads</Button></Link>}
        />
      ) : (
        <ul className="space-y-2.5">
          {tasks.map((task) => <TaskRow key={task.id} task={task} onComplete={async () => {
            try {
              await complete.mutateAsync(task.id);
              success('Done!', 'Follow-up marked complete.');
            } catch (err) {
              error('Could not update', 'Please try again.');
            }
          }} />)}
        </ul>
      )}
    </div>
  );
}

function TaskRow({ task, onComplete }: { task: Task; onComplete: () => void }) {
  const Icon = KIND_ICONS[task.kind] || CalendarClock;
  const dl = dueLabel(task.dueAt);
  const done = task.status === 'DONE';
  const missed = task.status === 'MISSED';

  return (
    <Card className={cn('flex items-center gap-4 p-4 transition-colors', missed && 'border-amber-300/60 bg-amber-50/40')}>
      <button
        onClick={onComplete}
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
          <Badge tone={dl.tone === 'danger' ? 'danger' : dl.tone === 'warning' ? 'warning' : 'muted'}>{dl.label}</Badge>
        </div>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {task.lead ? (
            <Link to={`/app/leads/${task.lead.id}`} className="font-medium text-primary hover:underline">{task.lead.name}</Link>
          ) : 'General task'}
          {task.lead?.phone ? ` · ${task.lead.phone}` : ''} · {formatDateTime(task.dueAt)} · {task.user?.name || 'you'}
        </p>
      </div>
    </Card>
  );
}
