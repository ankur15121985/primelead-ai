import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, User, SlidersHorizontal, Sparkles, ShieldCheck, Smartphone, Monitor, LogOut, KeyRound } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { friendlyError, useAuth } from '@/hooks/use-auth';
import { useTeam } from '@/hooks/queries';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { BUSINESS_TYPES, LEAD_SOURCES } from '@/lib/constants';
import type { LoginHistoryEntry, UserSession } from '@/types';

export function Settings() {
  return (
    <div className="space-y-5">
      <PageHeader title="Settings" description="Your profile, organisation and workspace preferences." />
      <div className="grid gap-5 lg:grid-cols-2">
        <ProfileCard />
        <OrgCard />
        <AssignmentRules />
        <AiSettings />
        <SecurityCard />
      </div>
    </div>
  );
}

function SecurityCard() {
  const { user, refresh } = useAuth();
  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Security</CardTitle>
        <CardDescription>Multi-factor authentication, password, active devices and recent sign-ins.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-6">
          <MfaPanel mfaEnabled={Boolean(user?.mfaEnabled)} onChanged={refresh} />
          <ChangePassword />
        </div>
        <div className="space-y-6">
          <SessionsPanel />
          <LoginHistoryPanel />
        </div>
      </CardContent>
    </Card>
  );
}

