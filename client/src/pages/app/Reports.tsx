import { useState } from 'react';
import { BarChart3, Download, TrendingUp, Target, FileText, Receipt, CheckCircle2, XCircle, Activity as ActivityIcon, Users, ListChecks, AlarmClockOff } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { useReports, useExportReport } from '@/hooks/queries';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { inr } from './Quotations';

const COLORS = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#64748b'];

function Stat({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">{icon}</span>
        {label}
      </div>
      <p className="mt-2 text-2xl font-bold tracking-tight">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </Card>
  );
}

export function Reports() {
  const defaultTo = new Date().toISOString().slice(0, 10);
  const defaultFrom = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const { data, isLoading, refetch, isFetching } = useReports(from, to);
  const exportCsv = useExportReport(from, to);

  const cards = data?.cards;
  const charts = data?.charts;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Reports & analytics"
        description="See where leads come from, how your team performs, and what is converting into revenue."
        actions={
          <Button variant="outline" onClick={() => exportCsv()}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        }
      />

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="r-from">From</Label>
          <Input id="r-from" type="date" className="w-40" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="r-to">To</Label>
          <Input id="r-to" type="date" className="w-40" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <Button onClick={() => refetch()} loading={isFetching}><BarChart3 className="h-4 w-4" /> Apply</Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
      ) : !cards ? (
        <p className="text-sm text-muted-foreground">No data for this range.</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat icon={<Target className="h-4 w-4" />} label="Leads created" value={String(cards.leadsCreated)} />
            <Stat icon={<CheckCircle2 className="h-4 w-4" />} label="Won" value={String(cards.leadsWon)} sub={`${cards.winRate}% win rate`} />
            <Stat icon={<XCircle className="h-4 w-4" />} label="Lost" value={String(cards.leadsLost)} />
            <Stat icon={<TrendingUp className="h-4 w-4" />} label="Conversion rate" value={`${cards.conversionRate}%`} sub={`${cards.openLeads} still open`} />
            <Stat icon={<Users className="h-4 w-4" />} label="Team activity" value={String(cards.activityCount)} sub={`${cards.tasksDone} follow-ups done`} />
            <Stat icon={<ListChecks className="h-4 w-4" />} label="Quotations" value={String(cards.quotationsCount)} sub={inr(cards.quotationValue)} />
            <Stat icon={<Receipt className="h-4 w-4" />} label="Invoices" value={String(cards.invoicesCount)} sub={inr(cards.invoiceValue)} />
            <Stat icon={<ActivityIcon className="h-4 w-4" />} label="Revenue collected" value={inr(cards.revenue)} sub={`${cards.tasksMissed} follow-ups missed`} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-5">
              <p className="mb-1 font-semibold">Leads by source</p>
              <p className="mb-3 text-xs text-muted-foreground">Where your enquiries come from</p>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={charts?.bySource || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={28} />
                    <Tooltip cursor={{ fill: '#f1f5f9' }} />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]} fill="#4f46e5" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="p-5">
              <p className="mb-1 font-semibold">Leads by owner</p>
              <p className="mb-3 text-xs text-muted-foreground">How your team is distributing the load</p>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={charts?.byOwner || []} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={90} />
                    <Tooltip cursor={{ fill: '#f1f5f9' }} />
                    <Bar dataKey="count" radius={[0, 6, 6, 0]} fill="#0ea5e9" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="p-5 lg:col-span-2">
              <p className="mb-1 font-semibold">Lead trend</p>
              <p className="mb-3 text-xs text-muted-foreground">New leads per day in this range</p>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={charts?.trend || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="day" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={28} />
                    <Tooltip />
                    <Line type="monotone" dataKey="count" stroke="#10b981" strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="p-5">
              <p className="mb-1 font-semibold">Leads by status</p>
              <p className="mb-3 text-xs text-muted-foreground">Pipeline distribution</p>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={charts?.byStatus || []} dataKey="count" nameKey="status" innerRadius={50} outerRadius={80} paddingAngle={2}>
                      {(charts?.byStatus || []).map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {(charts?.byStatus || []).map((s, i) => (
                  <span key={s.status} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="h-2 w-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} /> {s.status}
                  </span>
                ))}
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
