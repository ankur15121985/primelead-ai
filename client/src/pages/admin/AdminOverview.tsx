import { Link } from 'react-router-dom';
import {
  Building2, Users, ListFilter, TrendingUp, QrCode, FileText, Receipt, AlertTriangle, Trophy,
} from 'lucide-react';
import { useAdminOverview } from '@/hooks/queries';
import { PageHeader } from '@/components/ui/page-header';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate, timeAgo, formatINR } from '@/lib/format';

function Stat({ icon: Icon, label, value, tone = 'text-slate-900' }: { icon: any; label: string; value: string | number; tone?: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-amber-400">
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
          <p className={`truncate text-xl font-bold ${tone}`}>{value}</p>
        </div>
      </div>
    </Card>
  );
}

export function AdminOverview() {
  const { data, isLoading } = useAdminOverview();

  if (isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  const t = data?.totals;
  const orgs = data?.organizations || [];
  const errors = data?.recentErrors || [];
  const errCount = (list: Array<{ path: string }>) => {
    const byPath = new Map<string, number>();
    for (const e of list) byPath.set(e.path, (byPath.get(e.path) || 0) + 1);
    return [...byPath.entries()].slice(0, 6);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform overview"
        description="Everything running on this PRIMELEAD instance — across all organizations."
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <Stat icon={Building2} label="Organizations" value={`${t?.organizations ?? 0} (${t?.activeOrganizations ?? 0} active)`} />
        <Stat icon={Users} label="Users" value={t?.users ?? 0} />
        <Stat icon={ListFilter} label="Leads" value={t?.leads ?? 0} />
        <Stat icon={TrendingUp} label="Won deals" value={`${t?.wonLeads ?? 0}`} tone="text-emerald-500" />
        <Stat icon={Trophy} label="Won value" value={formatINR(t?.wonValue ?? 0)} tone="text-emerald-500" />
        <Stat icon={QrCode} label="QR codes" value={t?.qrCodes ?? 0} />
        <Stat icon={FileText} label="Quotations" value={t?.quotations ?? 0} />
        <Stat icon={Receipt} label="Invoices" value={t?.invoices ?? 0} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-0 lg:col-span-2">
          <div className="flex items-center justify-between border-b px-5 py-3.5">
            <h2 className="text-sm font-bold">Organizations</h2>
            <Link to="/admin/organizations" className="text-xs font-medium text-amber-500 hover:underline">View all →</Link>
          </div>
          <div className="divide-y divide-slate-100">
            {orgs.slice(0, 8).map((o) => (
              <Link key={o.id} to={`/admin/organizations/${o.id}`} className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-slate-50">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-xs font-bold text-amber-600">
                  {o.name[0]?.toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{o.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{o.slug} · {o.leads} leads · {o.users} users</p>
                </div>
                <div className="hidden text-right sm:block">
                  <p className="text-sm font-semibold">{formatINR(o.pipelineValue)}</p>
                  <p className="text-xs text-muted-foreground">pipeline</p>
                </div>
                <Badge tone={o.status === 'ACTIVE' ? 'success' : 'danger'}>{o.status === 'ACTIVE' ? 'Active' : 'Suspended'}</Badge>
              </Link>
            ))}
            {orgs.length === 0 && <p className="px-5 py-8 text-center text-sm text-muted-foreground">No organizations yet.</p>}
          </div>
        </Card>

        <Card className="p-0">
          <div className="flex items-center gap-2 border-b px-5 py-3.5">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <h2 className="text-sm font-bold">Recent errors</h2>
            <Badge tone={errors.length ? 'danger' : 'success'} className="ml-auto">{errors.length}</Badge>
          </div>
          {errors.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">
              No errors in the last 50 requests. 🎉
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {errCount(errors).map(([path, count]) => (
                <div key={path} className="px-5 py-3">
                  <p className="truncate text-xs font-mono text-slate-700">{path}</p>
                  <p className="text-[11px] text-muted-foreground">{count}× recently</p>
                </div>
              ))}
            </div>
          )}
          <div className="border-t px-5 py-2.5">
            <Link to="/admin/system" className="text-xs font-medium text-amber-500 hover:underline">System diagnostics →</Link>
          </div>
        </Card>
      </div>

      <Card className="p-0">
        <div className="border-b px-5 py-3.5">
          <h2 className="text-sm font-bold">Recent signups</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {(data?.recentOrganizations || []).map((o) => (
            <div key={o.id} className="flex items-center justify-between px-5 py-2.5">
              <span className="text-sm font-medium">{o.name}</span>
              <span className="text-xs text-muted-foreground">{timeAgo(o.createdAt)} · {formatDate(o.createdAt)}</span>
            </div>
          ))}
          {(data?.recentOrganizations || []).length === 0 && (
            <p className="px-5 py-6 text-center text-sm text-muted-foreground">No signups yet.</p>
          )}
        </div>
      </Card>
    </div>
  );
}
