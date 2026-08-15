import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Database, FileUp, Sparkles, Users, Zap, ArrowRight, Building2, Store, Home, GraduationCap, Briefcase, Factory, HeartPulse } from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { friendlyError, useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const TYPES = [
  { value: 'RETAIL', label: 'Retail & E-commerce', icon: Store },
  { value: 'REAL_ESTATE', label: 'Real Estate', icon: Home },
  { value: 'EDUCATION', label: 'Education', icon: GraduationCap },
  { value: 'SERVICES', label: 'Services & Agencies', icon: Briefcase },
  { value: 'MANUFACTURING', label: 'Manufacturing', icon: Factory },
  { value: 'HEALTHCARE', label: 'Healthcare', icon: HeartPulse },
];

export function Onboarding() {
  const { org, refresh } = useAuth();
  const { success, error } = useToast();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [businessType, setBusinessType] = useState('');
  const [addSample, setAddSample] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [busy, setBusy] = useState(false);

  const finish = async (skipSample: boolean) => {
    setBusy(true);
    try {
      const res = await api<{ sampleCount: number }>('/auth/onboarding', {
        body: { businessType: businessType || undefined, addSampleData: skipSample ? false : addSample },
      });
      await refresh();
      success('Workspace ready 🎉', skipSample ? 'Let\'s capture your first lead.' : `${res.sampleCount} sample leads added so you can explore.`);
      navigate('/app/dashboard');
    } catch (err) {
      error('Setup failed', friendlyError(err));
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50/60 px-4 py-10">
      <div className="w-full max-w-xl">
        {/* Progress */}
        <div className="mb-8 flex items-center gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className={cn('h-1.5 flex-1 rounded-full transition-colors', i <= step ? 'bg-primary' : 'bg-slate-200')} />
          ))}
        </div>

        <div className="rounded-2xl border bg-card p-8 shadow-xl animate-fade-in">
          {step === 0 && (
            <div>
              <StepHeader icon={<Building2 className="h-6 w-6" />} title={`Welcome, ${org?.name || 'your business'}!`} desc="First, what kind of business is this? We'll tailor the defaults to you." />
              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {TYPES.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => setBusinessType(t.value)}
                    className={cn(
                      'flex flex-col items-center gap-2 rounded-xl border p-4 text-sm font-medium transition-all',
                      businessType === t.value ? 'border-primary bg-primary/5 text-primary shadow-sm' : 'hover:border-primary/40 hover:bg-muted/40'
                    )}
                  >
                    <t.icon className="h-6 w-6" />
                    {t.label}
                  </button>
                ))}
              </div>
              <div className="mt-6 flex justify-end">
                <Button onClick={() => setStep(1)} disabled={!businessType}>Continue <ArrowRight className="h-4 w-4" /></Button>
              </div>
            </div>
          )}

          {step === 1 && (
            <div>
              <StepHeader icon={<Database className="h-6 w-6" />} title="Do you want a head start?" desc="Add realistic sample data so you can explore the dashboard right away — or start clean." />
              <div className="mt-6 space-y-3">
                <button
                  onClick={() => setAddSample(true)}
                  className={cn('flex w-full items-start gap-4 rounded-xl border p-5 text-left transition-all', addSample ? 'border-primary bg-primary/5 shadow-sm' : 'hover:border-primary/40')}
                >
                  <span className={cn('mt-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2', addSample ? 'border-primary bg-primary' : 'border-slate-300')}>
                    {addSample && <Check className="h-3 w-3 text-white" />}
                  </span>
                  <span>
                    <span className="flex items-center gap-2 font-semibold"><Sparkles className="h-4 w-4 text-primary" /> Add sample data</span>
                    <span className="mt-1 block text-sm text-muted-foreground">12 realistic Indian leads, follow-ups and activity — perfect for exploring. Delete them anytime.</span>
                  </span>
                </button>
                <button
                  onClick={() => setAddSample(false)}
                  className={cn('flex w-full items-start gap-4 rounded-xl border p-5 text-left transition-all', !addSample ? 'border-primary bg-primary/5 shadow-sm' : 'hover:border-primary/40')}
                >
                  <span className={cn('mt-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2', !addSample ? 'border-primary bg-primary' : 'border-slate-300')}>
                    {!addSample && <Check className="h-3 w-3 text-white" />}
                  </span>
                  <span>
                    <span className="flex items-center gap-2 font-semibold"><FileUp className="h-4 w-4 text-primary" /> Start fresh</span>
                    <span className="mt-1 block text-sm text-muted-foreground">Import your own Excel file or add leads manually.</span>
                  </span>
                </button>
              </div>
              <div className="mt-6 flex justify-between">
                <Button variant="ghost" onClick={() => setStep(0)}>Back</Button>
                <Button onClick={() => setStep(2)}>Continue <ArrowRight className="h-4 w-4" /></Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <StepHeader icon={<Users className="h-6 w-6" />} title="Invite your sales team" desc="Optional — you can add team members anytime from Team settings." />
              <form
                className="mt-6 flex gap-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!inviteEmail.trim()) return;
                  setBusy(true);
                  try {
                    await api('/auth/onboarding', { body: { inviteEmails: [inviteEmail.trim()] } });
                    success('Invite sent', `We emailed ${inviteEmail} a link to set their password.`);
                    setInviteEmail('');
                  } catch (err) {
                    error('Could not invite', friendlyError(err));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="salesperson@company.com"
                  className="h-11 flex-1 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
                />
                <Button type="submit" variant="outline" loading={busy}>Add</Button>
              </form>
              <div className="mt-8 space-y-2 rounded-xl bg-muted/50 p-5">
                <p className="flex items-center gap-2 text-sm font-semibold"><Zap className="h-4 w-4 text-primary" /> All set to capture your first lead</p>
                <p className="text-sm text-muted-foreground">You'll land on the dashboard with auto-assignment, follow-ups and notifications already working.</p>
              </div>
              <div className="mt-6 flex justify-between">
                <Button variant="ghost" onClick={() => setStep(1)}>Back</Button>
                <Button onClick={() => finish(false)} loading={busy} size="lg">Let's go <ArrowRight className="h-4 w-4" /></Button>
              </div>
            </div>
          )}
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Skipping? <button onClick={() => finish(true)} className="font-semibold text-primary hover:underline">Take me to the dashboard</button>
        </p>
      </div>
    </div>
  );
}

function StepHeader({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">{icon}</span>
      <div>
        <h1 className="text-xl font-bold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
      </div>
    </div>
  );
}
