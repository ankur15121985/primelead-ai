import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, KanbanSquare, ListChecks, Shield, Settings, LogOut, Search, Menu, X, QrCode, ShieldCheck,
  CalendarDays, BookUser, FileText, Receipt, BarChart3, Bot, Plug, CreditCard, MessageSquare, Workflow,
  Phone, Mail, Building2, FlaskConical, Target, Zap, PieChart, GraduationCap, TrendingUp, Map, Key, Webhook,
  Upload, GitMerge, Database, Wrench, Globe, Route, FileInput, UserCheck, Brain, Activity, LayoutList, ShieldAlert,
  Mic,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { NotificationsBell } from './NotificationsBell';
import { CommandPalette } from '@/components/CommandPalette';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Avatar } from '@/components/ui/avatar';
import { DropdownMenu, DropdownItem, DropdownLabel, DropdownSeparator } from '@/components/ui/dropdown-menu';
import { ROLE_LABEL } from '@/lib/constants';
import { cn } from '@/lib/utils';

const NAV = [
  { to: '/app/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/app/leads', label: 'Leads', icon: Users },
  { to: '/app/inbox', label: 'Inbox', icon: MessageSquare },
  { to: '/app/pipeline', label: 'Pipeline', icon: KanbanSquare },
  { to: '/app/tasks', label: 'Follow-ups', icon: ListChecks },
  { to: '/app/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/app/contacts', label: 'Contacts', icon: BookUser },
];

const SELL_NAV = [
  { to: '/app/quotations', label: 'Quotations', icon: FileText },
  { to: '/app/invoices', label: 'Invoices', icon: Receipt },
  { to: '/app/calls', label: 'Calls', icon: Phone },
  { to: '/app/meetings', label: 'Meetings', icon: CalendarDays },
  { to: '/app/sequences', label: 'Sequences', icon: Mail },
  { to: '/app/ai', label: 'AI Assistant', icon: Bot },
  { to: '/app/sms-leads', label: 'SMS Leads', icon: MessageSquare },
  { to: '/app/recordings', label: 'Recordings', icon: Mic },
];

const INTEL_NAV = [
  { to: '/app/companies', label: 'Companies', icon: Building2 },
  { to: '/app/search', label: 'Search', icon: Search },
  { to: '/app/icps', label: 'ICPs', icon: Target },
  { to: '/app/personas', label: 'Personas', icon: UserCheck },
  { to: '/app/scoring', label: 'Scoring', icon: PieChart },
  { to: '/app/signals', label: 'Signals', icon: Zap },
  { to: '/app/intelligence', label: 'Intelligence', icon: Brain },
  { to: '/app/ai-research', label: 'AI Research', icon: FlaskConical },
];

const ANALYTICS_NAV = [
  { to: '/app/reports', label: 'Reports', icon: BarChart3 },
  { to: '/app/analytics-v2', label: 'Analytics', icon: Activity },
  { to: '/app/report-builder', label: 'Report Builder', icon: LayoutList },
  { to: '/app/coaching', label: 'Coaching', icon: GraduationCap },
  { to: '/app/forecast', label: 'Forecasting', icon: TrendingUp },
];

const GROW_NAV = [
  { to: '/app/qr-codes', label: 'QR Codes', icon: QrCode },
  { to: '/app/integrations', label: 'Integrations', icon: Plug },
  { to: '/app/forms', label: 'Forms', icon: FileInput },
  { to: '/app/inbound', label: 'Inbound Routing', icon: Route },
  { to: '/app/workflows', label: 'Workflows', icon: Workflow },
  { to: '/app/import', label: 'Import', icon: Upload },
  { to: '/app/deliverability', label: 'Deliverability', icon: Globe },
  { to: '/app/data-providers', label: 'Data Providers', icon: Database },
];

const ADMIN_NAV = [
  { to: '/app/team', label: 'Team', icon: Shield },
  { to: '/app/territories', label: 'Territories', icon: Map },
  { to: '/app/automations', label: 'Automations', icon: Wrench },
  { to: '/app/data-quality', label: 'Data Quality', icon: Database },
  { to: '/app/duplicates', label: 'Duplicates', icon: GitMerge },
  { to: '/app/compliance', label: 'Compliance', icon: ShieldAlert },
  { to: '/app/security', label: 'Security', icon: ShieldCheck },
  { to: '/app/api-keys', label: 'API Keys', icon: Key },
  { to: '/app/webhooks-platform', label: 'Webhooks', icon: Webhook },
  { to: '/app/billing', label: 'Billing', icon: CreditCard },
  { to: '/app/settings', label: 'Settings', icon: Settings },
];

