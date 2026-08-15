import { Activity, Database, Cpu, HardDrive, Server, Trash2, Clock } from 'lucide-react';
import { useAdminSystem, useAdminClearErrors, useAdminOverview } from '@/hooks/queries';
import { PageHeader } from '@/components/ui/page-header';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { timeAgo } from '@/lib/format';

function fmtBytes(n: number): string {
  const mb = n / (1024 * 1024);
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb.toFixed(0)} MB`;
}

function fmtUptime(sec: number): string {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  return `${m}m`;
}

export function AdminSystem() {
  const { data, isLoading } = useAdminSystem();
  const { data: overview } = useAdminOverview();
  const clearErrors = useAdminClearErrors();

  if (isLoading || !data) return <Skeleton className="h-96" />;

  const errors = overview?.recentErrors || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="System diagnostics"
        description="Server health, memory, database connectivity and the recent error feed."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-amber-500"><Clock className="h-4 w-4" /><p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Uptime</p></div>
          <p className="mt-1.5 text-xl font-bold">{fmtUptime(data.uptimeSeconds)}</p>
          <p className="text-xs text-muted-foreground">since {timeAgo(data.startedAt)}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-amber-500"><Database className="h-4 w-4" /><p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Database</p></div>
          <p className="mt-1.5 flex items-center gap-2 text-xl font-bold">
            {data.database.connected ? 'Connected' : 'Unreachable'}
            <Badge tone={data.database.connected ? 'success' : 'danger'}>{data.database.provider}</Badge>
          </p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-amber-500"><Cpu className="h-4 w-4" /><p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Node</p></div>
          <p className="mt-1.5 text-xl font-bold">{data.node}</p>
          <p className="text-xs text-muted-foreground">{data.platform} · {data.cpus} CPUs</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-amber-500"><HardDrive className="h-4 w-4" /><p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Memory (RSS)</p></div>
          <p className="mt-1.5 text-xl font-bold">{fmtBytes(data.memory.rss)}</p>
          <p className="text-xs text-muted-foreground">heap {fmtBytes(data.memory.heapUsed)} / {fmtBytes(data.memory.heapTotal)}</p>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-0">
          <div className="flex items-center gap-2 border-b px-5 py-3.5">
            <Server className="h-4 w-4 text-amber-500" />
            <h2 className="text-sm font-bold">Environment</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {Object.entries(data.env).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-4 px-5 py-2.5">
                <span className="font-mono text-xs text-muted-foreground">{k}</span>
                <span className="truncate font-mono text-xs text-slate-700">{String(v) || '—'}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-0">
          <div className="flex items-center justify-between border-b px-5 py-3.5">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-amber-500" />
              <h2 className="text-sm font-bold">Recent errors</h2>
              <Badge tone={errors.length ? 'danger' : 'success'}>{errors.length}</Badge>
            </div>
            <Button variant="outline" size="sm" onClick={() => clearErrors.mutateAsync()} loading={clearErrors.isPending}>
              <Trash2 className="h-3.5 w-3.5" /> Clear
            </Button>
          </div>
          {errors.length === 0 ? (
            <p className="px-5 py-12 text-center text-sm text-muted-foreground">The feed is clean — no recent errors. 🎉</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {errors.map((e, i) => (
                <div key={i} className="px-5 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs text-slate-700">{e.method} {e.path}</span>
                    <Badge tone={e.status >= 500 ? 'danger' : 'warning'}>{e.status} {e.code}</Badge>
                  </div>
                  <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{e.message}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{timeAgo(e.at)}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
