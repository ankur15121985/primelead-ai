import { useEffect, useState } from 'react';
import { CreditCard, Check, Zap, Calendar, BadgeCheck, ExternalLink, FlaskConical, Users, UserRound, RotateCcw, Undo2, Download, PieChart } from 'lucide-react';
import { useBilling, useUpgradePlan, useCancelSubscription, useCheckPayment, useCompleteDemoPayment, useRefundPayment, useRenewDemo, useReconciliation, downloadPaymentsCsv } from '@/hooks/queries';
import { useToast } from '@/hooks/use-toast';
import { friendlyError, useAuth } from '@/hooks/use-auth';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { inr } from './Quotations';
import type { Plan } from '@/types';

export function Billing() {
  const { data, isLoading } = useBilling();
  const upgrade = useUpgradePlan();
  const cancel = useCancelSubscription();
  const refund = useRefundPayment();
  const renew = useRenewDemo();
  const { data: recon } = useReconciliation();
  const { user } = useAuth();
  const isManager = ['OWNER', 'ADMIN', 'MANAGER'].includes(user?.role || '');
  const { success, error } = useToast();
  const [period, setPeriod] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY');

  // Provider checkout flow state
  const [pendingPaymentId, setPendingPaymentId] = useState<string | null>(null);
  const pending = useCheckPayment(pendingPaymentId);
  const simulate = useCompleteDemoPayment();

  const plan = data?.currentPlan;
  const subscription = data?.subscription;
  const isDemo = data?.gateway.mode === 'demo';

  // When a provider checkout payment settles, refresh billing and clear the flow.
  useEffect(() => {
    if (pendingPaymentId && pending.data?.payment.status === 'SUCCEEDED') {
      success('Payment received', 'Your new plan is now active.');
      setPendingPaymentId(null);
    }
  }, [pending.data?.payment.status, pendingPaymentId, success]);

  const changePlan = async (p: Plan) => {
    if (p.slug === plan?.slug) return;
    try {
      const res = await upgrade.mutateAsync({ planSlug: p.slug, period });
      if (res.applied) {
        if (res.mode === 'demo' && res.paymentId) {
          setPendingPaymentId(null); // demo payments settle via the simulate button below
          success('Trial started', `You're now on the ${res.plan} plan. Simulate the payment below to activate it.`);
        } else {
          success('Plan updated', `You are now on the ${res.plan} plan.`);
        }
      } else {
        // Provider mode — open the hosted checkout and poll for settlement.
        setPendingPaymentId(res.paymentId || null);
        if (res.checkoutUrl) {
          window.open(res.checkoutUrl, '_blank', 'noopener');
        } else {
          success('Checkout prepared', 'Complete the payment on the payment page to activate your plan.');
        }
      }
    } catch (err) {
      error('Could not update plan', friendlyError(err));
    }
  };

  const simulateDemoPayment = async (paymentId: string) => {
    try {
      await simulate.mutateAsync({ paymentId });
      success('Payment simulated', 'The webhook was verified and the subscription is now active.');
    } catch (err) {
      error('Could not simulate payment', friendlyError(err));
    }
  };

  const handleRefund = async (paymentId: string, maxAmount: number) => {
    const raw = window.prompt(`Refund amount (₹)? Maximum ${inr(maxAmount)}`, String(maxAmount));
    if (raw === null) return;
    const amount = Number(raw);
    if (Number.isNaN(amount) || amount <= 0) {
      error('Invalid amount', 'Enter a refund amount in rupees.');
      return;
    }
    try {
      await refund.mutateAsync({ paymentId, amount });
      success('Refund processed', `${inr(amount)} refunded through the provider.`);
    } catch (err) {
      error('Refund failed', friendlyError(err));
    }
  };

  const handleRenew = async () => {
    if (!window.confirm('Simulate the next billing period\u2019s payment? Your subscription\u2019s end date rolls forward.')) return;
    try {
      const res = await renew.mutateAsync();
      success('Renewed', `Payment of ${inr(res.amount)} captured — active until ${new Date(res.endsAt!).toLocaleDateString('en-IN')}.`);
    } catch (err) {
      error('Renewal failed', friendlyError(err));
    }
  };

  const handleCancel = async () => {
    const atPeriodEnd = window.confirm('Cancel at the end of the billing period? You keep access until then.\n\nClick "OK" to cancel at period end, or "Cancel" to not cancel.');
    if (!atPeriodEnd) return;
    try {
      await cancel.mutateAsync({ atPeriodEnd: true });
      success('Subscription cancelled', 'You keep access until the end of the billing period.');
    } catch (err) {
      error('Could not cancel', friendlyError(err));
    }
  };

  if (isLoading) return <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}</div>;
  if (!data) return <p className="text-sm text-muted-foreground">Billing is unavailable right now.</p>;

  const statusBadge = () => {
    if (!subscription) return <Badge tone="default">No subscription</Badge>;
    if (subscription.status === 'CANCELLED' || (subscription.cancelAtPeriodEnd && subscription.status !== 'PAST_DUE')) {
      return <Badge tone="danger">Cancelling</Badge>;
    }
    if (subscription.status === 'PAST_DUE') return <Badge tone="danger">Payment overdue</Badge>;
    if (subscription.status === 'TRIAL') return <Badge tone="warning">Trial</Badge>;
    return <Badge tone="success"><BadgeCheck className="h-3 w-3" /> Active</Badge>;
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Billing & plan"
        description={isDemo ? 'Demo mode — plan changes are simulated with a signed webhook, no real payment is taken.' : 'Manage your PRIMELEAD subscription. Payments are verified server-side via webhooks.'}
      />

      {/* Current subscription */}
      <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><CreditCard className="h-5 w-5" /></span>
          <div>
            <p className="text-lg font-bold">{plan?.name || data.org.plan} plan</p>
            <p className="text-xs text-muted-foreground">
              {subscription?.period === 'YEARLY' ? 'Billed yearly' : 'Billed monthly'}
              {data.gateway.configured ? ` · ${data.gateway.provider}` : ' · demo mode'}
              {subscription?.trialEndsAt && subscription.status === 'TRIAL' && ` · trial ends ${new Date(subscription.trialEndsAt).toLocaleDateString('en-IN')}`}
              {subscription?.cancelAtPeriodEnd && subscription.endsAt && ` · cancels ${new Date(subscription.endsAt).toLocaleDateString('en-IN')}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {statusBadge()}
          {isDemo && subscription?.status === 'ACTIVE' && (
            <Button variant="outline" size="sm" onClick={handleRenew} loading={renew.isPending} title="Simulate the next period's payment">
              <RotateCcw className="h-3.5 w-3.5" /> Renew (demo)
            </Button>
          )}
          {subscription && !subscription.cancelAtPeriodEnd && (
            <Button variant="outline" size="sm" onClick={handleCancel}>Cancel</Button>
          )}
        </div>
      </Card>

      {/* Pending demo payment — simulate the webhook */}
      {data.payments.some((p) => p.status === 'PENDING' && p.provider === 'DEMO') && (
        <Card className="flex flex-wrap items-center justify-between gap-3 border-dashed p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600"><FlaskConical className="h-4 w-4" /></span>
            <div>
              <p className="text-sm font-semibold">Trial payment pending (demo)</p>
              <p className="text-xs text-muted-foreground">In production a verified Razorpay/Stripe/Cashfree webhook would settle this automatically.</p>
            </div>
          </div>
          <Button
            size="sm"
            loading={simulate.isPending}
            onClick={() => simulateDemoPayment(data.payments.find((p) => p.status === 'PENDING' && p.provider === 'DEMO')!.id)}
          >
            <FlaskConical className="h-3.5 w-3.5" /> Simulate payment
          </Button>
        </Card>
      )}

      {/* Provider checkout in progress */}
      {pendingPaymentId && pending.data?.payment.status === 'PENDING' && (
        <Card className="flex items-center justify-between gap-3 border-primary/30 bg-primary/5 p-4">
          <div>
            <p className="text-sm font-semibold">Waiting for payment…</p>
            <p className="text-xs text-muted-foreground">Complete the checkout, then this page updates automatically once the provider webhook is verified.</p>
          </div>
          <Button size="sm" variant="outline" disabled>Checking…</Button>
        </Card>
      )}

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
              <div className="mt-3 flex gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {p.userLimit === 0 ? 'Unlimited' : p.userLimit} users</span>
                <span className="flex items-center gap-1"><UserRound className="h-3.5 w-3.5" /> {p.leadLimit === 0 ? 'Unlimited' : p.leadLimit.toLocaleString('en-IN')} leads</span>
              </div>
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
                onClick={() => changePlan(p)}
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
        <p className="mb-3 text-xs text-muted-foreground">Settlements are recorded only from verified provider webhooks.</p>
        {data.payments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No payments yet.</p>
        ) : (
          <div className="space-y-2">
            {data.payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2.5 text-sm">
                <span className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  {p.paidAt ? new Date(p.paidAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : new Date(p.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  <span className="text-xs text-muted-foreground capitalize">· {p.provider || 'manual'}</span>
                  {p.refundedAmount > 0 && <span className="text-xs text-muted-foreground">· refunded {inr(p.refundedAmount)}</span>}
                </span>
                <span className="flex items-center gap-2">
                  <span className="font-semibold">{inr(p.amount)}</span>
                  <Badge tone={p.status === 'SUCCEEDED' ? 'success' : p.status === 'PENDING' ? 'warning' : p.status === 'FAILED' ? 'danger' : 'muted'}>{p.status.replace('_', ' ')}</Badge>
                  {p.status === 'SUCCEEDED' && p.refundedAmount < p.amount && isManager && (
                    <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => handleRefund(p.id, p.amount - p.refundedAmount)} loading={refund.isPending}>
                      <Undo2 className="h-3 w-3" /> Refund
                    </Button>
                  )}
                  {p.status === 'PENDING' && p.provider === 'DEMO' && (
                    <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => simulateDemoPayment(p.id)} loading={simulate.isPending}>
                      Simulate
                    </Button>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Reconciliation */}
      {recon && (
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="flex items-center gap-2 font-semibold"><PieChart className="h-4 w-4" /> Payment reconciliation</p>
            <Button size="sm" variant="outline" onClick={() => downloadPaymentsCsv().catch(() => error('Export failed', 'Please try again.'))}>
              <Download className="h-3.5 w-3.5" /> Export CSV
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Stat label="Payments" value={String(recon.totals.payments)} />
            <Stat label="Succeeded" value={String(recon.totals.succeeded)} />
            <Stat label="Failed" value={String(recon.totals.failed)} />
            <Stat label="Refunds" value={String(recon.totals.refunded)} />
            <Stat label="Collected" value={inr(recon.totals.collected)} />
            <Stat label="Net received" value={inr(recon.totals.net)} highlight />
          </div>
        </Card>
      )}

      {!isDemo && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ExternalLink className="h-3.5 w-3.5" /> Upgrades open a hosted checkout; your plan activates only after our server verifies the {data.gateway.provider} webhook.
        </p>
      )}
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={cn('rounded-lg border p-3', highlight && 'border-primary/40 bg-primary/5')}>
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn('mt-0.5 text-lg font-bold', highlight && 'text-primary')}>{value}</p>
    </div>
  );
}
