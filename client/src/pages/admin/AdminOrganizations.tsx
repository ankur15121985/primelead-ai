import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, PauseCircle, PlayCircle, ArrowRight } from 'lucide-react';
import { useAdminOrgs, useAdminUpdateOrg } from '@/hooks/queries';
import { useToast } from '@/hooks/use-toast';
import { friendlyError } from '@/hooks/use-auth';
import { PageHeader } from '@/components/ui/page-header';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { formatINR, formatDate } from '@/lib/format';
import type { AdminOrg } from '@/types';

const PLANS = ['STARTER', 'GROWTH', 'BUSINESS'];

function OrgRow({ org, onChanged }: { org: AdminOrg; onChanged: () => void }) {
  const updateOrg = useAdminUpdateOrg();
  const { success, error } = useToast();
  const [busy, setBusy] = useState(false);

  const act = async (fn: () => Promise<unknown>, okMsg: string) => {
    setBusy(true);
    try {
      await fn();
      success(okMsg, `${org.name} updated.`);
      onChanged();
    } catch (err) {
      error('Update failed', friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  const toggle = () =>
    act(
      () => updateOrg.mutateAsync({ id: org.id, status: org.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE' }),
      org.status === 'ACTIVE' ? 'Organization suspended' : 'Organization re-activated'
    );

  const changePlan = (plan: string) => {
    if (plan === org.plan) return;
    if (!window.confirm(`Change ${org.name} from ${org.plan} to ${plan}? This affects their feature limits.`)) return;
    act(() => updateOrg.mutateAsync({ id: org.id, plan }), 'Plan changed');
  };

  return (
    <div className="flex flex-wrap items-center gap-4 px-5 py-3.5 hover:bg-slate-50/60">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-sm font-bold text-amber-600">
        {org.name[0]?.toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <Link to={`/admin/organizations/${org.id}`} className="group inline-flex items-center gap-1 text-sm font-semibold hover:text-amber-600">
          {org.name}
          <ArrowRight className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
        </Link>
        <p className="truncate text-xs text-muted-foreground">
          {org.slug} · since {formatDate(org.createdAt)} · {org.businessType || '—'}
        </p>
      </div>
      <div className="flex items-center gap-2 text-center text-xs">
        <div className="w-14"><p className="font-semibold">{org.users}</p><p className="text-muted-foreground">users</p></div>
        <div className="w-14"><p className="font-semibold">{org.leads}</p><p className="text-muted-foreground">leads</p></div>
        <div className="w-20"><p className="font-semibold">{formatINR(org.pipelineValue)}</p><p className="text-muted-foreground">pipeline</p></div>
      </div>
      <Badge tone={org.status === 'ACTIVE' ? 'success' : 'danger'}>{org.status === 'ACTIVE' ? 'Active' : 'Suspended'}</Badge>
      <Select
        value={org.plan}
        disabled={busy}
        onChange={(e) => changePlan(e.target.value)}
        className="h-8 w-28 text-xs"
        aria-label={`Plan for ${org.name}`}
      >
        {PLANS.map((p) => <option key={p} value={p}>{p[0] + p.slice(1).toLowerCase()}</option>)}
      </Select>
      <Button
        variant={org.status === 'ACTIVE' ? 'outline' : 'primary'}
        size="sm"
        loading={busy}
        onClick={toggle}
        className="whitespace-nowrap"
      >
        {org.status === 'ACTIVE' ? <><PauseCircle className="h-4 w-4" /> Suspend</> : <><PlayCircle className="h-4 w-4" /> Re-activate</>}
      </Button>
    </div>
  );
}

export function AdminOrganizations() {
  const { data, isLoading, refetch } = useAdminOrgs();

  return (
    <div className="space-y-5">
      <PageHeader
        title="Organizations"
        description="Every tenant on the platform. Suspend accounts that violate terms, or move them between plans."
      />

      {isLoading ? (
        <Skeleton className="h-96" />
      ) : (
        <Card className="p-0">
          <div className="flex items-center gap-2 border-b px-5 py-3.5">
            <Building2 className="h-4 w-4 text-amber-500" />
            <h2 className="text-sm font-bold">{data?.organizations.length ?? 0} organizations</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {(data?.organizations || []).map((org) => (
              <OrgRow key={org.id} org={org} onChanged={() => refetch()} />
            ))}
            {(data?.organizations || []).length === 0 && (
              <p className="px-5 py-10 text-center text-sm text-muted-foreground">No organizations registered yet.</p>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
