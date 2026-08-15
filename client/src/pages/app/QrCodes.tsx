import { useState } from 'react';
import {
  QrCode as QrCodeIcon, Plus, Copy, Check, Download, Power, Trash2, ExternalLink, ScanLine, Users, TrendingUp,
} from 'lucide-react';
import { useQrCodes, useCreateQrCode, useUpdateQrCode, useDeleteQrCode } from '@/hooks/queries';
import { useToast } from '@/hooks/use-toast';
import { friendlyError, useAuth } from '@/hooks/use-auth';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { QrCode } from '@/types';

const FIELD_LABELS: Record<string, string> = {
  name: 'Name',
  phone: 'Phone',
  email: 'Email',
  message: 'Message / enquiry',
};

const ALL_FIELDS = ['name', 'phone', 'email', 'message'];

function downloadPng(dataUrl: string, filename: string) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function QrCodes() {
  const { data, isLoading } = useQrCodes();
  const updateQr = useUpdateQrCode();
  const deleteQr = useDeleteQrCode();
  const [createOpen, setCreateOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const { success, error } = useToast();
  const { user } = useAuth();
  const isManager = ['OWNER', 'ADMIN', 'MANAGER'].includes(user?.role || '');

  const qrCodes = data?.qrCodes || [];
  const campaigns = data?.campaigns || [];

  const copyLink = async (qr: QrCode) => {
    try {
      await navigator.clipboard.writeText(qr.url);
      setCopiedId(qr.id);
      success('Link copied', 'The QR link is on your clipboard.');
      setTimeout(() => setCopiedId((c) => (c === qr.id ? null : c)), 2000);
    } catch {
      error('Could not copy', 'Please copy the link manually.');
    }
  };

  const toggleQr = async (qr: QrCode) => {
    try {
      await updateQr.mutateAsync({ id: qr.id, enabled: !qr.enabled });
      success(qr.enabled ? 'QR paused' : 'QR is live again', qr.enabled ? 'The form is now disabled.' : 'Customers can scan and submit again.');
    } catch (err) {
      error('Could not update', friendlyError(err));
    }
  };

  const removeQr = async (qr: QrCode) => {
    if (!window.confirm(`Delete "${qr.title}"? The QR code will stop working and its scan history is removed.`)) return;
    try {
      await deleteQr.mutateAsync(qr.id);
      success('Deleted', 'The QR code was removed.');
    } catch (err) {
      error('Could not delete', friendlyError(err));
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="QR lead capture"
        description="Print these QR codes, stick them anywhere customers look, and watch leads roll in automatically."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> Create QR Code
          </Button>
        }
      />

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-72" />)}
        </div>
      ) : qrCodes.length === 0 ? (
        <EmptyState
          icon={<QrCodeIcon className="h-7 w-7" />}
          title="No QR codes yet"
          description="Create your first QR code for the shop counter, exhibition stall, or visiting card. When customers scan it, they see a mobile-friendly form and the lead lands straight in your CRM."
          action={<Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> Create your first QR code</Button>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {qrCodes.map((qr) => (
            <Card key={qr.id} className="flex flex-col overflow-hidden p-0">
              <div className="flex items-center justify-between gap-2 border-b bg-muted/30 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{qr.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {qr.campaign?.name ? `Campaign: ${qr.campaign.name}` : 'No campaign'}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Badge tone={qr.enabled ? 'success' : 'muted'}>{qr.enabled ? 'Live' : 'Paused'}</Badge>
                  {isManager && (
                    <button
                      onClick={() => toggleQr(qr)}
                      className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      aria-label={qr.enabled ? 'Pause QR code' : 'Enable QR code'}
                    >
                      <Power className="h-4 w-4" />
                    </button>
                  )}
                  {isManager && (
                    <button
                      onClick={() => removeQr(qr)}
                      className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      aria-label="Delete QR code"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="flex flex-1 flex-col items-center gap-3 p-5">
                <div className={cn('rounded-2xl border bg-white p-3 shadow-sm transition-all', !qr.enabled && 'opacity-40 grayscale')}>
                  {qr.image ? (
                    <img src={qr.image} alt={`QR code for ${qr.title}`} className="h-36 w-36" />
                  ) : (
                    <div className="flex h-36 w-36 items-center justify-center text-muted-foreground"><QrCodeIcon className="h-10 w-10" /></div>
                  )}
                </div>
                {qr.description && <p className="text-center text-xs text-muted-foreground">{qr.description}</p>}
                <div className="flex items-center gap-2">
                  <Badge tone="info"><ScanLine className="h-3 w-3" /> {qr.scanCount} scans</Badge>
                  <Badge tone="primary"><Users className="h-3 w-3" /> {qr.leadCount} leads</Badge>
                  <Badge tone={qr.conversionRate >= 25 ? 'success' : 'muted'}>
                    <TrendingUp className="h-3 w-3" /> {qr.conversionRate}%
                  </Badge>
                </div>
              </div>

              <div className="flex items-center gap-1.5 border-t bg-muted/30 px-3 py-2.5">
                <button
                  onClick={() => copyLink(qr)}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border bg-background px-2 py-2 text-xs font-medium transition-colors hover:bg-accent"
                >
                  {copiedId === qr.id ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                  {copiedId === qr.id ? 'Copied' : 'Copy link'}
                </button>
                <a
                  href={qr.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border bg-background px-2 py-2 text-xs font-medium transition-colors hover:bg-accent"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Open
                </a>
                <button
                  onClick={() => qr.image && downloadPng(qr.image, `${qr.title.toLowerCase().replace(/\s+/g, '-')}-qr.png`)}
                  disabled={!qr.image}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border bg-background px-2 py-2 text-xs font-medium transition-colors hover:bg-accent disabled:opacity-50"
                >
                  <Download className="h-3.5 w-3.5" /> PNG
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <CreateQrDialog open={createOpen} onOpenChange={setCreateOpen} campaigns={campaigns} />
    </div>
  );
}

function CreateQrDialog({
  open,
  onOpenChange,
  campaigns,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  campaigns: Array<{ id: string; name: string }>;
}) {
  const createQr = useCreateQrCode();
  const { success, error } = useToast();
  const [form, setForm] = useState({
    title: '',
    description: '',
    campaignId: '',
    newCampaign: '',
  });
  const [fields, setFields] = useState<string[]>(ALL_FIELDS);

  const toggleField = (f: string) => {
    setFields((prev) => {
      if (prev.includes(f)) {
        const next = prev.filter((x) => x !== f);
        return next.length ? next : prev; // keep at least one
      }
      return [...prev, f];
    });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createQr.mutateAsync({
        title: form.title,
        description: form.description || undefined,
        campaignId: form.campaignId || undefined,
        campaignName: form.newCampaign || undefined,
        fields,
      });
      success('QR code created', 'Download it, print it, and put it somewhere customers will see it.');
      setForm({ title: '', description: '', campaignId: '', newCampaign: '' });
      setFields(ALL_FIELDS);
      onOpenChange(false);
    } catch (err) {
      error('Could not create QR code', friendlyError(err));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Create a QR code" description="Pick where it goes, what it says, and which fields customers fill in. The form opens on their phone when they scan it.">
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="qr-title">Title *</Label>
            <Input
              id="qr-title"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Shop Counter, Exhibition, Visiting Card…"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="qr-campaign">Campaign</Label>
              <Select id="qr-campaign" value={form.campaignId} onChange={(e) => setForm({ ...form, campaignId: e.target.value })}>
                <option value="">Existing campaign…</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qr-new-campaign">Or create new</Label>
              <Input
                id="qr-new-campaign"
                value={form.newCampaign}
                onChange={(e) => setForm({ ...form, newCampaign: e.target.value })}
                placeholder="New campaign name"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="qr-desc">Description (shown on the form)</Label>
            <Textarea
              id="qr-desc"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Scan to enquire about our products and services."
            />
          </div>

          <div className="space-y-2">
            <Label>Lead form fields</Label>
            <div className="flex flex-wrap gap-2">
              {ALL_FIELDS.map((f) => {
                const on = fields.includes(f);
                return (
                  <button
                    key={f}
                    type="button"
                    onClick={() => toggleField(f)}
                    className={cn(
                      'rounded-full border px-3.5 py-1.5 text-sm font-medium transition-all',
                      on ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-accent'
                    )}
                  >
                    {FIELD_LABELS[f]}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" loading={createQr.isPending}>
              <QrCodeIcon className="h-4 w-4" /> Generate QR code
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
