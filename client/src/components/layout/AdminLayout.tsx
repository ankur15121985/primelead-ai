import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Building2, Users, Activity, ArrowLeft, ShieldCheck, LogOut,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { Avatar } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

const NAV = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/admin/organizations', label: 'Organizations', icon: Building2 },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/system', label: 'System', icon: Activity },
];

export function AdminLayout() {
  const { user, org, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div className="flex min-h-screen bg-slate-950">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-white/10 bg-slate-950 lg:flex">
        <div className="flex h-16 items-center gap-2 border-b border-white/10 px-5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500 text-sm font-black text-slate-950">
            <ShieldCheck className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-extrabold text-white">LeadFlow Admin</p>
            <p className="text-[11px] text-slate-400">Website operations</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4" aria-label="Admin">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive ? 'bg-amber-500/15 text-amber-400' : 'text-slate-400 hover:bg-white/5 hover:text-white'
                )
              }
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-white/10 p-3">
          <div className="mb-2 rounded-lg bg-white/5 p-3">
            <p className="truncate text-sm font-semibold text-white">{org?.name || '—'}</p>
            <p className="truncate text-xs text-slate-400">{user?.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-2 rounded-lg p-2 text-sm text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-60">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-white/10 bg-slate-950/90 px-4 backdrop-blur lg:hidden">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500 text-slate-950">
            <ShieldCheck className="h-4 w-4" />
          </span>
          <span className="text-sm font-bold text-white">LeadFlow Admin</span>
          <nav className="ml-auto flex items-center gap-1" aria-label="Admin (mobile)">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-medium',
                    isActive ? 'bg-amber-500/15 text-amber-400' : 'text-slate-400 hover:text-white'
                  )
                }
              >
                <item.icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6">
          <div className="mb-5 flex items-center justify-between">
            <button
              onClick={() => navigate('/app/dashboard')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to CRM app
            </button>
            <span className="flex items-center gap-1.5 text-xs text-slate-500">
              <Avatar name={user?.name || 'A'} className="h-6 w-6 text-[10px]" />
              Super-admin
            </span>
          </div>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
