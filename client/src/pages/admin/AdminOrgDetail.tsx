import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft, Users, ListFilter, TrendingUp, Activity as ActivityIcon, PauseCircle, PlayCircle, Receipt,
} from 'lucide-react';
import { useAdminOrg, useAdminUpdateOrg } from '@/hooks/queries';
import { useToast } from '@/hooks/use-toast';
import { friendlyError } from '@/hooks/use-auth';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { formatINR, formatDate, formatDateTime, timeAgo } from '@/lib/format';
import { STATUS_META } from '@/lib/constants';

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3.5">
      <div className="flex items-center gap-2 text-amber-400">
        <Icon className="h-4 w-4" />
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      </div>
      <p className="mt-1 text-lg font-bold text-white">{value}</p>
    </div>
  );
}

export function AdminOrgDetail() {
  const { id = '' } = useParams();
  const { data, isLoading } = useAdminOrg(id);
  const updateOrg = useAdminUpdateOrg();
  const { success, error } = useToast();

  if (isLoading || !data) return <Skeleton className="h-96" />;

  const { org, users, recentLeads, recentActivity, subscription, stats } = data;

  const toggleStatus = async () => {
    try {
      await updateOrg.mutateAsync({ id: org.id, status: org.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE' });
      success('Updated', `${org.name} is now ${org.status === 'ACTIVE' ? 'suspended' : 'active'}.`);
    } catch (err) {
      error('Update failed', friendlyError(err));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/admin/organizations" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-400 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Organizations
        </Link>
        <span className="text-slate-600">/</span>
        <h1 className="text-xl font-bold text-white">{org.name}</h1>
        <Badge tone={org.status === 'ACTIVE' ? 'success' : 'danger'}>{org.status}</Badge>
        <Badge tone="primary">{org.plan}</Badge>
        {subscription && <Badge tone="muted">{subscription.status.toLowerCase()} · {subscription.period.toLowerCase()}</Badge>}
      </div>
      <p className="text-sm text-slate-400">slug: {org.slug} · created {formatDate(org.createdAt)}</p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <Stat icon={Users} label="Users" value={stats.users} />
        <Stat icon={ListFilter} label="Leads" value={stats.leads} />
        <Stat icon={ListFilter} label="Open" value={stats.openLeads} />
        <Stat icon={TrendingUp} label="Pipeline" value={formatINR(stats.pipelineValue)} />
        <Stat icon={Receipt} label="Overdue tasks" value={stats.overdueTasks} />
        <Stat icon={ActivityIcon} label="QR codes" value={stats.qrCodes} />
      </div>

      <div className="flex items-center gap-2">
        <Button variant={org.status === 'ACTIVE' ? 'destructive' : 'primary'} onClick={toggleStatus} loading={updateOrg.isPending}>
          {org.status === 'ACTIVE' ? <><PauseCircle className="h-4 w-4" /> Suspend organization</> : <><PlayCircle className="h-4 w-4" /> Re-activate</>}
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-0">
          <div className="border-b px-5 py-3.5"><h2 className="text-sm font-bold">Team ({users.length})</h2></div>
          <div className="divide-y divide-slate-100">
            {users.map((u) => (
              <div key={u.id} className="flex items-center justify-between px-5 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{u.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone="muted">{u.role}</Badge>
                  {!u.active && <Badge tone="danger">Off</Badge>}
                </div>
              </div>
            ))}
            {users.length === 0 && <p className="px-5 py-6 text-center text-sm text-muted-foreground">No users.</p>}
          </div>
        </Card>

        <Card className="p-0">
          <div className="border-b px-5 py-3.5"><h2 className="text-sm font-bold">Recent leads</h2></div>
          <div className="divide-y divide-slate-100">
            {recentLeads.map((l) => (
              <div key={l.id} className="px-5 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium">{l.name}</p>
                  <Badge tone={STATUS_META[l.status]?.className ? 'default' : 'muted'} className={STATUS_META[l.status]?.className}>
                    {STATUS_META[l.status]?.label || l.status}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {l.phone || l.email || 'no contact'} · {l.owner?.name || 'unassigned'} · {timeAgo(l.createdAt)}
                </p>
              </div>
            ))}
            {recentLeads.length === 0 && <p className="px-5 py-6 text-center text-sm text-muted-foreground">No leads yet.</p>}
          </div>
        </Card>

        <Card className="p-0">
          <div className="border-b px-5 py-3.5"><h2 className="text-sm font-bold">Recent activity</h2></div>
          <div className="divide-y divide-slate-100">
            {recentActivity.map((a) => (
              <div key={a.id} className="px-5 py-2.5">
                <p className="truncate text-sm font-medium">{a.title}</p>
                <p className="line-clamp-1 text-xs text-muted-foreground">
                  {a.user?.name || 'system'} {a.lead ? `· ${a.lead.name}` : ''} · {formatDateTime(a.createdAt)}
                </p>
              </div>
            ))}
            {recentActivity.length === 0 && <p className="px-5 py-6 text-center text-sm text-muted-foreground">No activity yet.</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}
