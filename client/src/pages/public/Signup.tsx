import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSeo } from '@/hooks/use-seo';
import { useAuth, friendlyError } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { AuthShell } from './AuthShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { BUSINESS_TYPES } from '@/lib/constants';

export function Signup() {
  useSeo('Start Free — PRIMELEAD AI');
  const { signup } = useAuth();
  const { success, error } = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', orgName: '', businessType: '' });
  const [busy, setBusy] = useState(false);
  const [pwError, setPwError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError('');
    if (form.password.length < 8) {
      setPwError('Password must be at least 8 characters.');
      return;
    }
    setBusy(true);
    try {
      await signup({ ...form, businessType: form.businessType || undefined });
      success('Account created 🎉', 'Let\'s set up your workspace.');
      navigate('/app/onboarding');
    } catch (err) {
      error('Sign up failed', friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell>
      <h1 className="text-2xl font-bold tracking-tight">Create your free account</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">Set up in 3 minutes. No credit card needed.</p>
      <form onSubmit={submit} className="mt-8 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="s-name">Your name</Label>
          <Input id="s-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Rohit Sharma" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="s-org">Business name</Label>
          <Input id="s-org" required value={form.orgName} onChange={(e) => setForm({ ...form, orgName: e.target.value })} placeholder="Sharma Enterprises" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="s-type">Business type</Label>
          <Select id="s-type" value={form.businessType} onChange={(e) => setForm({ ...form, businessType: e.target.value })}>
            <option value="">Select…</option>
            {BUSINESS_TYPES.map((b) => (
              <option key={b.value} value={b.value}>{b.label}</option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="s-email">Work email</Label>
          <Input id="s-email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@company.com" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="s-password">Password</Label>
          <Input id="s-password" type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="At least 8 characters with a number" />
          {pwError && <p className="text-xs font-medium text-destructive">{pwError}</p>}
        </div>
        <Button type="submit" loading={busy} className="w-full" size="lg">Create account</Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account? <Link to="/login" className="font-semibold text-primary hover:underline">Log in</Link>
      </p>
      <p className="mt-4 text-center text-xs text-muted-foreground">
        By signing up you agree to our Terms and Privacy Policy.
      </p>
    </AuthShell>
  );
}
