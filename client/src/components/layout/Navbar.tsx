import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Menu, X, Zap } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';

const LINKS = [
  { to: '/features', label: 'Features' },
  { to: '/lead-sources', label: 'Lead Sources' },
  { to: '/pricing', label: 'Pricing' },
  { to: '/faq', label: 'FAQ' },
  { to: '/contact', label: 'Contact' },
];

export function Logo({ dark = false }: { dark?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2">
      <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg', dark ? 'bg-primary text-primary-foreground' : 'bg-primary text-primary-foreground')}>
        <Zap className="h-5 w-5" fill="currentColor" />
      </span>
      <span className={cn('text-lg font-extrabold tracking-tight', dark ? 'text-white' : 'text-foreground')}>
        PRIMELEAD <span className="text-primary">AI</span>
      </span>
    </Link>
  );
}

export function Navbar() {
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-lg">
      <div className="container flex h-16 items-center justify-between">
        <Logo />
        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {LINKS.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                cn(
                  'rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground',
                  isActive && 'text-foreground'
                )
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          {user && !loading ? (
            <Link to="/app/dashboard">
              <button className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90">
                Open Dashboard
              </button>
            </Link>
          ) : (
            <>
              <Link to="/login">
                <button className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
                  Log in
                </button>
              </Link>
              <Link to="/signup">
                <button className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90">
                  Start Free
                </button>
              </Link>
            </>
          )}
        </div>
        <button
          className="rounded-lg p-2 text-muted-foreground md:hidden"
          onClick={() => setOpen(!open)}
          aria-label={open ? 'Close menu' : 'Open menu'}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
      {open && (
        <nav className="border-t bg-background px-4 py-3 md:hidden" aria-label="Mobile">
          <div className="flex flex-col gap-1">
            {LINKS.map((l) => (
              <NavLink key={l.to} to={l.to} onClick={() => setOpen(false)} className="rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-accent">
                {l.label}
              </NavLink>
            ))}
            <div className="mt-2 flex gap-2 border-t pt-3">
              {user && !loading ? (
                <Link to="/app/dashboard" className="flex-1">
                  <button className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">Open Dashboard</button>
                </Link>
              ) : (
                <>
                  <Link to="/login" className="flex-1">
                    <button className="w-full rounded-lg border px-4 py-2.5 text-sm font-medium">Log in</button>
                  </Link>
                  <Link to="/signup" className="flex-1">
                    <button className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">Start Free</button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </nav>
      )}
    </header>
  );
}