function MfaPanel({ mfaEnabled, onChanged }: { mfaEnabled: boolean; onChanged: () => void }) {
  const { success, error } = useToast();
  const [busy, setBusy] = useState(false);
  // enable flow
  const [step, setStep] = useState<'idle' | 'setup' | 'confirm' | 'done'>('idle');
  const [setupData, setSetupData] = useState<{ secret: string; qrDataUrl: string } | null>(null);
  const [code, setCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [password, setPassword] = useState('');

  const startSetup = async () => {
    if (!password) {
      error('Password required', 'Enter your password to start setting up two-factor authentication.');
      return;
    }
    setBusy(true);
    try {
      const data = await api<{ secret: string; qrDataUrl: string }>('/auth/mfa/setup', { body: { password } });
      setSetupData(data);
      setStep('setup');
    } catch (err) {
      error('Could not start setup', friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  const confirmSetup = async () => {
    if (!setupData) return;
    setBusy(true);
    try {
      const data = await api<{ enabled: boolean; recoveryCodes: string[] }>('/auth/mfa/confirm', {
        body: { secret: setupData.secret, code },
      });
      setRecoveryCodes(data.recoveryCodes);
      setStep('done');
      setPassword('');
      onChanged();
      success('Two-factor authentication enabled');
    } catch (err) {
      error('Could not confirm', friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    if (!password || !code) {
      error('Details required', 'Enter your password and a current code from your authenticator app.');
      return;
    }
    setBusy(true);
    try {
      await api('/auth/mfa/disable', { body: { password, code } });
      setStep('idle');
      setCode('');
      setPassword('');
      onChanged();
      success('Two-factor authentication disabled');
    } catch (err) {
      error('Could not disable', friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  if (step === 'setup' && setupData) {
    return (
      <div className="space-y-3">
        <p className="text-sm font-semibold">Scan the QR code</p>
        <div className="flex gap-4">
          <img src={setupData.qrDataUrl} alt="TOTP setup QR code" className="h-32 w-32 rounded-lg border" />
          <div className="text-xs text-muted-foreground">
            <p>Scan with Google Authenticator, Authy, 1Password or any TOTP app.</p>
            <p className="mt-2">Can't scan? Manual key:</p>
            <code className="mt-1 block break-all rounded bg-muted px-2 py-1 font-mono text-[11px]">{setupData.secret}</code>
          </div>
        </div>
        <div className="space-y-1.5 pt-1">
          <Label htmlFor="mfa-code">Enter the 6-digit code</Label>
          <Input id="mfa-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" className="font-mono tracking-widest" />
        </div>
        <div className="flex gap-2">
          <Button onClick={confirmSetup} loading={busy}>Verify & enable</Button>
          <Button variant="ghost" onClick={() => { setStep('idle'); setSetupData(null); setCode(''); }}>Cancel</Button>
        </div>
      </div>
    );
  }

  if (step === 'done') {
    return (
      <div className="space-y-3">
        <p className="text-sm font-semibold text-success">Two-factor authentication is on.</p>
        <p className="text-xs text-muted-foreground">Save these one-time recovery codes somewhere safe. Each code works once.</p>
        <div className="grid grid-cols-2 gap-1.5">
          {recoveryCodes.map((c) => (
            <code key={c} className="rounded bg-muted px-2 py-1 text-center font-mono text-[11px]">{c}</code>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={() => { setStep('idle'); setRecoveryCodes([]); }}>Done</Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Two-factor authentication</p>
          <p className="text-xs text-muted-foreground">{mfaEnabled ? 'Enabled — a code is required at sign-in.' : 'Add an extra layer of protection to your account.'}</p>
        </div>
        <Badge tone={mfaEnabled ? 'success' : 'default'}>{mfaEnabled ? 'On' : 'Off'}</Badge>
      </div>
      {!mfaEnabled ? (
        <div className="space-y-2">
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Current password" autoComplete="current-password" />
          <Button onClick={startSetup} loading={busy} size="sm"><KeyRound className="h-3.5 w-3.5" /> Set up</Button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Current password" autoComplete="current-password" />
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Authenticator code" className="font-mono" />
          </div>
          <Button variant="outline" size="sm" onClick={disable} loading={busy}>Disable 2FA</Button>
        </div>
      )}
    </div>
  );
}

function ChangePassword() {
  const { success, error } = useToast();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '' });
  const [busy, setBusy] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api('/auth/change-password', { body: form });
      success('Password changed', 'All other devices have been signed out.');
      setForm({ currentPassword: '', newPassword: '' });
    } catch (err) {
      error('Could not change password', friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={save} className="space-y-3 border-t pt-5">
      <p className="text-sm font-medium">Change password</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <Input type="password" required value={form.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} placeholder="Current password" autoComplete="current-password" />
        <Input type="password" required minLength={8} value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} placeholder="New password (min 8 chars)" autoComplete="new-password" />
      </div>
      <Button type="submit" variant="outline" size="sm" loading={busy}>Update password</Button>
    </form>
  );
}

function SessionsPanel() {
  const { success, error } = useToast();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['sessions'],
    queryFn: () => api<{ sessions: UserSession[] }>('/auth/sessions'),
  });

  const revoke = async (id: string) => {
    try {
      await api(`/auth/sessions/${id}/revoke`, { body: {} });
      await refetch();
      success('Session signed out');
    } catch (err) {
      error('Could not revoke session', friendlyError(err));
    }
  };

  const revokeOthers = async () => {
    try {
      const res = await api<{ revoked: number }>('/auth/sessions/revoke-others', { body: {} });
      await refetch();
      success('Other devices signed out', `${res.revoked} session(s) ended.`);
    } catch (err) {
      error('Could not sign out devices', friendlyError(err));
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Active sessions</p>
        {data && data.sessions.length > 1 && (
          <Button variant="outline" size="sm" onClick={revokeOthers}><LogOut className="h-3.5 w-3.5" /> Sign out others</Button>
        )}
      </div>
      {isLoading ? <Skeleton className="h-24" /> : (
        <div className="space-y-2">
          {data?.sessions.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <div className="flex items-center gap-3">
                <span className="text-muted-foreground">{/android|iphone|ipad/i.test(s.deviceName) ? <Smartphone className="h-4 w-4" /> : <Monitor className="h-4 w-4" />}</span>
                <div>
                  <p className="text-sm font-medium">{s.deviceName} {s.current && <Badge tone="primary">This device</Badge>}</p>
                  <p className="text-xs text-muted-foreground">Last active {new Date(s.lastUsedAt).toLocaleString()}{s.ip ? ` · ${s.ip}` : ''}</p>
                </div>
              </div>
              {!s.current && (
                <Button variant="ghost" size="sm" onClick={() => revoke(s.id)}>Sign out</Button>
              )}
            </div>
          ))}
          {data && data.sessions.length === 0 && <p className="text-sm text-muted-foreground">No active sessions.</p>}
        </div>
      )}
    </div>
  );
}

function LoginHistoryPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ['login-history'],
    queryFn: () => api<{ history: LoginHistoryEntry[] }>('/auth/login-history'),
  });

  return (
    <div className="space-y-3 border-t pt-5">
      <p className="text-sm font-medium">Recent sign-ins</p>
      {isLoading ? <Skeleton className="h-24" /> : (
        <div className="space-y-1.5">
          {data?.history.slice(0, 6).map((h, i) => (
            <div key={i} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
              <div className="flex items-center gap-2 text-sm">
                <span className={`h-2 w-2 rounded-full ${h.success ? 'bg-success' : 'bg-destructive'}`} />
                <span className="font-medium">{h.success ? 'Successful sign-in' : 'Failed attempt'}</span>
                <span className="text-xs text-muted-foreground">{h.newDevice ? '· new device' : ''}</span>
              </div>
              <span className="text-xs text-muted-foreground">{new Date(h.createdAt).toLocaleString()}</span>
            </div>
          ))}
          {data && data.history.length === 0 && <p className="text-sm text-muted-foreground">No sign-in history yet.</p>}
        </div>
      )}
    </div>
  );
}

function ProfileCard() {
  const { user, refresh } = useAuth();
  const { success, error } = useToast();
  const [form, setForm] = useState({ name: user?.name || '', phone: user?.phone || '', title: user?.title || '' });
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await api('/settings/profile', { method: 'PATCH', body: form });
      await refresh();
      success('Profile updated');
    } catch (err) {
      error('Could not update', friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><User className="h-4 w-4" /> Profile</CardTitle>
        <CardDescription>How you appear to your team and customers.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5"><Label>Full name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5"><Label>Phone</Label><Input value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="98XXXXXXXX" /></div>
          <div className="space-y-1.5"><Label>Job title</Label><Input value={form.title || ''} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Sales Executive" /></div>
        </div>
        <div className="space-y-1.5">
          <Label>Email (sign-in)</Label>
          <Input value={user?.email || ''} disabled className="bg-muted" />
          {!user?.emailVerified && (
            <p className="flex items-center gap-1.5 text-xs text-amber-600">
              <ShieldCheck className="h-3.5 w-3.5" /> Email not verified — check your inbox (or the server console in dev mode).
            </p>
          )}
        </div>
        <Button onClick={save} loading={busy}>Save profile</Button>
      </CardContent>
    </Card>
  );
}

function OrgCard() {
  const { org, refresh } = useAuth();
  const { success, error } = useToast();
  const [name, setName] = useState(org?.name || '');
  const [businessType, setBusinessType] = useState(org?.businessType || '');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await api('/settings/org', { method: 'PATCH', body: { name, businessType: businessType || undefined } });
      await refresh();
      success('Organisation updated');
    } catch (err) {
      error('Could not update', friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Building2 className="h-4 w-4" /> Organisation</CardTitle>
        <CardDescription>Your company details used in quotations and invoices.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5"><Label>Business name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="space-y-1.5">
          <Label>Business type</Label>
          <Select value={businessType} onChange={(e) => setBusinessType(e.target.value)}>
            <option value="">Select…</option>
            {BUSINESS_TYPES.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
          </Select>
        </div>
        <div className="flex items-center justify-between rounded-lg border bg-muted/40 p-3">
          <div>
            <p className="text-sm font-medium">Plan</p>
            <p className="text-xs text-muted-foreground">Growth · trial</p>
          </div>
          <Badge tone="primary">{org?.plan}</Badge>
        </div>
        <div className="flex items-center justify-between">
          <Link to="/app/team" className="text-sm font-semibold text-primary hover:underline">Manage team members →</Link>
          <Button onClick={save} loading={busy}>Save</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function AssignmentRules() {
  const { success, error } = useToast();
  const { data: team } = useTeam();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api<{ sourceAssignments: Record<string, string> | null }>('/settings'),
  });
  const [rules, setRules] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (data && !loaded) {
      setRules(data.sourceAssignments || {});
      setLoaded(true);
    }
  }, [data, loaded]);

  const save = async () => {
    try {
      await api('/settings/source-assignments', { body: { rules } });
      await qc.invalidateQueries({ queryKey: ['settings'] });
      success('Assignment rules saved', 'New leads will follow these rules.');
    } catch (err) {
      error('Could not save', friendlyError(err));
    }
  };

  const sources = ['WEBSITE', 'WHATSAPP', 'FACEBOOK', 'INDIAMART', 'JUSTDIAL', 'GOOGLE_ADS'];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><SlidersHorizontal className="h-4 w-4" /> Auto-assignment rules</CardTitle>
        <CardDescription>Route specific lead sources to specific salespeople. Other sources use least-loaded assignment automatically.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? <Skeleton className="h-40" /> : sources.map((src) => (
          <div key={src} className="flex items-center justify-between gap-3">
            <span className="w-28 text-sm font-medium">{LEAD_SOURCES.find((s) => s.value === src)?.label || src}</span>
            <Select
              value={rules[src] || ''}
              onChange={(e) => setRules({ ...rules, [src]: e.target.value })}
              className="h-9 flex-1"
            >
              <option value="">Auto (least-loaded)</option>
              {team?.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </Select>
          </div>
        ))}
        <Button onClick={save} className="mt-2">Save rules</Button>
      </CardContent>
    </Card>
  );
}

function AiSettings() {
  const { success, error } = useToast();
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await api('/settings/ai', { body: { apiKey: apiKey || undefined, model: model || undefined, provider: 'openai' } });
      success('AI settings saved', 'AI follow-ups are now ready to use.');
      setApiKey('');
    } catch (err) {
      error('Could not save', friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4" /> AI assistant</CardTitle>
        <CardDescription>
          Add your own API key (OpenAI or any OpenAI-compatible provider). The key is stored server-side only and never sent back to this page.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label>API key</Label>
          <Input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="sk-…" autoComplete="off" />
        </div>
        <div className="space-y-1.5">
          <Label>Model</Label>
          <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="gpt-4o-mini" />
        </div>
        <p className="rounded-lg border border-info/30 bg-info/5 p-3 text-xs text-muted-foreground">
          <ShieldCheck className="mr-1 inline h-3.5 w-3.5 text-info" />
          Alternative: set <code className="rounded bg-muted px-1">AI_API_KEY</code> in the server <code className="rounded bg-muted px-1">.env</code> to enable AI for the whole workspace.
        </p>
        <Button onClick={save} loading={busy}>Save AI settings</Button>
      </CardContent>
    </Card>
  );
}
