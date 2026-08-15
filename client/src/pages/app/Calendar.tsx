import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, ChevronLeft, ChevronRight, ListChecks } from 'lucide-react';
import { useTasks } from '@/hooks/queries';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { Task } from '@/types';

const KIND_TONE: Record<string, 'primary' | 'success' | 'info' | 'warning' | 'danger' | 'muted'> = {
  FOLLOW_UP: 'primary',
  CALL: 'info',
  WHATSAPP: 'success',
  EMAIL: 'warning',
  MEETING: 'danger',
  TASK: 'muted',
};

const DOT_CLASS: Record<string, string> = {
  primary: 'bg-primary',
  success: 'bg-success',
  info: 'bg-info',
  warning: 'bg-warning',
  danger: 'bg-destructive',
  muted: 'bg-muted-foreground',
};

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function Calendar() {
  const { data, isLoading } = useTasks('all');
  const navigate = useNavigate();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const tasks = data?.tasks || [];

  const grid = useMemo(() => {
    const first = new Date(year, month, 1);
    const startPad = first.getDay(); // 0 = Sunday
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: Array<{ date: Date; inMonth: boolean }> = [];
    for (let i = 0; i < startPad; i++) {
      cells.push({ date: new Date(year, month, i - startPad + 1), inMonth: false });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ date: new Date(year, month, d), inMonth: true });
    }
    while (cells.length % 7 !== 0) cells.push({ date: new Date(year, month + 1, cells.length - startPad - daysInMonth + 1), inMonth: false });
    return cells;
  }, [year, month]);

  const tasksByDay = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of tasks) {
      const key = t.dueAt.slice(0, 10);
      const arr = map.get(key) || [];
      arr.push(t);
      map.set(key, arr);
    }
    return map;
  }, [tasks]);

  const prev = () => {
    if (month === 0) { setMonth(11); setYear(year - 1); } else setMonth(month - 1);
  };
  const next = () => {
    if (month === 11) { setMonth(0); setYear(year + 1); } else setMonth(month + 1);
  };
  const today = new Date();
  const todayKey = today.toISOString().slice(0, 10);

  const dayKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Calendar"
        description="See every follow-up, call, meeting and task on one calendar."
        actions={
          <Button variant="outline" onClick={() => navigate('/app/tasks')}>
            <ListChecks className="h-4 w-4" /> Go to follow-ups
          </Button>
        }
      />

      <Card className="p-4">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold">{MONTHS[month]} {year}</h2>
          </div>
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="icon" onClick={prev} aria-label="Previous month"><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="outline" size="sm" onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth()); }}>Today</Button>
            <Button variant="outline" size="icon" onClick={next} aria-label="Next month"><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
        ) : (
          <>
            <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border bg-muted/40">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                <div key={d} className="bg-muted/60 px-2 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{d}</div>
              ))}
              {grid.map((cell, i) => {
                const key = dayKey(cell.date);
                const dayTasks = tasksByDay.get(key) || [];
                const isToday = key === todayKey;
                return (
                  <div
                    key={i}
                    className={cn(
                      'min-h-24 bg-background p-1.5 transition-colors hover:bg-accent/50',
                      !cell.inMonth && 'bg-muted/20 text-muted-400'
                    )}
                  >
                    <p className={cn('mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold', isToday && 'bg-primary text-primary-foreground')}>
                      {cell.date.getDate()}
                    </p>
                    <div className="space-y-1">
                      {dayTasks.slice(0, 3).map((t) => (
                        <button
                          key={t.id}
                          onClick={() => t.leadId && navigate(`/app/leads/${t.leadId}`)}
                          className="block w-full truncate rounded-md border px-1.5 py-0.5 text-left text-[11px] leading-4 transition-transform hover:scale-[1.02]"
                          title={t.title}
                        >
                          <span className="flex items-center gap-1">
                            <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', DOT_CLASS[KIND_TONE[t.kind] || 'muted'])} />
                            <span className="truncate">{t.title}</span>
                          </span>
                        </button>
                      ))}
                      {dayTasks.length > 3 && (
                        <p className="px-1 text-[10px] text-muted-foreground">+{dayTasks.length - 3} more</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-primary" /> Follow-up</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-info" /> Call</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-success" /> WhatsApp</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-warning" /> Email</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-destructive" /> Meeting</span>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
