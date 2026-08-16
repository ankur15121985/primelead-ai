import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import { ShieldCheck, Zap, Clock } from 'lucide-react';

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-[calc(100vh-4rem)] lg:grid-cols-2">
      <div className="hidden flex-col justify-between border-r bg-slate-950 p-10 lg:flex">
        <div>
          <span className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-white"><Zap className="h-5 w-5" fill="currentColor" /></span>
            <span className="text-lg font-extrabold text-white">PRIMELEAD <span className="text-indigo-300">AI</span></span>
          </span>
          <blockquote className="mt-16 max-w-md text-2xl font-bold leading-snug text-white">
            "We used to lose leads on weekends. Now every enquiry is captured, assigned and followed up — our conversions doubled."
          </blockquote>
          <p className="mt-4 text-sm text-slate-400">Rohit Sharma · Interior firm, Gurgaon</p>
        </div>
        <div className="flex gap-8">
          {[
            { icon: ShieldCheck, label: 'Your data stays yours' },
            { icon: Clock, label: 'Follow-ups never missed' },
            { icon: Zap, label: 'AI that writes follow-ups' },
          ].map((f) => (
            <div key={f.label} className="flex items-center gap-2 text-sm text-slate-400">
              <f.icon className="h-4 w-4 text-primary" />
              {f.label}
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-md animate-fade-in">
          <Link to="/" className="mb-8 flex items-center gap-2 lg:hidden">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white"><Zap className="h-4 w-4" fill="currentColor" /></span>
            <span className="text-lg font-extrabold">PRIMELEAD <span className="text-indigo-600">AI</span></span>
          </Link>
          {children}
        </div>
      </div>
    </div>
  );
}
