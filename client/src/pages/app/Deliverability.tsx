import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Shield, TrendingUp, AlertTriangle, Mail, MousePointerClick, Reply, Ban, MessageSquareWarning } from 'lucide-react';

interface DeliverabilityReport {
  totals: { sent: number; delivered: number; bounced: number; opened: number; clicked: number; replied: number; unsubscribed: number; spamComplaints: number };
  rates: { deliveryRate: number; bounceRate: number; openRate: number; clickRate: number; replyRate: number; unsubscribeRate: number; spamRate: number };
  healthScore: number;
  reputationScore: number;
  domainBreakdown: { domain: string; sent: number; delivered: number; bounced: number; healthScore: number }[];
  recommendations: string[];
}

export function Deliverability() {
  const { data, isLoading } = useQuery<{ report: DeliverabilityReport }>({
    queryKey: ['deliverability'],
    queryFn: async () => api<{ report: DeliverabilityReport }>('/deliverability/report?days=30'),
  });

  const r = data?.report;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Deliverability</h1>
        <p className="text-sm text-slate-500">Monitor email health, reputation, and deliverability</p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">{Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-32 animate-pulse rounded-lg bg-slate-100" />)}</div>
          <div className="grid gap-4 sm:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded-lg bg-slate-100" />)}</div>
        </div>
      ) : r ? (
        <>
          {/* Health Scores */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border bg-white p-6">
              <div className="flex items-center gap-2 mb-3">
                <Shield className="h-5 w-5 text-blue-600" />
                <h3 className="font-semibold">Health Score</h3>
              </div>
              <div className="text-center">
                <div className={`text-5xl font-bold ${r.healthScore >= 80 ? 'text-emerald-600' : r.healthScore >= 60 ? 'text-amber-600' : 'text-red-600'}`}>{r.healthScore}</div>
                <p className="text-sm text-slate-500">out of 100</p>
              </div>
            </div>
            <div className="rounded-lg border bg-white p-6">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="h-5 w-5 text-purple-600" />
                <h3 className="font-semibold">Reputation Score</h3>
              </div>
              <div className="text-center">
                <div className={`text-5xl font-bold ${r.reputationScore >= 80 ? 'text-emerald-600' : r.reputationScore >= 60 ? 'text-amber-600' : 'text-red-600'}`}>{r.reputationScore}</div>
                <p className="text-sm text-slate-500">out of 100</p>
              </div>
            </div>
          </div>

          {/* Rate Cards */}
          <div className="grid gap-4 sm:grid-cols-4">
            <RateCard icon={<Mail />} label="Delivery Rate" value={r.rates.deliveryRate} suffix="%" good={r.rates.deliveryRate >= 95} />
            <RateCard icon={<Ban />} label="Bounce Rate" value={r.rates.bounceRate} suffix="%" good={r.rates.bounceRate <= 3} inverted />
            <RateCard icon={<TrendingUp />} label="Open Rate" value={r.rates.openRate} suffix="%" good={r.rates.openRate >= 20} />
            <RateCard icon={<MousePointerClick />} label="Click Rate" value={r.rates.clickRate} suffix="%" good={r.rates.clickRate >= 2} />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <RateCard icon={<Reply />} label="Reply Rate" value={r.rates.replyRate} suffix="%" good={r.rates.replyRate >= 5} />
            <RateCard icon={<MessageSquareWarning />} label="Unsubscribe" value={r.rates.unsubscribeRate} suffix="%" good={r.rates.unsubscribeRate <= 1} inverted />
            <RateCard icon={<AlertTriangle />} label="Spam Complaints" value={r.rates.spamRate} suffix="%" good={r.rates.spamRate <= 0.1} inverted />
          </div>

          {/* Totals */}
          <div className="rounded-lg border bg-white p-4">
            <h3 className="mb-3 font-semibold">Totals (Last 30 Days)</h3>
            <div className="grid gap-4 sm:grid-cols-4 text-sm">
              <div><span className="text-slate-500">Sent:</span> <span className="font-medium">{r.totals.sent.toLocaleString()}</span></div>
              <div><span className="text-slate-500">Delivered:</span> <span className="font-medium">{r.totals.delivered.toLocaleString()}</span></div>
              <div><span className="text-slate-500">Bounced:</span> <span className="font-medium text-red-600">{r.totals.bounced.toLocaleString()}</span></div>
              <div><span className="text-slate-500">Spam:</span> <span className="font-medium text-red-600">{r.totals.spamComplaints}</span></div>
            </div>
          </div>

          {/* Recommendations */}
          <div className="rounded-lg border bg-white p-4">
            <h3 className="mb-3 font-semibold">Recommendations</h3>
            <ul className="space-y-2">
              {r.recommendations.map((rec, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-500 flex-shrink-0" />
                  {rec}
                </li>
              ))}
            </ul>
          </div>

          {/* Domain Breakdown */}
          {r.domainBreakdown.length > 0 && (
            <div className="rounded-lg border bg-white p-4">
              <h3 className="mb-3 font-semibold">Domain Breakdown</h3>
              <div className="space-y-2">
                {r.domainBreakdown.map((d) => (
                  <div key={d.domain} className="flex items-center justify-between rounded bg-slate-50 px-3 py-2">
                    <span className="font-medium text-sm">{d.domain}</span>
                    <div className="flex items-center gap-4 text-xs text-slate-500">
                      <span>Sent: {d.sent}</span>
                      <span>Delivered: {d.delivered}</span>
                      <span>Bounced: {d.bounced}</span>
                      <span className={`font-medium ${d.healthScore >= 80 ? 'text-emerald-600' : d.healthScore >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
                        Health: {d.healthScore}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="py-12 text-center text-slate-500">
          <Shield className="mx-auto mb-2 h-8 w-8 text-slate-300" />
          <p>No deliverability data yet. Start a sequence to begin tracking.</p>
        </div>
      )}
    </div>
  );
}

function RateCard({ icon, label, value, suffix, good, inverted }: { icon: React.ReactNode; label: string; value: number; suffix: string; good: boolean; inverted?: boolean }) {
  const color = inverted
    ? (good ? 'text-emerald-600' : value === 0 ? 'text-slate-400' : 'text-red-600')
    : (good ? 'text-emerald-600' : 'text-amber-600');

  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-slate-400">{icon}</span>
        <span className="text-xs text-slate-500">{label}</span>
      </div>
      <div className={`text-2xl font-bold ${color}`}>{value}{suffix}</div>
    </div>
  );
}

export default Deliverability;
