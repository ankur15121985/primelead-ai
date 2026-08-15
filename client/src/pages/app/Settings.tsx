import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, User, SlidersHorizontal, Sparkles, ShieldCheck } from 'lucide-react';
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

export function Settings() {
  return (
    <div className="space-y-5">
      <PageHeader title="Settings" description="Your profile, organisation and workspace preferences." />
      <div className="grid gap-5 lg:grid-cols-2">
        <ProfileCard />
        <OrgCard />
        <AssignmentRules />
        <AiSettings />
      </div>
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
