import { Link } from 'react-router-dom';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid,
} from 'recharts';
import {
  Users, UserPlus, Star, Trophy, TrendingUp, IndianRupee, Percent, AlertTriangle,
  ArrowUpRight, Phone, MessageCircle, ChevronRight,
} from 'lucide-react';
import { useDashboard } from '@/hooks/queries';
import { useAuth } from '@/hooks/use-auth';
import { formatINR, inrShort, formatDateTime, timeAgo, dueLabel } from '@/lib/format';
import { sourceLabel } from '@/lib/constants';
import { DecorativeChart } from '@/components/ui/chart-a11y';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/leads/StatusBadge';

const PIE_COLORS = ['#6366f1', '#8b5cf6', '#06b6d4', '#f59e0b', '#ec4899', '#10b981', '#64748b', '#ef4444', '#3b82f6', '#f97316', '#14b8a6', '#a855f7', '#84cc16', '#0ea5e9', '#e11d48', '#78350f'];

export function Dashboard() {
  const { data, isLoading } = useDashboard();
  const { user } = useAuth();

  const cards = data ? [
    { label: 'Total Leads', value: String(data.cards.totalLeads), icon: Users, tone: 'text-primary bg-primary/10' },
    { label: 'New This Week', value: String(data.cards.weekLeads), icon: UserPlus, tone: 'text-info bg-info/10' },
    { label: 'Pipeline Value', value: inrShort.format(data.cards.pipelineValue), icon: TrendingUp, tone: 'text-violet-600 bg-violet-100' },
    { label: 'Revenue (Won)', value: inrShort.format(data.cards.revenue), icon: IndianRupee, tone: 'text-success bg-success/10' },
    { label: 'Conversion Rate', value: `${data.cards.conversionRate}%`, icon: Percent, tone: 'text-amber-600 bg-amber-100' },
    { label: 'Open Deals', value: String(data.cards.openLeads), icon: Star, tone: 'text-pink-600 bg-pink-100' },
    { label: 'Won Deals', value: String(data.cards.wonLeads), icon: Trophy, tone: 'text-emerald-600 bg-emerald-100' },
  ] : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Namaste, {user?.name?.split(' ')[0]} 👋
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Here's what needs your attention today.
        </p>
      </div>

      {/* Overdue banner */}
      {data && data.cards.overdue > 0 && (
        <Link to="/app/tasks?view=overdue">
          <div className="flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 transition-colors hover:bg-destructive/10">
            <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" />
            <p className="text-sm font-medium">
              {data.cards.overdue} follow-up{data.cards.overdue > 1 ? 's are' : ' is'} overdue
              {user?.role === 'SALES' ? ' for you' : ''}. Let's fix that today.
            </p>
            <ChevronRight className="ml-auto h-4 w-4 text-destructive" />
          </div>
        </Link>
      )}

      {/* Stat cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-7">
          {Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-7">
          {cards.map((c) => (
            <Card key={c.label} className="card-hover">
              <CardContent className="p-4">
                <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${c.tone}`}>
                  <c.icon className="h-5 w-5" />
                </span>
                <p className="mt-3 text-xl font-extrabold tracking-tight">{c.value}</p>
                <p className="text-xs font-medium text-muted-foreground">{c.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Charts row */}
      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Leads & wins — last 14 days</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-64" /> : data && (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={data.charts.trend}>
                  <defs>
                    <linearGradient id="leads" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={30} allowDecimals={false} />
                  <Tooltip />
                  <Area type="monotone" dataKey="leads" name="Leads" stroke="#6366f1" fill="url(#leads)" strokeWidth={2} />
                  <Area type="monotone" dataKey="won" name="Won" stroke="#10b981" fill="transparent" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Leads by source</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-64" /> : data && (
              <DecorativeChart label="Pie chart of leads by source">
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={data.charts.leadsBySource} dataKey="count" nameKey="source" innerRadius={55} outerRadius={90} paddingAngle={2} isAnimationActive={false}>
                      {data.charts.leadsBySource.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number, n: string) => [v, sourceLabel(n)]} />
                  </PieChart>
                </ResponsiveContainer>
              </DecorativeChart>
            )}
            {data && data.charts.leadsBySource.length > 0 && (
              <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1">
                {data.charts.leadsBySource.slice(0, 6).map((s, i) => (
                  <span key={s.source} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="h-2 w-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                    {sourceLabel(s.source)} ({s.count})
                  </span>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Second charts row */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Conversion funnel</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-56" /> : data && (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.charts.funnel} layout="vertical" margin={{ left: 10 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="stage" width={90} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Bar dataKey="value" name="Leads" radius={[0, 8, 8, 0]} fill="#6366f1" barSize={22} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Leads by salesperson</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-56" /> : data && data.charts.leadsByOwner.length === 0 ? (
              <EmptyState title="No owner data yet" description="Assign leads to see performance here." />
            ) : data && (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.charts.leadsByOwner}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={30} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" name="Leads" radius={[8, 8, 0, 0]} fill="#8b5cf6" barSize={26} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Lists */}
      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Today's follow-ups</CardTitle>
            <Link to="/app/tasks" className="text-xs font-semibold text-primary hover:underline">View all →</Link>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-40" /> : data && data.lists.todaysTasks.length === 0 ? (
              <EmptyState title="All caught up" description="No follow-ups due today. 🎉" />
            ) : (
              <ul className="divide-y">
                {data?.lists.todaysTasks.slice(0, 5).map((t) => {
                  const dl = dueLabel(t.dueAt);
                  return (
                    <li key={t.id} className="flex items-center gap-3 py-2.5">
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${dl.tone === 'danger' ? 'bg-destructive/10 text-destructive' : dl.tone === 'warning' ? 'bg-warning/15 text-warning-foreground' : 'bg-info/10 text-info'}`}>
                        {t.kind === 'CALL' ? <Phone className="h-4 w-4" /> : t.kind === 'WHATSAPP' ? <MessageCircle className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {t.lead ? <Link to={`/app/leads/${t.lead.id}`} className="hover:text-primary">{t.lead.name}</Link> : t.title}
                          <span className="text-muted-foreground font-normal"> · {t.title}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">{formatDateTime(t.dueAt)} · {t.user?.name}</p>
                      </div>
                      <Badge tone={dl.tone === 'danger' ? 'danger' : dl.tone === 'warning' ? 'warning' : 'info'}>{dl.label}</Badge>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Top salespeople</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-40" /> : data && data.charts.topSalespeople.length === 0 ? (
              <EmptyState title="No salespeople yet" description="Add your team in Team settings." />
            ) : (
              <ul className="space-y-3">
                {data?.charts.topSalespeople.map((s, i) => (
                  <li key={s.name} className="flex items-center gap-3">
                    <span className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${i === 0 ? 'bg-amber-100 text-amber-700' : 'bg-primary/10 text-primary'}`}>
                      {i === 0 ? '🏆' : i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{s.name}</p>
                      <p className="text-xs text-muted-foreground">{s.open} open · {formatINR(s.wonValue)} won</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent leads + activity */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Recent leads</CardTitle>
            <Link to="/app/leads" className="text-xs font-semibold text-primary hover:underline">All leads →</Link>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-44" /> : data && data.lists.recentLeads.length === 0 ? (
              <EmptyState title="No leads yet" description="Add your first lead or import from Excel." />
            ) : (
              <ul className="divide-y">
                {data?.lists.recentLeads.map((l) => (
                  <li key={l.id}>
                    <Link to={`/app/leads/${l.id}`} className="flex items-center gap-3 py-2.5 transition-colors hover:bg-muted/40 rounded-lg px-2 -mx-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{l.name}</p>
                        <p className="text-xs text-muted-foreground">{sourceLabel(l.source)} · {timeAgo(l.createdAt)}</p>
                      </div>
                      <StatusBadge status={l.status} />
                      <span className="text-sm font-semibold">{formatINR(l.expectedValue)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Recent activity</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-44" /> : data && data.lists.recentActivity.length === 0 ? (
              <EmptyState title="No activity yet" />
            ) : (
              <ul className="space-y-3">
                {data?.lists.recentActivity.map((a) => (
                  <li key={a.id} className="flex items-start gap-3">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary/60" />
                    <div className="min-w-0">
                      <p className="text-sm">
                        <span className="font-semibold">{a.user?.name || 'System'}</span>
                        <span className="text-muted-foreground"> {a.title.toLowerCase()}</span>
                        {a.lead && <span className="text-muted-foreground"> · {a.lead.name}</span>}
                      </p>
                      <p className="text-xs text-muted-foreground">{timeAgo(a.createdAt)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
