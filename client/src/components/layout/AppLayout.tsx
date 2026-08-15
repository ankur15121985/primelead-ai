import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, KanbanSquare, ListChecks, Shield, Settings, LogOut, Search, Menu, X, QrCode, ShieldCheck,
  CalendarDays, BookUser, FileText, Receipt, BarChart3, Bot, Plug, CreditCard,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { NotificationsBell } from './NotificationsBell';
import { Avatar } from '@/components/ui/avatar';
import { DropdownMenu, DropdownItem, DropdownLabel, DropdownSeparator } from '@/components/ui/dropdown-menu';
import { ROLE_LABEL } from '@/lib/constants';
import { cn } from '@/lib/utils';

const NAV = [
  { to: '/app/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/app/leads', label: 'Leads', icon: Users },
  { to: '/app/pipeline', label: 'Pipeline', icon: KanbanSquare },
  { to: '/app/tasks', label: 'Follow-ups', icon: ListChecks },
  { to: '/app/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/app/contacts', label: 'Contacts', icon: BookUser },
];

const SELL_NAV = [
  { to: '/app/quotations', label: 'Quotations', icon: FileText },
  { to: '/app/invoices', label: 'Invoices', icon: Receipt },
  { to: '/app/reports', label: 'Reports', icon: BarChart3 },
  { to: '/app/ai', label: 'AI Assistant', icon: Bot },
];

const GROW_NAV = [
  { to: '/app/qr-codes', label: 'QR Codes', icon: QrCode },
  { to: '/app/integrations', label: 'Integrations', icon: Plug },
  { to: '/app/team', label: 'Team', icon: Shield },
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
    <p key={text} className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">{text}</p>
  );

  const navItems = (
    <>
      {renderNav(NAV, 'main')}
      {sectionLabel('Sell')}
      {renderNav(SELL_NAV, 'sell')}
      {sectionLabel('Grow')}
      {renderNav(GROW_NAV, 'grow')}
    </>
  );

  return (
    <div className="flex min-h-screen bg-slate-50/60">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r bg-background lg:flex">
        <div className="flex h-16 items-center border-b px-5">
          <span className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-black text-primary-foreground">L</span>
            <span className="text-base font-extrabold tracking-tight">
              PRIMELEAD <span className="text-primary">AI</span>
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
              <span className="text-base font-extrabold">PRIMELEAD <span className="text-primary">AI</span></span>
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
          <div className="hidden items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2 text-sm text-muted-foreground md:flex md:w-72">
            <Search className="h-4 w-4" />
            <input
              className="w-full bg-transparent outline-none placeholder:text-muted-foreground"
              placeholder="Search leads…"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const q = (e.target as HTMLInputElement).value.trim();
                  navigate(q ? `/app/leads?search=${encodeURIComponent(q)}` : '/app/leads');
                }
              }}
            />
          </div>
          <div className="ml-auto flex items-center gap-1.5">
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
              NAV[3], // Follow-ups
              SELL_NAV[0], // Quotations
              SELL_NAV[3], // AI Assistant
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
  );
}
