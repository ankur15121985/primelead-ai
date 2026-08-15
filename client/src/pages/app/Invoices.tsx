import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Receipt, Plus, Search, Download, Trash2, IndianRupee, CheckCircle2 } from 'lucide-react';
import { useInvoices, useCreateInvoice, useUpdateInvoice, useDeleteInvoice, useRecordInvoicePayment, downloadInvoicePdf } from '@/hooks/queries';
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
import type { Invoice } from '@/types';
import { inr } from './Quotations';

const STATUS_META: Record<string, { label: string; tone: 'primary' | 'success' | 'muted' | 'danger' | 'info' | 'warning' }> = {
  DRAFT: { label: 'Draft', tone: 'muted' },
  SENT: { label: 'Sent', tone: 'info' },
  PARTIALLY_PAID: { label: 'Partially paid', tone: 'warning' },
  PAID: { label: 'Paid', tone: 'success' },
  OVERDUE: { label: 'Overdue', tone: 'danger' },
  CANCELLED: { label: 'Cancelled', tone: 'muted' },
};

export function Invoices() {
  const [status, setStatus] = useState('ALL');
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [payFor, setPayFor] = useState<Invoice | null>(null);
  const { data, isLoading } = useInvoices({ status, search });
  const { user } = useAuth();
  const isManager = ['OWNER', 'ADMIN', 'MANAGER'].includes(user?.role || '');
  const { success, error } = useToast();
  const navigate = useNavigate();
  const updateI = useUpdateInvoice();
  const deleteI = useDeleteInvoice();

  const invoices = data?.invoices || [];
  const counts = data?.counts || {};

  const markPaid = async (inv: Invoice) => {
    try {
      await updateI.mutateAsync({ id: inv.id, status: 'PAID' });
      success(`${inv.number} marked paid 🎉`);
    } catch (err) {
      error('Could not update', friendlyError(err));
    }
  };

  const remove = async (inv: Invoice) => {
    if (!window.confirm(`Delete ${inv.number}? This cannot be undone.`)) return;
    try {
      await deleteI.mutateAsync(inv.id);
      success('Deleted', `${inv.number} was removed.`);
    } catch (err) {
      error('Could not delete', friendlyError(err));
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Invoices"
        description="Bill your customers with GST-ready invoices, track payments, and download professional PDFs."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> New invoice
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
          <option value="PARTIALLY_PAID">Partially paid</option>
          <option value="PAID">Paid</option>
          <option value="OVERDUE">Overdue</option>
        </Select>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Badge tone="muted">{counts.total ?? invoices.length} total</Badge>
          <Badge tone="success">{counts.paid ?? 0} paid</Badge>
          <Badge tone="warning">{counts.pending ?? 0} pending</Badge>
          <Badge tone="danger">{counts.overdue ?? 0} overdue</Badge>
          <span className="font-semibold text-foreground">{inr(counts.totalValue ?? 0)} billed</span>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
      ) : invoices.length === 0 ? (
        <EmptyState
          icon={<Receipt className="h-7 w-7" />}
          title="No invoices yet"
          description="Create an invoice for a customer, or convert an accepted quotation in one click."
          action={<Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> Create invoice</Button>}
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
                <TableHead className="text-right">Paid</TableHead>
                <TableHead>Due</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((inv) => {
                const meta = STATUS_META[inv.status] || STATUS_META.DRAFT;
                const overdue = inv.status === 'OVERDUE' || (inv.dueDate && inv.balanceDue > 0 && new Date(inv.dueDate) < new Date());
                return (
                  <TableRow key={inv.id} className="cursor-pointer" onClick={() => navigate(`/app/invoices/${inv.id}`)}>
                    <TableCell className="font-medium">{inv.number}</TableCell>
                    <TableCell>
                      <p className="font-medium">{inv.customerName}</p>
                      {inv.company && <p className="text-xs text-muted-foreground">{inv.company}</p>}
                    </TableCell>
                    <TableCell><Badge tone={overdue && inv.status !== 'PAID' && inv.status !== 'CANCELLED' ? 'danger' : meta.tone}>{meta.label}</Badge></TableCell>
                    <TableCell className="text-right font-semibold">{inr(inv.total)}</TableCell>
                    <TableCell className="text-right text-success">{inr(inv.paidAmount)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        {isManager && inv.balanceDue > 0 && inv.status !== 'CANCELLED' && (
                          <button onClick={() => setPayFor(inv)} className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Record payment" title="Record payment">
                            <IndianRupee className="h-4 w-4" />
                          </button>
                        )}
                        {isManager && inv.status === 'SENT' && inv.balanceDue > 0 && (
                          <button onClick={() => markPaid(inv)} className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Mark paid" title="Mark fully paid">
                            <CheckCircle2 className="h-4 w-4 text-success" />
                          </button>
                        )}
                        <button onClick={() => downloadInvoicePdf(inv.id).catch(() => error('Download failed', 'Please try again.'))} className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Download PDF" title="Download PDF">
                          <Download className="h-4 w-4" />
                        </button>
                        {isManager && (
                          <button onClick={() => remove(inv)} className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" aria-label="Delete" title="Delete">
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

      <CreateInvoiceDialog open={createOpen} onOpenChange={setCreateOpen} />
      {payFor && <PaymentDialog invoice={payFor} onClose={() => setPayFor(null)} />}
    </div>
  );
}

interface LineItem {
  description: string;
  hsnSac: string;
  quantity: string;
  rate: string;
  taxPct: string;
  gstType: 'CGST_SGST' | 'IGST';
}

function CreateInvoiceDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const createI = useCreateInvoice();
  const { success, error } = useToast();
  const [form, setForm] = useState({ customerName: '', company: '', billingAddress: '', gstin: '', terms: '', discount: '0', dueDate: '' });
  const [items, setItems] = useState<LineItem[]>([
    { description: '', hsnSac: '', quantity: '1', rate: '', taxPct: '18', gstType: 'CGST_SGST' },
  ]);

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
      const created = await createI.mutateAsync({
        customerName: form.customerName,
        company: form.company || undefined,
        billingAddress: form.billingAddress || undefined,
        gstin: form.gstin || undefined,
        terms: form.terms || undefined,
        dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : undefined,
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
      success(`${created.invoice.number} created`, `Total ${inr(created.invoice.total)}.`);
      setForm({ customerName: '', company: '', billingAddress: '', gstin: '', terms: '', discount: '0', dueDate: '' });
      setItems([{ description: '', hsnSac: '', quantity: '1', rate: '', taxPct: '18', gstType: 'CGST_SGST' }]);
      onOpenChange(false);
    } catch (err) {
      error('Could not create invoice', friendlyError(err));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="New invoice" description="Add the customer and line items. GST (CGST/SGST/IGST) is calculated automatically.">
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="i-customer">Customer name *</Label>
              <Input id="i-customer" required value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} placeholder="Customer / business name" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="i-company">Company</Label>
              <Input id="i-company" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} placeholder="Company (optional)" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="i-gstin">GSTIN</Label>
              <Input id="i-gstin" value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value })} placeholder="27AAAAA0000A1Z5" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="i-due">Due date</Label>
              <Input id="i-due" type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="i-address">Billing address</Label>
            <Textarea id="i-address" value={form.billingAddress} onChange={(e) => setForm({ ...form, billingAddress: e.target.value })} placeholder="Street, city, state, PIN" />
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

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="i-discount">Document discount ₹</Label>
              <Input id="i-discount" inputMode="decimal" value={form.discount} onChange={(e) => setForm({ ...form, discount: e.target.value })} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="i-terms">Terms</Label>
            <Textarea id="i-terms" value={form.terms} onChange={(e) => setForm({ ...form, terms: e.target.value })} placeholder="Payment terms, bank details, etc." />
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
            <Button type="submit" loading={createI.isPending}><Receipt className="h-4 w-4" /> Create invoice</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PaymentDialog({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  const pay = useRecordInvoicePayment();
  const { success, error } = useToast();
  const [amount, setAmount] = useState(String(invoice.balanceDue));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await pay.mutateAsync({ id: invoice.id, paidAmount: Number(amount) || 0 });
      success('Payment recorded', `${inr(Number(amount) || 0)} received on ${invoice.number}.`);
      onClose();
    } catch (err) {
      error('Could not record payment', friendlyError(err));
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent title={`Record payment — ${invoice.number}`} description={`Balance due: ${inr(invoice.balanceDue)}`}>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="pay-amount">Amount received ₹</Label>
            <Input id="pay-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={pay.isPending}><IndianRupee className="h-4 w-4" /> Record payment</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
