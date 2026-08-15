import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Plus, Search, Download, ArrowRightCircle, Trash2, CheckCircle2, Send } from 'lucide-react';
import { useQuotations, useCreateQuotation, useUpdateQuotation, useDeleteQuotation, useConvertQuotation, downloadQuotationPdf } from '@/hooks/queries';
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { Quotation } from '@/types';

const STATUS_META: Record<string, { label: string; tone: 'primary' | 'success' | 'muted' | 'danger' | 'info' | 'warning' }> = {
  DRAFT: { label: 'Draft', tone: 'muted' },
  SENT: { label: 'Sent', tone: 'info' },
  ACCEPTED: { label: 'Accepted', tone: 'success' },
  REJECTED: { label: 'Rejected', tone: 'danger' },
  EXPIRED: { label: 'Expired', tone: 'warning' },
  CONVERTED: { label: 'Converted', tone: 'primary' },
};

export function inr(n: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

export function Quotations() {
  const [status, setStatus] = useState('ALL');
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const { data, isLoading } = useQuotations({ status, search });
  const { user } = useAuth();
  const isManager = ['OWNER', 'ADMIN', 'MANAGER'].includes(user?.role || '');
  const { success, error } = useToast();
  const navigate = useNavigate();
  const updateQ = useUpdateQuotation();
  const deleteQ = useDeleteQuotation();
  const convertQ = useConvertQuotation();

  const quotations = data?.quotations || [];
  const counts = data?.counts || {};

  const send = async (q: Quotation) => {
    try {
      await updateQ.mutateAsync({ id: q.id, status: 'SENT' });
      success(`${q.number} sent`, 'Marked as sent. Share the PDF with your customer.');
    } catch (err) {
      error('Could not update', friendlyError(err));
    }
  };

  const accept = async (q: Quotation) => {
    try {
      await updateQ.mutateAsync({ id: q.id, status: 'ACCEPTED' });
      success('Quotation accepted 🎉', 'Convert it to an invoice when ready.');
    } catch (err) {
      error('Could not update', friendlyError(err));
    }
  };

  const convert = async (q: Quotation) => {
    try {
      await convertQ.mutateAsync(q.id);
      success('Converted to invoice', `${q.number} is now an invoice.`);
      navigate('/app/invoices');
    } catch (err) {
      error('Could not convert', friendlyError(err));
    }
  };

  const remove = async (q: Quotation) => {
    if (!window.confirm(`Delete ${q.number}? This cannot be undone.`)) return;
    try {
      await deleteQ.mutateAsync(q.id);
      success('Deleted', `${q.number} was removed.`);
    } catch (err) {
      error('Could not delete', friendlyError(err));
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Quotations"
        description="Create GST-ready quotations in seconds, share the PDF, and convert accepted ones straight into invoices."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> New quotation
          </Button>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative sm:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search number or customer…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select className="sm:w-48" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="ALL">All statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="SENT">Sent</option>
          <option value="ACCEPTED">Accepted</option>
          <option value="CONVERTED">Converted</option>
        </Select>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Badge tone="muted">{counts.total ?? quotations.length} total</Badge>
          <Badge tone="info">{counts.sent ?? 0} sent</Badge>
          <Badge tone="success">{counts.accepted ?? 0} accepted</Badge>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
      ) : quotations.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-7 w-7" />}
          title="No quotations yet"
          description="Create your first quotation for a lead. Prices, GST (CGST/SGST/IGST) and totals are calculated automatically."
          action={<Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> Create quotation</Button>}
        />
      ) : (
        <Card className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quotations.map((q) => {
                const meta = STATUS_META[q.status] || STATUS_META.DRAFT;
                return (
                  <TableRow key={q.id} className="cursor-pointer" onClick={() => navigate(`/app/quotations/${q.id}`)}>
                    <TableCell className="font-medium">{q.number}</TableCell>
                    <TableCell>
                      <p className="font-medium">{q.customerName}</p>
                      {q.company && <p className="text-xs text-muted-foreground">{q.company}</p>}
                    </TableCell>
                    <TableCell><Badge tone={meta.tone}>{meta.label}</Badge></TableCell>
                    <TableCell className="text-right font-semibold">{inr(q.total)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(q.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        {isManager && q.status === 'DRAFT' && (
                          <button onClick={() => send(q)} className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Mark as sent" title="Mark as sent">
                            <Send className="h-4 w-4" />
                          </button>
                        )}
                        {isManager && q.status === 'SENT' && (
                          <button onClick={() => accept(q)} className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Mark accepted" title="Mark accepted">
                            <CheckCircle2 className="h-4 w-4 text-success" />
                          </button>
                        )}
                        {isManager && q.status === 'ACCEPTED' && (
                          <button onClick={() => convert(q)} className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Convert to invoice" title="Convert to invoice">
                            <ArrowRightCircle className="h-4 w-4 text-primary" />
                          </button>
                        )}
                        <button onClick={() => downloadQuotationPdf(q.id).catch(() => error('Download failed', 'Please try again.'))} className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Download PDF" title="Download PDF">
                          <Download className="h-4 w-4" />
                        </button>
                        {isManager && (
                          <button onClick={() => remove(q)} className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" aria-label="Delete" title="Delete">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      <CreateQuotationDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

interface LineItem {
  description: string;
  quantity: string;
  rate: string;
  discountPct: string;
  taxPct: string;
  gstType: 'CGST_SGST' | 'IGST';
}

function CreateQuotationDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const createQ = useCreateQuotation();
  const { success, error } = useToast();
  const [form, setForm] = useState({ customerName: '', company: '', gstin: '', email: '', phone: '', terms: '', discount: '0', validityDays: '15' });
  const [items, setItems] = useState<LineItem[]>([
    { description: '', quantity: '1', rate: '', discountPct: '0', taxPct: '18', gstType: 'CGST_SGST' },
  ]);

  const totals = useMemo(() => {
    let subtotal = 0;
    let cgst = 0;
    let sgst = 0;
    let igst = 0;
    for (const it of items) {
      const qty = Number(it.quantity) || 0;
      const rate = Number(it.rate) || 0;
      const tax = Number(it.taxPct) || 0;
      const gross = qty * rate;
      const disc = (gross * (Number(it.discountPct) || 0)) / 100;
      const taxable = gross - disc;
      subtotal += taxable;
      const taxAmt = (taxable * tax) / 100;
      if (it.gstType === 'IGST') igst += taxAmt;
      else { cgst += taxAmt / 2; sgst += taxAmt / 2; }
    }
    const docDisc = Math.min(Number(form.discount) || 0, subtotal);
    return {
      subtotal: Math.round(subtotal * 100) / 100,
      cgst: Math.round(cgst * 100) / 100,
      sgst: Math.round(sgst * 100) / 100,
      igst: Math.round(igst * 100) / 100,
      discount: Math.round(docDisc * 100) / 100,
      total: Math.round((subtotal - docDisc + cgst + sgst + igst) * 100) / 100,
    };
  }, [items, form.discount]);

  const setItem = (i: number, patch: Partial<LineItem>) => {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validItems = items.filter((it) => it.description.trim() && Number(it.rate) > 0);
    if (!validItems.length) {
      error('Add at least one item', 'Give every item a description and a rate.');
      return;
    }
    try {
      const created = await createQ.mutateAsync({
        customerName: form.customerName,
        company: form.company || undefined,
        gstin: form.gstin || undefined,
        email: form.email || undefined,
        phone: form.phone || undefined,
        terms: form.terms || undefined,
        validityDays: Number(form.validityDays),
        discount: Number(form.discount) || 0,
        items: validItems.map((it) => ({
          description: it.description.trim(),
          quantity: Number(it.quantity) || 1,
          rate: Number(it.rate) || 0,
          discountPct: Number(it.discountPct) || 0,
          taxPct: Number(it.taxPct) || 0,
          gstType: it.gstType,
        })),
      });
      success(`${created.quotation.number} created`, `Total ${inr(created.quotation.total)}. Download the PDF and send it to ${form.customerName}.`);
      setForm({ customerName: '', company: '', gstin: '', email: '', phone: '', terms: '', discount: '0', validityDays: '15' });
      setItems([{ description: '', quantity: '1', rate: '', discountPct: '0', taxPct: '18', gstType: 'CGST_SGST' }]);
      onOpenChange(false);
    } catch (err) {
      error('Could not create quotation', friendlyError(err));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="New quotation" description="Add the customer and line items. GST and totals are calculated live.">
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="q-customer">Customer name *</Label>
              <Input id="q-customer" required value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} placeholder="Customer / business name" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="q-company">Company</Label>
              <Input id="q-company" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} placeholder="Company (optional)" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="q-gstin">GSTIN</Label>
              <Input id="q-gstin" value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value })} placeholder="27AAAAA0000A1Z5" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="q-email">Email</Label>
              <Input id="q-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="billing@example.com" />
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label>Line items</Label>
              <Button type="button" variant="ghost" size="sm" onClick={() => setItems((p) => [...p, { description: '', quantity: '1', rate: '', discountPct: '0', taxPct: '18', gstType: 'CGST_SGST' }])}>
                <Plus className="h-3.5 w-3.5" /> Add item
              </Button>
            </div>
            <div className="space-y-2">
              {items.map((it, i) => (
                <div key={i} className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/30 p-3 sm:grid-cols-12">
                  <Input
                    className="sm:col-span-4"
                    placeholder="Description *"
                    value={it.description}
                    onChange={(e) => setItem(i, { description: e.target.value })}
                  />
                  <Input className="sm:col-span-2" placeholder="Qty" inputMode="decimal" value={it.quantity} onChange={(e) => setItem(i, { quantity: e.target.value })} />
                  <Input className="sm:col-span-2" placeholder="Rate ₹" inputMode="decimal" value={it.rate} onChange={(e) => setItem(i, { rate: e.target.value })} />
                  <Input className="sm:col-span-2" placeholder="GST %" inputMode="decimal" value={it.taxPct} onChange={(e) => setItem(i, { taxPct: e.target.value })} />
                  <Select className="sm:col-span-2" value={it.gstType} onChange={(e) => setItem(i, { gstType: e.target.value as LineItem['gstType'] })}>
                    <option value="CGST_SGST">CGST+SGST</option>
                    <option value="IGST">IGST</option>
                  </Select>
                  {items.length > 1 && (
                    <button type="button" onClick={() => setItems((p) => p.filter((_, idx) => idx !== i))} className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" aria-label="Remove item">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="q-discount">Document discount ₹</Label>
              <Input id="q-discount" inputMode="decimal" value={form.discount} onChange={(e) => setForm({ ...form, discount: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="q-validity">Valid for (days)</Label>
              <Input id="q-validity" inputMode="numeric" value={form.validityDays} onChange={(e) => setForm({ ...form, validityDays: e.target.value })} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="q-terms">Terms</Label>
            <Textarea id="q-terms" value={form.terms} onChange={(e) => setForm({ ...form, terms: e.target.value })} placeholder="Payment terms, delivery, etc." />
          </div>

          <div className="rounded-lg border bg-muted/40 p-3 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{inr(totals.subtotal)}</span></div>
            {totals.discount > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span>- {inr(totals.discount)}</span></div>}
            {totals.cgst > 0 && <div className="flex justify-between"><span className="text-muted-foreground">CGST + SGST</span><span>{inr(totals.cgst + totals.sgst)}</span></div>}
            {totals.igst > 0 && <div className="flex justify-between"><span className="text-muted-foreground">IGST</span><span>{inr(totals.igst)}</span></div>}
            <div className="mt-1 flex justify-between border-t pt-1 font-bold"><span>Total</span><span>{inr(totals.total)}</span></div>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" loading={createQ.isPending}><FileText className="h-4 w-4" /> Create quotation</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

