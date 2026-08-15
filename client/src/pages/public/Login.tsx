import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShieldCheck, KeyRound } from 'lucide-react';
import { useSeo } from '@/hooks/use-seo';
import { useAuth, friendlyError } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { AuthShell } from './AuthShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function Login() {
  useSeo('Log in — PRIMELEAD AI');
  const { login, completeMfa } = useAuth();
  const { success, error } = useToast();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  // MFA challenge state
  const [mfaToken, setMfaToken] = useState('');
  const [code, setCode] = useState('');
  const [recovery, setRecovery] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const data = await login(email, password);
      if (data.mfaRequired && data.mfaToken) {
        setMfaToken(data.mfaToken);
        setCode('');
        setRecovery(false);
        return; // stay on the page, second step renders
      }
      success('Welcome back!');
      navigate('/app/dashboard');
    } catch (err) {
      error('Sign in failed', friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  const submitMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await completeMfa(mfaToken, code, recovery);
      success('Welcome back!');
      navigate('/app/dashboard');
    } catch (err) {
      error('Verification failed', friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  if (mfaToken) {
    return (
      <AuthShell>
        <h1 className="text-2xl font-bold tracking-tight">Two-step verification</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {recovery ? 'Enter one of your recovery codes to finish signing in.' : 'Enter the 6-digit code from your authenticator app.'}
        </p>
        <form onSubmit={submitMfa} className="mt-8 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="code">{recovery ? 'Recovery code' : 'Verification code'}</Label>
            <Input
              id="code"
              required
              autoFocus
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={recovery ? 'XXXX-XXXX-XXXX-XXXX' : '123456'}
              className="text-center font-mono text-lg tracking-widest"
            />
          </div>
          <Button type="submit" loading={busy} className="w-full" size="lg">
            <ShieldCheck className="h-4 w-4" /> Verify
          </Button>
        </form>
        <button
          type="button"
          onClick={() => setRecovery((r) => !r)}
          className="mt-4 flex w-full items-center justify-center gap-1.5 text-sm font-semibold text-primary hover:underline"
        >
          <KeyRound className="h-3.5 w-3.5" />
          {recovery ? 'Use an authenticator code instead' : 'Use a recovery code instead'}
        </button>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Wrong account?{' '}
          <button
            type="button"
            onClick={() => setMfaToken('')}
            className="font-semibold text-primary hover:underline"
          >
            Go back
          </button>
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">Log in to your sales workspace.</p>
      <form onSubmit={submit} className="mt-8 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link to="/forgot-password" className="text-xs font-semibold text-primary hover:underline">Forgot password?</Link>
          </div>
          <Input id="password" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
        </div>
        <Button type="submit" loading={busy} className="w-full" size="lg">Log in</Button>
      </form>
      <div className="mt-6 rounded-xl border border-dashed bg-muted/40 p-4 text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Demo account</p>
        <p className="mt-1 text-sm"><code className="rounded bg-background px-1.5 py-0.5 font-mono">owner@primelead.demo</code></p>
        <p className="text-sm"><code className="rounded bg-background px-1.5 py-0.5 font-mono">Demo@1234</code></p>
      </div>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        New to PRIMELEAD? <Link to="/signup" className="font-semibold text-primary hover:underline">Create a free account</Link>
      </p>
    </AuthShell>
  );
}
