import { useState } from 'react';
import { CreditCard, Check, Zap, Calendar, BadgeCheck } from 'lucide-react';
import { useBilling, useUpgradePlan, useCancelSubscription } from '@/hooks/queries';
import { useToast } from '@/hooks/use-toast';
import { friendlyError } from '@/hooks/use-auth';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { inr } from './Quotations';

export function Billing() {
  const { data, isLoading } = useBilling();
  const upgrade = useUpgradePlan();
  const cancel = useCancelSubscription();
  const { success, error } = useToast();
  const [period, setPeriod] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY');

  const plan = data?.currentPlan;
  const subscription = data?.subscription;

  const changePlan = async (slug: string) => {
    if (slug === plan?.slug) return;
    try {
      const res = await upgrade.mutateAsync({ planSlug: slug, period });
      if (res.applied) {
        success('Plan updated', `You are now on the ${res.plan} plan (${res.mode === 'demo' ? 'demo mode — no payment taken' : 'provider checkout sent'}).`);
      } else {
        success('Checkout prepared', 'Complete payment to activate your new plan.');
      }
    } catch (err) {
      error('Could not update plan', friendlyError(err));
    }
  };

  const handleCancel = async () => {
    if (!window.confirm('Cancel your subscription? You can restart anytime.')) return;
    try {
      await cancel.mutateAsync();
      success('Subscription cancelled');
    } catch (err) {
      error('Could not cancel', friendlyError(err));
    }
  };

  if (isLoading) return <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}</div>;
  if (!data) return <p className="text-sm text-muted-foreground">Billing is unavailable right now.</p>;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Billing & plan"
        description="Manage your LeadFlow subscription. In demo mode plan changes apply instantly without payment."
      />

      {/* Current subscription */}
      <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><CreditCard className="h-5 w-5" /></span>
          <div>
            <p className="text-lg font-bold">{plan?.name || data.org.plan} plan</p>
            <p className="text-xs text-muted-foreground">
              {subscription?.status === 'TRIAL' ? 'Trial' : subscription?.status || 'Active'}
              {subscription?.period === 'YEARLY' ? ' · billed yearly' : ' · billed monthly'}
              {data.gateway.configured ? ` · ${data.gateway.provider}` : ' · demo mode'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {subscription?.status === 'CANCELLED' ? (
            <Badge tone="danger">Cancelled</Badge>
          ) : subscription?.status === 'TRIAL' ? (
            <Badge tone="warning">Trial</Badge>
          ) : (
            <Badge tone="success"><BadgeCheck className="h-3 w-3" /> Active</Badge>
          )}
          <Button variant="outline" size="sm" onClick={handleCancel}>Cancel</Button>
        </div>
      </Card>

      {/* Plan toggle */}
      <div className="flex items-center justify-center gap-2">
        <Button variant={period === 'MONTHLY' ? 'primary' : 'outline'} size="sm" onClick={() => setPeriod('MONTHLY')}>Monthly</Button>
        <Button variant={period === 'YEARLY' ? 'primary' : 'outline'} size="sm" onClick={() => setPeriod('YEARLY')}>
          Yearly <Badge tone="success" className="ml-1">Save ~17%</Badge>
        </Button>
      </div>

      {/* Plans */}
      <div className="grid gap-4 lg:grid-cols-3">
        {data.plans.map((p) => {
          const isCurrent = p.slug === plan?.slug;
          const price = period === 'YEARLY' ? p.priceYearly : p.priceMonthly;
          return (
            <Card key={p.slug} className={cn('flex flex-col p-6', isCurrent && 'border-primary ring-2 ring-primary/20')}>
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold">{p.name}</h3>
                {isCurrent && <Badge tone="primary">Current plan</Badge>}
              </div>
              <p className="mt-2 text-3xl font-extrabold tracking-tight">
                {price === 0 ? 'Free' : `₹${price.toLocaleString('en-IN')}`}
                <span className="text-sm font-normal text-muted-foreground">/{period === 'YEARLY' ? 'year' : 'month'}</span>
              </p>
              <ul className="mt-4 flex-1 space-y-2">
                {(p.features || []).map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button
                className="mt-5"
                variant={isCurrent ? 'outline' : 'primary'}
                disabled={isCurrent}
                loading={upgrade.isPending && upgrade.variables?.planSlug === p.slug}
                onClick={() => changePlan(p.slug)}
              >
                <Zap className="h-4 w-4" /> {isCurrent ? 'Current plan' : `Switch to ${p.name}`}
              </Button>
            </Card>
          );
        })}
      </div>

      {/* Payment history */}
      <Card className="p-5">
        <p className="mb-1 font-semibold">Payment history</p>
        <p className="mb-3 text-xs text-muted-foreground">All payments recorded against this organization.</p>
        {data.payments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No payments yet.</p>
        ) : (
          <div className="space-y-2">
            {data.payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2.5 text-sm">
                <span className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  {new Date(p.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  <span className="text-xs text-muted-foreground capitalize">· {p.provider || 'manual'}</span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="font-semibold">{inr(p.amount)}</span>
                  <Badge tone={p.status === 'SUCCEEDED' ? 'success' : p.status === 'PENDING' ? 'warning' : 'danger'}>{p.status}</Badge>
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
