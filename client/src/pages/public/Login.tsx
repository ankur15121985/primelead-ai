import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSeo } from '@/hooks/use-seo';
import { useAuth, friendlyError } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { AuthShell } from './AuthShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function Login() {
  useSeo('Log in — LeadFlow AI');
  const { login } = useAuth();
  const { success, error } = useToast();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await login(email, password);
      success('Welcome back!');
      navigate('/app/dashboard');
    } catch (err) {
      error('Sign in failed', friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

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
        <p className="mt-1 text-sm"><code className="rounded bg-background px-1.5 py-0.5 font-mono">owner@leadflow.demo</code></p>
        <p className="text-sm"><code className="rounded bg-background px-1.5 py-0.5 font-mono">Demo@1234</code></p>
      </div>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        New to LeadFlow? <Link to="/signup" className="font-semibold text-primary hover:underline">Create a free account</Link>
      </p>
    </AuthShell>
  );
}
