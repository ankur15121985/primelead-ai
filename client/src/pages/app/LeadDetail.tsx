import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft, Phone, MessageCircle, Mail, StickyNote, CalendarClock, Sparkles, Send, RefreshCw,
  UserCircle2, Tag, Building2, IndianRupee, Gauge, ChevronDown, CheckCircle2, XCircle, Target, Pencil, Copy, Check,
} from 'lucide-react';
import { useLead, useAddActivity, useAddFollowUp, useUpdateLead, useAiFollowUp, useTeam } from '@/hooks/queries';
import { useToast } from '@/hooks/use-toast';
import { friendlyError, useAuth } from '@/hooks/use-auth';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { StatusBadge, PriorityBadge } from '@/components/leads/StatusBadge';
import { formatINR, formatDate, formatDateTime, timeAgo, dueLabel } from '@/lib/format';
import { sourceLabel } from '@/lib/constants';
import { cn } from '@/lib/utils';
import type { Activity, LeadDetail as LeadDetailType } from '@/types';

export function LeadDetail() {
  const { id = '' } = useParams();
  const { data, isLoading } = useLead(id);
  const lead = data?.lead;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-40 w-full" />
        <div className="grid gap-5 lg:grid-cols-3"><Skeleton className="h-80 lg:col-span-2" /><Skeleton className="h-80" /></div>
      </div>
    );
  }
  if (!lead) return <NotFound />;
  return <LeadBody lead={lead} />;
}

function NotFound() {
  return (
    <EmptyState
      icon={<Target className="h-6 w-6" />}
      title="Lead not found"
      description="It may have been deleted, or you don't have access to it."
      action={<Link to="/app/leads"><Button variant="outline"><ArrowLeft className="h-4 w-4" /> Back to leads</Button></Link>}
    />
  );
}

const ACTIVITY_ICONS: Record<string, { icon: typeof Phone; cls: string }> = {
  CALL: { icon: Phone, cls: 'bg-info/10 text-info' },
  WHATSAPP: { icon: MessageCircle, cls: 'bg-success/10 text-success' },
  EMAIL: { icon: Mail, cls: 'bg-amber-100 text-amber-700' },
  NOTE: { icon: StickyNote, cls: 'bg-violet-100 text-violet-700' },
  MEETING: { icon: CalendarClock, cls: 'bg-pink-100 text-pink-700' },
  FOLLOW_UP: { icon: CalendarClock, cls: 'bg-amber-100 text-amber-700' },
  STATUS_CHANGE: { icon: ChevronDown, cls: 'bg-primary/10 text-primary' },
  ASSIGNMENT: { icon: UserCircle2, cls: 'bg-primary/10 text-primary' },
  LEAD_CREATED: { icon: Sparkles, cls: 'bg-primary/10 text-primary' },
};