export function AppLayout() {
  const { user, org, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const renderNav = (items: typeof NAV, key: string) => (
    <div key={key} className="space-y-1">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          onClick={() => setMobileOpen(false)}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
              isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            )
          }
        >
          <item.icon className="h-5 w-5" />
          {item.label}
        </NavLink>
      ))}
    </div>
  );

  const sectionLabel = (text: string) => (
    <p key={text} className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{text}</p>
  );

  const navItems = (
    <>
      {renderNav(NAV, 'main')}
      {sectionLabel('Sell')}
      {renderNav(SELL_NAV, 'sell')}
      {sectionLabel('Intelligence')}
      {renderNav(INTEL_NAV, 'intel')}
      {sectionLabel('Analytics')}
      {renderNav(ANALYTICS_NAV, 'analytics')}
      {sectionLabel('Grow')}
      {renderNav(GROW_NAV, 'grow')}
      {sectionLabel('Admin')}
      {renderNav(ADMIN_NAV, 'admin')}
    </>
  );

  return (
    <>
    <CommandPalette />
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r bg-background lg:flex">
        <div className="flex h-16 items-center border-b px-5">
          <span className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-black text-primary-foreground">L</span>
            <span className="text-base font-extrabold tracking-tight">
              PRIMELEAD <span className="text-indigo-600">AI</span>
            </span>
          </span>
        </div>
        <div className="px-4 py-4">
          <div className="rounded-lg bg-muted/60 p-3">
            <p className="truncate text-sm font-semibold">{org?.name}</p>
            <p className="text-xs text-muted-foreground capitalize">{org?.plan?.toLowerCase()} plan</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3" aria-label="App">
          {navItems}
        </nav>
        <div className="border-t p-3">
          <DropdownMenu
            trigger={
              <button className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-accent">
                <Avatar name={user?.name || 'U'} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{user?.name}</p>
                  <p className="text-xs text-muted-foreground">{ROLE_LABEL[user?.role || ''] || user?.role}</p>
                </div>
              </button>
            }
          >
            <DropdownLabel>{user?.email}</DropdownLabel>
            <DropdownSeparator />
            <DropdownItem onSelect={() => navigate('/app/settings')}>Settings</DropdownItem>
            {user?.isSuperAdmin && (
              <DropdownItem onSelect={() => navigate('/admin')}>
                <ShieldCheck className="h-4 w-4 text-amber-500" /> Admin panel
              </DropdownItem>
            )}
            <DropdownItem danger onSelect={handleLogout}>
              <LogOut className="h-4 w-4" /> Sign out
            </DropdownItem>
          </DropdownMenu>
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} aria-hidden />
          <div className="absolute inset-y-0 left-0 w-64 bg-background p-4 shadow-2xl animate-slide-in-right">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-base font-extrabold">PRIMELEAD <span className="text-indigo-600">AI</span></span>
              <button onClick={() => setMobileOpen(false)} aria-label="Close menu" className="rounded p-1.5 hover:bg-accent">
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="space-y-1">{navItems}</nav>
          </div>
        </div>
      )}

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-60">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur-lg sm:px-6">
          <button className="rounded-lg p-2 text-muted-foreground lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>
          <div className="hidden items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2 text-sm text-muted-foreground md:flex md:w-72 cursor-pointer" onClick={() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true })); }}>
            <Search className="h-4 w-4" />
            <span className="flex-1">Search…</span>
            <kbd className="rounded border bg-background px-1.5 py-0.5 text-[10px] font-medium">⌘K</kbd>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <ThemeToggle />
            <NotificationsBell />
            <button
              className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground lg:hidden"
              onClick={handleLogout}
              aria-label="Sign out"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </header>

        <main className="flex-1 px-4 pb-24 pt-6 sm:px-6 lg:pb-10">
          <Outlet />
        </main>

        {/* Mobile bottom nav */}
        <nav className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 backdrop-blur-lg lg:hidden" aria-label="Mobile app nav">
          <div className="grid grid-cols-5">
            {[
              NAV[0], // Dashboard
              NAV[1], // Leads
              NAV[2], // Inbox
              SELL_NAV[0], // Quotations
              SELL_NAV[7], // Recordings
            ].map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors',
                    isActive ? 'text-primary' : 'text-muted-foreground'
                  )
                }
              >
                <item.icon className="h-5 w-5" />
                {item.label.split(' ')[0]}
              </NavLink>
            ))}
          </div>
        </nav>
      </div>
    </div>
    </>
  );
}
