import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MailCheck } from 'lucide-react';
import { useSeo } from '@/hooks/use-seo';
import { api } from '@/lib/api';
import { friendlyError } from '@/hooks/use-auth';
import { AuthShell } from './AuthShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function ForgotPassword() {
  useSeo('Forgot password — PRIMELEAD AI');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrorMsg('');
    try {
      await api('/auth/forgot-password', { body: { email } });
      setSent(true);
    } catch (err) {
      setErrorMsg(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <AuthShell>
        <div className="text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-success/10 text-success">
            <MailCheck className="h-7 w-7" />
          </span>
          <h1 className="mt-5 text-2xl font-bold">Check your inbox</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            If an account exists for <strong>{email}</strong>, we've sent a reset link valid for 1 hour.
            <br />In development mode the link is printed in the server console.
          </p>
          <Link to="/login" className="mt-6 inline-block text-sm font-semibold text-primary hover:underline">Back to log in</Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <h1 className="text-2xl font-bold tracking-tight">Reset your password</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">Enter your email and we'll send you a reset link.</p>
      <form onSubmit={submit} className="mt-8 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="fp-email">Email</Label>
          <Input id="fp-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
        </div>
        {errorMsg && <p className="text-sm font-medium text-destructive">{errorMsg}</p>}
        <Button type="submit" loading={busy} className="w-full" size="lg">Send reset link</Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        <Link to="/login" className="font-semibold text-primary hover:underline">← Back to log in</Link>
      </p>
    </AuthShell>
  );
}