function LeadBody({ lead }: { lead: LeadDetailType }) {
  const { user } = useAuth();
  const { success, error } = useToast();
  const updateLead = useUpdateLead(lead.id);
  const addActivity = useAddActivity(lead.id);
  const addFollowUp = useAddFollowUp(lead.id);
  const { data: team } = useTeam();

  const [note, setNote] = useState('');
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);

  const isManager = user && ['OWNER', 'ADMIN', 'MANAGER'].includes(user.role);
  const waLink = useMemo(() => {
    const number = (lead.phone || '').replace(/[^\d]/g, '');
    const country = number.length === 10 ? '91' : '';
    return number ? `https://wa.me/${country}${number}?text=${encodeURIComponent(`Hi ${lead.name}, this is ${user?.name} from ${'our team'}.`)}` : null;
  }, [lead.phone, lead.name, user?.name]);
  const telLink = lead.phone ? `tel:${lead.phone}` : null;
  const mailLink = lead.email ? `mailto:${lead.email}?subject=${encodeURIComponent('Enquiry follow-up')}` : null;

  const logActivity = async (type: string, body: string) => {
    if (!body.trim()) return;
    try {
      await addActivity.mutateAsync({ type, body });
      success('Logged', 'Activity added to the timeline.');
    } catch (err) {
      error('Could not log activity', friendlyError(err));
    }
  };

  const changeStage = async (stageId: string, reason?: string, outcome?: 'won' | 'lost') => {
    try {
      await updateLead.mutateAsync({
        stageId,
        ...(outcome === 'won' ? { wonReason: reason } : outcome === 'lost' ? { lostReason: reason } : {}),
      });
      success('Stage updated');
    } catch (err) {
      error('Could not move lead', friendlyError(err));
    }
  };

  const changeOwner = async (ownerId: string) => {
    try {
      await updateLead.mutateAsync({ ownerId });
      success('Owner updated');
    } catch (err) {
      error('Could not reassign', friendlyError(err));
    }
  };

  const due = dueLabel(lead.nextFollowUpAt);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link to="/app/leads" className="rounded-lg p-2 hover:bg-accent" aria-label="Back to leads">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{lead.name}</h1>
            <StatusBadge status={lead.status} />
            <PriorityBadge priority={lead.priority} />
            {lead.wonReason && <Badge tone="success">Won: {lead.wonReason}</Badge>}
            {lead.lostReason && <Badge tone="danger">Lost: {lead.lostReason}</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">
            {lead.company || 'Individual'} · {sourceLabel(lead.source)}
            {lead.campaignName ? ` · ${lead.campaignName}` : ''} · added {timeAgo(lead.createdAt)}
          </p>
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-2">
        {telLink && (
          <a href={telLink}><Button variant="outline" className="bg-success/5"><Phone className="h-4 w-4 text-success" /> Call</Button></a>
        )}
        {waLink && (
          <a href={waLink} target="_blank" rel="noreferrer"><Button variant="outline" className="bg-success/5"><MessageCircle className="h-4 w-4 text-success" /> WhatsApp</Button></a>
        )}
        {mailLink && (
          <a href={mailLink}><Button variant="outline"><Mail className="h-4 w-4" /> Email</Button></a>
        )}
        <Button variant="outline" onClick={() => setAiOpen(true)}><Sparkles className="h-4 w-4 text-primary" /> AI follow-up</Button>
        <Button variant="outline" onClick={() => setFollowUpOpen(true)}><CalendarClock className="h-4 w-4" /> Schedule follow-up</Button>
        {isManager && <Button variant="ghost" onClick={() => setEditOpen(true)}><Pencil className="h-4 w-4" /> Edit</Button>}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Main: timeline + notes */}
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <CardHeader><CardTitle className="text-base">Quick note</CardTitle></CardHeader>
            <CardContent>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Log a call, WhatsApp, email or just a note…"
                className="min-h-[90px]"
              />
              <div className="mt-3 flex flex-wrap gap-2">
                {[
                  { t: 'CALL', label: 'Call' },
                  { t: 'WHATSAPP', label: 'WhatsApp' },
                  { t: 'EMAIL', label: 'Email' },
                  { t: 'NOTE', label: 'Note' },
                  { t: 'MEETING', label: 'Meeting' },
                ].map((a) => (
                  <Button key={a.t} size="sm" variant="secondary" onClick={() => logActivity(a.t, note)} disabled={addActivity.isPending || !note.trim()}>
                    {a.label}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Timeline</CardTitle></CardHeader>
            <CardContent>
              {lead.activities.length === 0 ? (
                <EmptyState title="No activity yet" description="Log your first call, WhatsApp or note above." />
              ) : (
                <ol className="relative ml-3 space-y-5 border-l pl-6">
                  {lead.activities.map((a) => <TimelineItem key={a.id} activity={a} />)}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          <Card>
            <CardHeader><CardTitle className="text-base">Details</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <DetailRow icon={Phone} label="Phone" value={lead.phone || '—'} href={telLink || undefined} />
              <DetailRow icon={Mail} label="Email" value={lead.email || '—'} href={mailLink || undefined} />
              <DetailRow icon={Building2} label="Company" value={lead.company || '—'} />
              <DetailRow icon={Tag} label="Source" value={sourceLabel(lead.source)} />
              <DetailRow icon={IndianRupee} label="Expected value" value={formatINR(lead.expectedValue)} />
              <DetailRow icon={Gauge} label="Lead score" value={`${lead.score}/100`} />
              <DetailRow icon={CalendarClock} label="Last contacted" value={formatDate(lead.lastContactedAt)} />
              <DetailRow icon={CalendarClock} label="Next follow-up" value={lead.nextFollowUpAt ? formatDateTime(lead.nextFollowUpAt) : '—'} />
              <DetailRow icon={Target} label="Expected close" value={lead.expectedCloseAt ? formatDate(lead.expectedCloseAt) : '—'} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Pipeline stage</CardTitle></CardHeader>
            <CardContent>
              {lead.stage ? (
                <div className="mb-3 flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full" style={{ background: lead.stage.color }} />
                  <span className="text-sm font-semibold">{lead.stage.name}</span>
                </div>
              ) : null}
              <StagePicker lead={lead} onChange={changeStage} />
              <div className="mt-4">
                <Label className="text-xs">Assign to</Label>
                <Select className="mt-1" value={lead.ownerId || ''} onChange={(e) => e.target.value && changeOwner(e.target.value)}>
                  <option value="">Unassigned</option>
                  {team?.users.filter((u) => u.active).map((u) => <option key={u.id} value={u.id}>{u.name} ({u.role.toLowerCase()})</option>)}
                </Select>
              </div>
            </CardContent>
          </Card>

          {lead.notes && (
            <Card>
              <CardHeader><CardTitle className="text-base">Notes</CardTitle></CardHeader>
              <CardContent><p className="whitespace-pre-wrap text-sm text-muted-foreground">{lead.notes}</p></CardContent>
            </Card>
          )}
          {lead.tags && lead.tags.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Tags</CardTitle></CardHeader>
              <CardContent className="flex flex-wrap gap-1.5">
                {lead.tags.map((t) => <Badge key={t} tone="primary">#{t}</Badge>)}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <FollowUpDialog open={followUpOpen} onOpenChange={setFollowUpOpen} onSubmit={async (data) => {
        try {
          await addFollowUp.mutateAsync(data);
          success('Follow-up scheduled');
          setFollowUpOpen(false);
        } catch (err) {
          error('Could not schedule', friendlyError(err));
        }
      }} />

      <EditDialog open={editOpen} onOpenChange={setEditOpen} lead={lead} onSave={async (data) => {
        try {
          await updateLead.mutateAsync(data);
          success('Lead updated');
          setEditOpen(false);
        } catch (err) {
          error('Could not update', friendlyError(err));
        }
      }} />

      <AiFollowUpDialog open={aiOpen} onOpenChange={setAiOpen} leadId={lead.id} />
    </div>
  );
}

function TimelineItem({ activity }: { activity: Activity }) {
  const meta = ACTIVITY_ICONS[activity.type] || ACTIVITY_ICONS.NOTE;
  const Icon = meta.icon;
  return (
    <li className="relative animate-fade-in">
      <span className={cn('absolute -left-[31px] top-0 flex h-6 w-6 items-center justify-center rounded-full', meta.cls)}>
        <Icon className="h-3 w-3" />
      </span>
      <p className="text-sm">
        <span className="font-semibold">{activity.title}</span>
        {activity.user && <span className="text-muted-foreground"> · {activity.user.name}</span>}
        <span className="ml-1 text-xs text-muted-foreground">{timeAgo(activity.createdAt)}</span>
      </p>
      {activity.body && <p className="mt-0.5 text-sm text-muted-foreground">{activity.body}</p>}
    </li>
  );
}

function DetailRow({ icon: Icon, label, value, href }: { icon: typeof Phone; label: string; value: string; href?: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="flex items-center gap-2 text-muted-foreground"><Icon className="h-4 w-4" />{label}</span>
      {href ? <a href={href} className="text-right font-medium text-primary hover:underline">{value}</a> : <span className="text-right font-medium">{value}</span>}
    </div>
  );
}

function StagePicker({ lead, onChange }: { lead: LeadDetailType; onChange: (stageId: string, reason?: string, outcome?: 'won' | 'lost') => void }) {
  const { data: pipeline } = usePipelineForStages();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<PipelineStage | null>(null);
  const [reason, setReason] = useState('');
  const stages = pipeline?.stages || [];

  const pick = (s: PipelineStage) => {
    // Terminal stages ask for a reason first.
    if (s.isWon || s.isLost) {
      setPending(s);
      setReason('');
    } else {
      onChange(s.id);
      setOpen(false);
    }
  };

  const confirm = () => {
    if (!pending) return;
    onChange(pending.id, reason.trim() || undefined, pending.isWon ? 'won' : 'lost');
    setPending(null);
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between rounded-lg border bg-background px-3 py-2.5 text-sm font-medium hover:bg-accent"
      >
        Move to stage <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full rounded-lg border bg-background p-1.5 shadow-xl animate-scale-in">
          {stages.map((s) => (
            <button
              key={s.id}
              onClick={() => pick(s)}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm hover:bg-accent"
            >
              <span className="h-3 w-3 rounded-full" style={{ background: s.color }} />
              <span className={cn('font-medium', lead.stageId === s.id && 'text-primary')}>{s.name}</span>
              {s.isWon && <CheckCircle2 className="ml-auto h-4 w-4 text-success" />}
              {s.isLost && <XCircle className="ml-auto h-4 w-4 text-destructive" />}
              {lead.stageId === s.id && !s.isWon && !s.isLost && <CheckCircle2 className="ml-auto h-4 w-4 text-primary" />}
            </button>
          ))}
        </div>
      )}
      {pending && (
        <div className="mt-2 rounded-lg border bg-background p-3 shadow-xl animate-scale-in">
          <p className="text-xs font-semibold">{pending.isWon ? 'Mark as won' : 'Mark as lost'} — {pending.name}</p>
          <Input
            className="mt-2"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={pending.isWon ? 'What won the deal? (optional)' : 'Why was it lost? (optional)'}
          />
          <div className="mt-2 flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setPending(null)}>Cancel</Button>
            <Button size="sm" onClick={confirm}><CheckCircle2 className="h-3.5 w-3.5" /> Confirm</Button>
          </div>
        </div>
      )}
    </div>
  );
}

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { PipelineStage } from '@/types';
function usePipelineForStages() {
  return useQuery({
    queryKey: ['pipeline'],
    queryFn: () => api<{ stages: PipelineStage[] }>('/pipeline'),
  });
}

function FollowUpDialog({ open, onOpenChange, onSubmit }: { open: boolean; onOpenChange: (v: boolean) => void; onSubmit: (d: { title: string; kind: string; dueAt: string; notes?: string }) => void }) {
  const [form, setForm] = useState({ title: '', kind: 'CALL', dueAt: '', notes: '' });
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.dueAt) return;
    onSubmit({ title: form.title || 'Follow up with lead', kind: form.kind, dueAt: new Date(form.dueAt).toISOString(), notes: form.notes || undefined });
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Schedule a follow-up" description="The lead owner will be reminded at the right time.">
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>What needs to happen?</Label>
            <Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Call about quotation" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
                {['CALL', 'WHATSAPP', 'EMAIL', 'MEETING', 'FOLLOW_UP'].map((k) => <option key={k} value={k}>{k[0] + k.slice(1).toLowerCase()}</option>)}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Due date & time</Label>
              <Input required type="datetime-local" value={form.dueAt} onChange={(e) => setForm({ ...form, dueAt: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Notes (optional)</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit"><CalendarClock className="h-4 w-4" /> Schedule</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditDialog({ open, onOpenChange, lead, onSave }: { open: boolean; onOpenChange: (v: boolean) => void; lead: LeadDetailType; onSave: (d: Record<string, unknown>) => void }) {
  const [form, setForm] = useState(() => ({
    name: lead.name, phone: lead.phone || '', email: lead.email || '', company: lead.company || '',
    priority: lead.priority, expectedValue: String(lead.expectedValue || ''), notes: lead.notes || '',
    expectedCloseAt: lead.expectedCloseAt ? new Date(lead.expectedCloseAt).toISOString().slice(0, 16) : '',
  }));
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      name: form.name, phone: form.phone || null, email: form.email || null, company: form.company || null,
      priority: form.priority, expectedValue: Number(form.expectedValue) || 0, notes: form.notes || null,
      expectedCloseAt: form.expectedCloseAt ? new Date(form.expectedCloseAt).toISOString() : null,
    });
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Edit lead">
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5"><Label>Name</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Company</Label><Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} /></div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                {['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map((p) => <option key={p} value={p}>{p[0] + p.slice(1).toLowerCase()}</option>)}
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Expected value (₹)</Label><Input type="number" min={0} value={form.expectedValue} onChange={(e) => setForm({ ...form, expectedValue: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Expected close date</Label><Input type="datetime-local" value={form.expectedCloseAt} onChange={(e) => setForm({ ...form, expectedCloseAt: e.target.value })} /></div>
          </div>
          <div className="space-y-1.5"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit">Save changes</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AiFollowUpDialog({ open, onOpenChange, leadId }: { open: boolean; onOpenChange: (v: boolean) => void; leadId: string }) {
  const { error } = useToast();
  const ai = useAiFollowUp();
  const [tone, setTone] = useState('friendly');
  const [language, setLanguage] = useState('hinglish');
  const [channel, setChannel] = useState('whatsapp');
  const [objective, setObjective] = useState('');
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState(false);
  const { data: aiStatus } = useAiStatusQuery();

  const generate = async () => {
    try {
      const res = await ai.mutateAsync({ leadId, channel, tone, language, objective: objective || undefined });
      setMessage(res.message);
    } catch (err) {
      error('AI unavailable', friendlyError(err));
    }
  };

  const waNumber = useWaNumber(leadId);

  const copy = async () => {
    await navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={<span className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> AI follow-up writer</span>}
        description="AI reads this lead's history and writes a natural follow-up. You always edit before sending."
      >
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label className="text-xs">Channel</Label>
              <Select value={channel} onChange={(e) => setChannel(e.target.value)} className="mt-1">
                <option value="whatsapp">WhatsApp</option>
                <option value="email">Email</option>
                <option value="call">Call talking points</option>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Tone</Label>
              <Select value={tone} onChange={(e) => setTone(e.target.value)} className="mt-1">
                <option value="professional">Professional</option>
                <option value="friendly">Friendly</option>
                <option value="short">Short</option>
                <option value="persuasive">Persuasive</option>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Language</Label>
              <Select value={language} onChange={(e) => setLanguage(e.target.value)} className="mt-1">
                <option value="english">English</option>
                <option value="hindi">Hindi</option>
                <option value="hinglish">Hinglish</option>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Next objective (optional)</Label>
            <Input value={objective} onChange={(e) => setObjective(e.target.value)} placeholder="e.g. close the deal, share the quotation, schedule a site visit" />
          </div>
          <Button onClick={generate} loading={ai.isPending} disabled={!aiStatus?.configured} className="w-full">
            <Sparkles className="h-4 w-4" /> Write follow-up
          </Button>
          {!aiStatus?.configured && !ai.isPending && (
            <p className="rounded-lg border border-amber-300/50 bg-amber-50 p-3 text-xs text-amber-700">
              AI isn't connected yet. Add an API key in <Link to="/app/settings" className="font-semibold underline">Settings → AI</Link> to enable AI follow-ups.
            </p>
          )}
          {message && (
            <div className="space-y-2 rounded-xl border bg-muted/40 p-4 animate-fade-in">
              <Textarea value={message} onChange={(e) => setMessage(e.target.value)} className="min-h-[110px] bg-background" />
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={copy}>{copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />} {copied ? 'Copied' : 'Copy'}</Button>
                {channel === 'whatsapp' && waNumber && (
                  <a href={`https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer">
                    <Button size="sm" className="bg-success"><Send className="h-4 w-4" /> Open in WhatsApp</Button>
                  </a>
                )}
                <Button size="sm" variant="ghost" onClick={generate}><RefreshCw className="h-4 w-4" /> Regenerate</Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function useAiStatusQuery() {
  return useQuery({ queryKey: ['ai-status'], queryFn: () => api<{ configured: boolean }>('/ai/status'), retry: false });
}

function useWaNumber(leadId: string): string | null {
  const { data } = useLead(leadId);
  const num = data?.lead.phone?.replace(/[^\d]/g, '') || '';
  return num ? (num.length === 10 ? `91${num}` : num) : null;
}
