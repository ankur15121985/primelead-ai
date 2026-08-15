import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Sparkles, ArrowRight } from 'lucide-react';
import { useSeo } from '@/hooks/use-seo';
import { PLANS } from '@/lib/constants';
import { cn } from '@/lib/utils';

export function Pricing() {
  useSeo('Pricing — LeadFlow AI', 'Simple pricing for Indian businesses. Start free, upgrade when your team grows.');
  const [annual, setAnnual] = useState(true);

  return (
    <div className="container py-16">
      <div className="mx-auto max-w-2xl text-center">
        <span className="inline-block rounded-full bg-primary/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-primary">Pricing</span>
        <h1 className="mt-4 text-4xl font-extrabold tracking-tight">Pricing that grows with you</h1>
        <p className="mt-4 text-lg text-muted-foreground">Start free. Add your team. Upgrade when the deals start closing.</p>

        <div className="mt-8 inline-flex items-center gap-3 rounded-full border bg-background p-1.5 shadow-sm">
          <button
            onClick={() => setAnnual(false)}
            className={cn('rounded-full px-5 py-2 text-sm font-semibold transition-all', !annual ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}
          >
            Monthly
          </button>
          <button
            onClick={() => setAnnual(true)}
            className={cn('rounded-full px-5 py-2 text-sm font-semibold transition-all', annual ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}
          >
            Annual <span className={cn('ml-1 rounded-full px-2 py-0.5 text-[10px] font-bold', annual ? 'bg-white/20' : 'bg-success/10 text-success')}>save ~16%</span>
          </button>
        </div>
      </div>

      <div className="mt-14 grid gap-6 lg:grid-cols-3">
        {PLANS.map((plan) => {
          const price = annual ? plan.yearly / 12 : plan.monthly;
          return (
            <div
              key={plan.slug}
              className={cn(
                'relative flex flex-col rounded-2xl border p-7 transition-all hover:-translate-y-1 hover:shadow-xl',
                plan.highlight ? 'border-primary bg-primary/5 shadow-lg shadow-primary/10' : 'bg-card'
              )}
            >
              {plan.highlight && (
                <span className="absolute -top-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-primary px-3.5 py-1 text-[11px] font-bold text-primary-foreground shadow">
                  <Sparkles className="h-3 w-3" /> Most popular
                </span>
              )}
              <h2 className="text-lg font-bold">{plan.name}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{plan.tagline}</p>
              <div className="mt-5 flex items-baseline gap-1">
                <span className="text-4xl font-extrabold tracking-tight">₹{Math.round(price).toLocaleString('en-IN')}</span>
                <span className="text-sm text-muted-foreground">/ month</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {annual && plan.monthly > 0 ? `Billed yearly (₹${plan.yearly.toLocaleString('en-IN')}/yr)` : plan.monthly === 0 ? 'Free forever' : 'Billed monthly'}
              </p>
              <Link to="/signup" className="mt-6">
                <button
                  className={cn(
                    'h-11 w-full rounded-xl text-sm font-semibold transition-all',
                    plan.highlight
                      ? 'bg-primary text-primary-foreground shadow-md shadow-primary/25 hover:bg-primary/90'
                      : 'border bg-background hover:bg-accent'
                  )}
                >
                  {plan.cta}
                </button>
              </Link>
              <ul className="mt-7 space-y-3">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      <p className="mx-auto mt-10 max-w-xl text-center text-sm text-muted-foreground">
        All plans include a 14-day free trial of paid features, free data export at any time, and support in English & हिन्दी.
        Need something custom? <Link to="/contact" className="font-semibold text-primary hover:underline">Talk to us</Link>.
      </p>
      <p className="mt-6 text-center text-xs text-muted-foreground">
        <ArrowRight className="mr-1 inline h-3 w-3" /> Annual savings shown in INR. GST added at checkout where applicable.
      </p>

      <div className="mt-16 rounded-2xl border bg-slate-50 p-8 text-center">
        <h2 className="text-xl font-bold">Partnerships & Referrals</h2>
        <p className="mt-2 max-w-xl mx-auto text-muted-foreground">
          Are you a consultant who advises agencies on tools? Join our referral program and earn commissions for every agency you refer to LeadFlow AI.
        </p>
        <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-semibold text-primary">
          <Sparkles className="h-4 w-4" /> Coming Soon
        </div>
      </div>
    </div>
  );
}
