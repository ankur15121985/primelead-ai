import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, ArrowRightCircle, FileText, CheckCircle2, Send } from 'lucide-react';
import { useQuotation, useUpdateQuotation, useConvertQuotation, downloadQuotationPdf } from '@/hooks/queries';
import { useToast } from '@/hooks/use-toast';
import { friendlyError } from '@/hooks/use-auth';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { inr } from './Quotations';

const STATUS_META: Record<string, { label: string; tone: 'primary' | 'success' | 'muted' | 'danger' | 'info' | 'warning' }> = {
  DRAFT: { label: 'Draft', tone: 'muted' },
  SENT: { label: 'Sent', tone: 'info' },
  ACCEPTED: { label: 'Accepted', tone: 'success' },
  REJECTED: { label: 'Rejected', tone: 'danger' },
  EXPIRED: { label: 'Expired', tone: 'warning' },
  CONVERTED: { label: 'Converted', tone: 'primary' },
};

export function QuotationDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { data, isLoading } = useQuotation(id);
  const updateQ = useUpdateQuotation();
  const convertQ = useConvertQuotation();
  const { success, error } = useToast();

  const quotation = data?.quotation;
  const meta = STATUS_META[quotation?.status || 'DRAFT'] || STATUS_META.DRAFT;

  const act = async (fn: () => Promise<unknown>, okMsg: string) => {
    try {
      await fn();
      success(okMsg);
    } catch (err) {
      error('Could not update', friendlyError(err));
    }
  };

  if (isLoading) return <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>;
  if (!quotation) return <p className="text-sm text-muted-foreground">Quotation not found.</p>;

  const g = quotation.gstSummary || { cgst: 0, sgst: 0, igst: 0 };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={() => navigate('/app/quotations')} className="rounded-lg border p-2 text-muted-foreground hover:bg-accent" aria-label="Back">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
            <FileText className="h-5 w-5 text-primary" /> {quotation.number} <Badge tone={meta.tone}>{meta.label}</Badge>
          </h1>
          <p className="text-sm text-muted-foreground">Created {new Date(quotation.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })} · Valid {quotation.validityDays} days</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {quotation.status === 'DRAFT' && (
            <Button variant="secondary" onClick={() => act(() => updateQ.mutateAsync({ id, status: 'SENT' }), 'Marked as sent')}>
              <Send className="h-4 w-4" /> Mark sent
            </Button>
          )}
          {quotation.status === 'SENT' && (
            <Button variant="success" onClick={() => act(() => updateQ.mutateAsync({ id, status: 'ACCEPTED' }), 'Marked accepted 🎉')}>
              <CheckCircle2 className="h-4 w-4" /> Mark accepted
            </Button>
          )}
          {quotation.status === 'ACCEPTED' && (
            <Button loading={convertQ.isPending} onClick={() => act(() => convertQ.mutateAsync(id).then(() => navigate('/app/invoices')), 'Converted to invoice')}>
              <ArrowRightCircle className="h-4 w-4" /> Convert to invoice
            </Button>
          )}
          <Button variant="outline" onClick={() => downloadQuotationPdf(id).catch(() => error('Download failed', 'Please try again.'))}>
            <Download className="h-4 w-4" /> Download PDF
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Bill to</p>
              <p className="mt-1 text-lg font-semibold">{quotation.customerName}</p>
              {quotation.company && <p className="text-sm text-muted-foreground">{quotation.company}</p>}
              {quotation.address && <p className="text-sm text-muted-foreground">{quotation.address}</p>}
              {quotation.gstin && <p className="mt-1 text-xs text-muted-foreground">GSTIN: {quotation.gstin}</p>}
              {(quotation.email || quotation.phone) && (
                <p className="mt-1 text-xs text-muted-foreground">{quotation.email}{quotation.email && quotation.phone ? ' · ' : ''}{quotation.phone}</p>
              )}
            </div>
            {quotation.lead && (
              <button onClick={() => navigate(`/app/leads/${quotation.leadId}`)} className="rounded-lg border bg-muted/40 px-3 py-2 text-left text-xs transition-colors hover:bg-accent">
                <span className="block text-muted-foreground">Linked lead</span>
                <span className="font-semibold">{quotation.lead.name}</span>
              </button>
            )}
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Rate</TableHead>
                <TableHead className="text-right">GST</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quotation.items.map((it) => (
                <TableRow key={it.id || it.description}>
                  <TableCell className="font-medium">{it.description}</TableCell>
                  <TableCell className="text-right">{it.quantity}</TableCell>
                  <TableCell className="text-right">{inr(it.rate)}</TableCell>
                  <TableCell className="text-right">{it.taxPct}%{it.igst > 0 ? ' (IGST)' : ''}</TableCell>
                  <TableCell className="text-right font-semibold">{inr(it.amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="mt-4 space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{inr(quotation.subtotal)}</span></div>
            {quotation.discount > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span>- {inr(quotation.discount)}</span></div>}
            {g.cgst > 0 && <div className="flex justify-between"><span className="text-muted-foreground">CGST</span><span>{inr(g.cgst)}</span></div>}
            {g.sgst > 0 && <div className="flex justify-between"><span className="text-muted-foreground">SGST</span><span>{inr(g.sgst)}</span></div>}
            {g.igst > 0 && <div className="flex justify-between"><span className="text-muted-foreground">IGST</span><span>{inr(g.igst)}</span></div>}
            <div className="flex justify-between border-t pt-2 text-base font-bold"><span>Total</span><span>{inr(quotation.total)}</span></div>
          </div>

          {quotation.terms && (
            <div className="mt-4 rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
              <p className="font-semibold uppercase tracking-wide">Terms</p>
              <p className="mt-1 whitespace-pre-wrap">{quotation.terms}</p>
            </div>
          )}
        </Card>

        <Card className="h-fit p-5">
          <p className="text-sm font-semibold">Next step</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {quotation.status === 'DRAFT' && 'Send this quotation to your customer, then mark it sent.'}
            {quotation.status === 'SENT' && 'Once the customer agrees, mark the quotation as accepted.'}
            {quotation.status === 'ACCEPTED' && 'Great — convert it to an invoice to start billing.'}
            {quotation.status === 'CONVERTED' && 'This quotation has been converted to an invoice. View it in Invoices.'}
            {(quotation.status === 'REJECTED' || quotation.status === 'EXPIRED') && 'This quotation is closed. Create a new one if the customer is back in touch.'}
          </p>
          {quotation.invoiceId && (
            <Button variant="outline" className="mt-3 w-full" onClick={() => navigate(`/app/invoices/${quotation.invoiceId}`)}>
              View invoice
            </Button>
          )}
        </Card>
      </div>
    </div>
  );
}
