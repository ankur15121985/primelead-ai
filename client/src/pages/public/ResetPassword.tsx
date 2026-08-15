import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { useSeo } from '@/hooks/use-seo';
import { api } from '@/lib/api';
import { friendlyError } from '@/hooks/use-auth';
import { AuthShell } from './AuthShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function ResetPassword() {
  useSeo('Reset password — LeadFlow AI');
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return setErrorMsg('Password must be at least 8 characters.');
    if (password !== confirm) return setErrorMsg('Passwords do not match.');
    setBusy(true);
    setErrorMsg('');
    try {
      await api('/auth/reset-password', { body: { token, password } });
      setDone(true);
    } catch (err) {
      setErrorMsg(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <AuthShell>
        <div className="text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-success/10 text-success">
            <CheckCircle2 className="h-7 w-7" />
          </span>
          <h1 className="mt-5 text-2xl font-bold">Password updated</h1>
          <p className="mt-2 text-sm text-muted-foreground">You can now log in with your new password.</p>
          <Link to="/login">
            <Button className="mt-6">Log in</Button>
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <h1 className="text-2xl font-bold tracking-tight">Choose a new password</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">Make it at least 8 characters with a number.</p>
      <form onSubmit={submit} className="mt-8 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="rp-pw">New password</Label>
          <Input id="rp-pw" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rp-cw">Confirm password</Label>
          <Input id="rp-cw" type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" />
        </div>
        {errorMsg && <p className="text-sm font-medium text-destructive">{errorMsg}</p>}
        {!token && <p className="text-sm font-medium text-destructive">This reset link is invalid. Please request a new one.</p>}
        <Button type="submit" loading={busy} disabled={!token} className="w-full" size="lg">Update password</Button>
      </form>
    </AuthShell>
  );
}
