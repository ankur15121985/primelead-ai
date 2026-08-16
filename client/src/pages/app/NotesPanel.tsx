import { useMemo, useState } from 'react';
import { FileMinus, FilePlus2, Plus, Search, Download, Trash2, Send, Ban } from 'lucide-react';
import { useNotes, useCreateNote, useUpdateNote, useInvoices, downloadNotePdf } from '@/hooks/queries';
import { useToast } from '@/hooks/use-toast';
import { friendlyError, useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { inr } from './Quotations';
import type { CreditNote, DebitNote } from '@/types';

const STATUS_META: Record<string, { label: string; tone: 'primary' | 'success' | 'muted' | 'danger' | 'info' | 'warning' }> = {
  DRAFT: { label: 'Draft', tone: 'muted' },
  ISSUED: { label: 'Issued', tone: 'success' },
  CANCELLED: { label: 'Cancelled', tone: 'danger' },
};

interface NoteItem {
  description: string;
  hsnSac: string;
  quantity: string;
  rate: string;
  taxPct: string;
  gstType: 'CGST_SGST' | 'IGST';
}

export function NotesPanel({ kind }: { kind: 'credit' | 'debit' }) {
  const { data, isLoading } = useNotes(kind);
  const updateNote = useUpdateNote(kind);
  const { user } = useAuth();
  const isManager = ['OWNER', 'ADMIN', 'MANAGER'].includes(user?.role || '');
  const { success, error } = useToast();
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  const notes = (data?.notes || []).filter((n) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return n.number.toLowerCase().includes(s) || n.customerName.toLowerCase().includes(s) || (n.company || '').toLowerCase().includes(s);
  });
  const counts = data?.counts;

  const issue = async (n: CreditNote | DebitNote) => {
    try {
      await updateNote.mutateAsync({ id: n.id, status: 'ISSUED' });
      success('Note issued', `${n.number} is now live.`);
    } catch (err) {
      error('Could not issue', friendlyError(err));
    }
  };

  const cancel = async (n: CreditNote | DebitNote) => {
    if (!window.confirm(`Cancel ${n.number}?`)) return;
    try {
      await updateNote.mutateAsync({ id: n.id, status: 'CANCELLED' });
      success('Note cancelled');
    } catch (err) {
      error('Could not cancel', friendlyError(err));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative sm:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder={`Search ${kind} notes…`} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Badge tone="success">{counts?.issued ?? 0} issued</Badge>
          <Badge tone="danger">{counts?.cancelled ?? 0} cancelled</Badge>
          <span className="font-semibold text-foreground">{inr(counts?.totalValue ?? 0)} outstanding</span>
        </div>
        <div className="ml-auto">
          <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> New {kind === 'credit' ? 'credit note' : 'debit note'}</Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
      ) : notes.length === 0 ? (
        <EmptyState
          icon={kind === 'credit' ? <FileMinus className="h-7 w-7" /> : <FilePlus2 className="h-7 w-7" />}
          title={`No ${kind} notes yet`}
          description={kind === 'credit'
            ? 'Issue a credit note against an invoice for returns, corrections or post-invoice discounts.'
            : 'Issue a debit note for additional charges or short payments after invoicing.'}
          action={<Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> Create {kind} note</Button>}
        />
      ) : (
        <Card className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {notes.map((n) => {
                const meta = STATUS_META[n.status] || STATUS_META.DRAFT;
                return (
                  <TableRow key={n.id}>
                    <TableCell className="font-medium">
                      {n.number}
                      {kind === 'credit' && (n as CreditNote).invoice && (
                        <p className="text-xs text-muted-foreground">against {(n as CreditNote).invoice!.number}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      <p className="font-medium">{n.customerName}</p>
                      {n.company && <p className="text-xs text-muted-foreground">{n.company}</p>}
                      {n.reason && <p className="text-xs text-muted-foreground italic">“{n.reason}”</p>}
                    </TableCell>
                    <TableCell><Badge tone={meta.tone}>{meta.label}</Badge></TableCell>
                    <TableCell className="text-right font-semibold">{inr(n.total)}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        {isManager && n.status === 'DRAFT' && (
                          <button
                            onClick={() => issue(n)}
                            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                            aria-label="Issue note"
                            title="Issue"
                          >
                            <Send className="h-4 w-4" />
                          </button>
                        )}
                        {isManager && n.status === 'ISSUED' && (
                          <button
                            onClick={() => cancel(n)}
                            className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            aria-label="Cancel note"
                            title="Cancel note"
                          >
                            <Ban className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={() => downloadNotePdf(kind, n.id).catch(() => error('Download failed', 'Please try again.'))}
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                          aria-label="Download PDF"
                          title="Download PDF"
                        >
                          <Download className="h-4 w-4" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      <CreateNoteDialog kind={kind} open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

function CreateNoteDialog({ kind, open, onOpenChange }: { kind: 'credit' | 'debit'; open: boolean; onOpenChange: (v: boolean) => void }) {
  const create = useCreateNote(kind);
  const { data: invoices } = useInvoices();
  const { success, error } = useToast();
  const [form, setForm] = useState({
    customerName: '', company: '', gstin: '', reason: '', discount: '0', invoiceId: '',
  });
  const [items, setItems] = useState<NoteItem[]>([{ description: '', hsnSac: '', quantity: '1', rate: '', taxPct: '18', gstType: 'CGST_SGST' }]);

  const totals = useMemo(() => {
    let subtotal = 0, cgst = 0, sgst = 0, igst = 0;
    for (const it of items) {
      const qty = Number(it.quantity) || 0;
      const rate = Number(it.rate) || 0;
      const tax = Number(it.taxPct) || 0;
      const taxable = qty * rate;
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

  const setItem = (i: number, patch: Partial<NoteItem>) => {
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
      const res = await create.mutateAsync({
        ...(kind === 'credit' ? { invoiceId: form.invoiceId || undefined } : {}),
        customerName: form.customerName,
        company: form.company || undefined,
        gstin: form.gstin || undefined,
        reason: form.reason || undefined,
        discount: Number(form.discount) || 0,
        items: validItems.map((it) => ({
          description: it.description.trim(),
          hsnSac: it.hsnSac || undefined,
          quantity: Number(it.quantity) || 1,
          rate: Number(it.rate) || 0,
          taxPct: Number(it.taxPct) || 0,
          gstType: it.gstType,
        })),
      });
      success(`${kind === 'credit' ? 'Credit' : 'Debit'} note created`, `${res.note.number} · ${inr(res.note.total)}`);
      setForm({ customerName: '', company: '', gstin: '', reason: '', discount: '0', invoiceId: '' });
      setItems([{ description: '', hsnSac: '', quantity: '1', rate: '', taxPct: '18', gstType: 'CGST_SGST' }]);
      onOpenChange(false);
    } catch (err) {
      error('Could not create note', friendlyError(err));
    }
  };

  const selectInvoice = (invoiceId: string) => {
    const inv = (invoices?.invoices || []).find((i) => i.id === invoiceId);
    setForm((f) => ({
      ...f,
      invoiceId,
      customerName: inv ? inv.customerName : f.customerName,
      company: inv ? inv.company || '' : f.company,
      gstin: inv ? inv.gstin || '' : f.gstin,
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={kind === 'credit' ? 'New credit note' : 'New debit note'}
        description={kind === 'credit'
          ? 'Reduce the amount a customer owes — for returns, corrections or post-invoice discounts.'
          : 'Charge a customer extra — for short payments, additional work or corrections.'}
      >
        <form onSubmit={submit} className="space-y-4">
          {kind === 'credit' && (
            <div className="space-y-1.5">
              <Label htmlFor="note-invoice">Against invoice (optional)</Label>
              <Select id="note-invoice" value={form.invoiceId} onChange={(e) => selectInvoice(e.target.value)}>
                <option value="">No reference</option>
                {(invoices?.invoices || []).map((i) => (
                  <option key={i.id} value={i.id}>{i.number} — {i.customerName} ({inr(i.total)})</option>
                ))}
              </Select>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="note-customer">Customer name *</Label>
              <Input id="note-customer" required value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="note-company">Company</Label>
              <Input id="note-company" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="note-gstin">GSTIN</Label>
              <Input id="note-gstin" value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value })} placeholder="27AAAAA0000A1Z5" />
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label>Line items</Label>
              <Button type="button" variant="ghost" size="sm" onClick={() => setItems((p) => [...p, { description: '', hsnSac: '', quantity: '1', rate: '', taxPct: '18', gstType: 'CGST_SGST' }])}>
                <Plus className="h-3.5 w-3.5" /> Add item
              </Button>
            </div>
            <div className="space-y-2">
              {items.map((it, i) => (
                <div key={i} className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/30 p-3 sm:grid-cols-12">
                  <Input className="sm:col-span-3" placeholder="Description *" value={it.description} onChange={(e) => setItem(i, { description: e.target.value })} />
                  <Input className="sm:col-span-2" placeholder="HSN/SAC" value={it.hsnSac} onChange={(e) => setItem(i, { hsnSac: e.target.value })} />
                  <Input className="sm:col-span-2" placeholder="Qty" inputMode="decimal" value={it.quantity} onChange={(e) => setItem(i, { quantity: e.target.value })} />
                  <Input className="sm:col-span-2" placeholder="Rate ₹" inputMode="decimal" value={it.rate} onChange={(e) => setItem(i, { rate: e.target.value })} />
                  <Input className="sm:col-span-1" placeholder="GST%" inputMode="decimal" value={it.taxPct} onChange={(e) => setItem(i, { taxPct: e.target.value })} />
                  <Select className="sm:col-span-2" value={it.gstType} onChange={(e) => setItem(i, { gstType: e.target.value as NoteItem['gstType'] })}>
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

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="note-discount">Document discount ₹</Label>
              <Input id="note-discount" inputMode="decimal" value={form.discount} onChange={(e) => setForm({ ...form, discount: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="note-reason">Reason</Label>
              <Input id="note-reason" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="e.g. Return of services, rate correction" />
            </div>
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
            <Button type="submit" loading={create.isPending}><Send className="h-4 w-4" /> Create note</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
