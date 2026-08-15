import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Receipt, IndianRupee, CheckCircle2 } from 'lucide-react';
import { useInvoice, useRecordInvoicePayment, useUpdateInvoice, downloadInvoicePdf } from '@/hooks/queries';
import { useToast } from '@/hooks/use-toast';
import { friendlyError } from '@/hooks/use-auth';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { inr } from './Quotations';

const STATUS_META: Record<string, { label: string; tone: 'primary' | 'success' | 'muted' | 'danger' | 'info' | 'warning' }> = {
  DRAFT: { label: 'Draft', tone: 'muted' },
  SENT: { label: 'Sent', tone: 'info' },
  PARTIALLY_PAID: { label: 'Partially paid', tone: 'warning' },
  PAID: { label: 'Paid', tone: 'success' },
  OVERDUE: { label: 'Overdue', tone: 'danger' },
  CANCELLED: { label: 'Cancelled', tone: 'muted' },
};

export function InvoiceDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { data, isLoading } = useInvoice(id);
  const recordPay = useRecordInvoicePayment();
  const updateI = useUpdateInvoice();
  const { success, error } = useToast();
  const [payOpen, setPayOpen] = useState(false);
  const [amount, setAmount] = useState('');

  const invoice = data?.invoice;
  const meta = STATUS_META[invoice?.status || 'DRAFT'] || STATUS_META.DRAFT;

  const submitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await recordPay.mutateAsync({ id, paidAmount: Number(amount) || 0 });
      success('Payment recorded', `${inr(Number(amount) || 0)} received.`);
      setAmount('');
      setPayOpen(false);
    } catch (err) {
      error('Could not record payment', friendlyError(err));
    }
  };

  const markPaid = async () => {
    try {
      await updateI.mutateAsync({ id, status: 'PAID' });
      success('Marked as paid 🎉');
    } catch (err) {
      error('Could not update', friendlyError(err));
    }
  };

  if (isLoading) return <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>;
  if (!invoice) return <p className="text-sm text-muted-foreground">Invoice not found.</p>;

  const g = invoice.gstSummary || { cgst: 0, sgst: 0, igst: 0 };
  const payPct = invoice.total > 0 ? Math.round((invoice.paidAmount / invoice.total) * 100) : 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={() => navigate('/app/invoices')} className="rounded-lg border p-2 text-muted-foreground hover:bg-accent" aria-label="Back">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
            <Receipt className="h-5 w-5 text-primary" /> {invoice.number} <Badge tone={meta.tone}>{meta.label}</Badge>
          </h1>
          <p className="text-sm text-muted-foreground">Created {new Date(invoice.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
            {invoice.dueDate && <> · Due {new Date(invoice.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {invoice.balanceDue > 0 && invoice.status !== 'CANCELLED' && (
            <Button onClick={() => { setAmount(String(invoice.balanceDue)); setPayOpen(true); }}>
              <IndianRupee className="h-4 w-4" /> Record payment
            </Button>
          )}
          {invoice.status === 'SENT' && invoice.balanceDue > 0 && (
            <Button variant="success" onClick={markPaid}><CheckCircle2 className="h-4 w-4" /> Mark paid</Button>
          )}
          <Button variant="outline" onClick={() => downloadInvoicePdf(id).catch(() => error('Download failed', 'Please try again.'))}>
            <Download className="h-4 w-4" /> Download PDF
          </Button>
        </div>
      </div>

      {/* Payment progress */}
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Payment progress</p>
            <p className="text-xs text-muted-foreground">{inr(invoice.paidAmount)} of {inr(invoice.total)} received</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold">{payPct}%</p>
            <p className="text-xs text-muted-foreground">{inr(invoice.balanceDue)} balance due</p>
          </div>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-success transition-all" style={{ width: `${payPct}%` }} />
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Bill to</p>
              <p className="mt-1 text-lg font-semibold">{invoice.customerName}</p>
              {invoice.company && <p className="text-sm text-muted-foreground">{invoice.company}</p>}
              {invoice.billingAddress && <p className="text-sm text-muted-foreground">{invoice.billingAddress}</p>}
              {invoice.gstin && <p className="mt-1 text-xs text-muted-foreground">GSTIN: {invoice.gstin}</p>}
            </div>
            {invoice.lead && (
              <button onClick={() => navigate(`/app/leads/${invoice.leadId}`)} className="rounded-lg border bg-muted/40 px-3 py-2 text-left text-xs transition-colors hover:bg-accent">
                <span className="block text-muted-foreground">Linked lead</span>
                <span className="font-semibold">{invoice.lead.name}</span>
              </button>
            )}
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Description</TableHead>
                <TableHead>HSN/SAC</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Rate</TableHead>
                <TableHead className="text-right">GST</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoice.items.map((it) => (
                <TableRow key={it.id || it.description}>
                  <TableCell className="font-medium">{it.description}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{it.hsnSac || '—'}</TableCell>
                  <TableCell className="text-right">{it.quantity}</TableCell>
                  <TableCell className="text-right">{inr(it.rate)}</TableCell>
                  <TableCell className="text-right">{it.taxPct}%{it.igst > 0 ? ' (IGST)' : ''}</TableCell>
                  <TableCell className="text-right font-semibold">{inr(it.amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="mt-4 space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{inr(invoice.subtotal)}</span></div>
            {invoice.discount > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span>- {inr(invoice.discount)}</span></div>}
            {g.cgst > 0 && <div className="flex justify-between"><span className="text-muted-foreground">CGST</span><span>{inr(g.cgst)}</span></div>}
            {g.sgst > 0 && <div className="flex justify-between"><span className="text-muted-foreground">SGST</span><span>{inr(g.sgst)}</span></div>}
            {g.igst > 0 && <div className="flex justify-between"><span className="text-muted-foreground">IGST</span><span>{inr(g.igst)}</span></div>}
            <div className="flex justify-between border-t pt-2 text-base font-bold"><span>Total</span><span>{inr(invoice.total)}</span></div>
            <div className="flex justify-between text-success"><span>Paid</span><span>- {inr(invoice.paidAmount)}</span></div>
            <div className="flex justify-between font-bold"><span>Balance due</span><span>{inr(invoice.balanceDue)}</span></div>
          </div>

          {invoice.terms && (
            <div className="mt-4 rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
              <p className="font-semibold uppercase tracking-wide">Terms</p>
              <p className="mt-1 whitespace-pre-wrap">{invoice.terms}</p>
            </div>
          )}
        </Card>

        <Card className="h-fit p-5">
          <p className="text-sm font-semibold">Payment history</p>
          {invoice.paidAmount > 0 ? (
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between rounded-lg border bg-success/5 p-3 text-sm">
                <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-success" /> Received</span>
                <span className="font-semibold">{inr(invoice.paidAmount)}</span>
              </div>
            </div>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">No payments recorded yet.</p>
          )}
          {invoice.balanceDue > 0 && invoice.status !== 'CANCELLED' && (
            <Button className="mt-4 w-full" onClick={() => { setAmount(String(invoice.balanceDue)); setPayOpen(true); }}>
              <IndianRupee className="h-4 w-4" /> Record payment
            </Button>
          )}
        </Card>
      </div>

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent title={`Record payment — ${invoice.number}`} description={`Balance due: ${inr(invoice.balanceDue)}`}>
          <form onSubmit={submitPayment} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="pd-amount">Amount received ₹</Label>
              <Input id="pd-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setPayOpen(false)}>Cancel</Button>
              <Button type="submit" loading={recordPay.isPending}><IndianRupee className="h-4 w-4" /> Record payment</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
