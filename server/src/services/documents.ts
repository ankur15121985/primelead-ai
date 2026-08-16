/**
 * Shared document (quotation & invoice) service.
 * Numbering, serialization, GST totals and PDF generation.
 */
import { prisma } from '../lib/prisma';
import { calculateTax, type TaxItem } from './gst';
import { paiseToRupees } from '../lib/money';

// pdfkit ships without bundled types; it's a pure-JS streaming PDF builder.
const PDFDocument = require('pdfkit') as any;

/** Document prefixes and the Prisma model that owns each numbering sequence. */
const NUMBER_MODELS: Record<string, any> = {
  QT: () => prisma.quotation,
  INV: () => prisma.invoice,
  CN: () => prisma.creditNote,
  DN: () => prisma.debitNote,
};

/** Next sequential number for a document type: e.g. QT-2026-0042 / CN-2026-0003 */
export async function nextDocumentNumber(orgId: string, prefix: 'QT' | 'INV' | 'CN' | 'DN'): Promise<string> {
  const year = new Date().getFullYear();
  const model = NUMBER_MODELS[prefix]();
  const rows = await model.findMany({
    where: { orgId, number: { startsWith: `${prefix}-${year}-` } },
    select: { number: true },
  });
  let max = 0;
  for (const r of rows) {
    const n = Number(r.number.split('-').pop());
    if (!Number.isNaN(n) && n > max) max = n;
  }
  return `${prefix}-${year}-${String(max + 1).padStart(4, '0')}`;
}

/**
 * Compute the next number and run a create callback, retrying once if two
 * concurrent creates raced for the same number (unique constraint P2002).
 */
export async function withNextNumber<T>(orgId: string, prefix: 'QT' | 'INV' | 'CN' | 'DN', create: (number: string) => Promise<T>): Promise<T> {
  try {
    return await create(await nextDocumentNumber(orgId, prefix));
  } catch (err: any) {
    if (err?.code === 'P2002') {
      return create(await nextDocumentNumber(orgId, prefix));
    }
    throw err;
  }
}

/** Shared line serialization (paise → rupees) for every document type. */
function serializeItems(items: any[]) {
  return (items || []).map((it: any) => ({
    id: it.id,
    description: it.description,
    hsnSac: it.hsnSac || null,
    quantity: it.quantity,
    rate: paiseToRupees(it.rate),
    discountPct: it.discountPct,
    taxPct: it.taxPct,
    gstType: it.cgst || it.igst ? (it.igst > 0 ? 'IGST' : 'CGST_SGST') : 'CGST_SGST',
    cgst: paiseToRupees(it.cgst),
    sgst: paiseToRupees(it.sgst),
    igst: paiseToRupees(it.igst),
    amount: paiseToRupees(it.amount),
  }));
}

function gstSummaryOf(row: any) {
  const g = (row.gstSummary as any) || {};
  return { cgst: paiseToRupees(g.cgst), sgst: paiseToRupees(g.sgst), igst: paiseToRupees(g.igst) };
}

export function serializeCreditNote(row: any) {
  return {
    id: row.id,
    number: row.number,
    invoiceId: row.invoiceId,
    invoice: row.invoice ? { id: row.invoice.id, number: row.invoice.number } : null,
    leadId: row.leadId,
    lead: row.lead ? { id: row.lead.id, name: row.lead.name } : null,
    customerName: row.customerName,
    company: row.company,
    gstin: row.gstin,
    reason: row.reason,
    items: serializeItems(row.items),
    discount: paiseToRupees(row.discount),
    gstSummary: gstSummaryOf(row),
    subtotal: paiseToRupees(row.subtotal),
    total: paiseToRupees(row.total),
    status: row.status,
    issuedAt: row.issuedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function serializeDebitNote(row: any) {
  return {
    id: row.id,
    number: row.number,
    leadId: row.leadId,
    lead: row.lead ? { id: row.lead.id, name: row.lead.name } : null,
    customerName: row.customerName,
    company: row.company,
    gstin: row.gstin,
    reason: row.reason,
    items: serializeItems(row.items),
    discount: paiseToRupees(row.discount),
    gstSummary: gstSummaryOf(row),
    subtotal: paiseToRupees(row.subtotal),
    total: paiseToRupees(row.total),
    status: row.status,
    issuedAt: row.issuedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** Convert a Quotation row (with items) into a serializable DTO (rupees). */
export function serializeQuotation(row: any) {
  return {
    id: row.id,
    number: row.number,
    leadId: row.leadId,
    lead: row.lead ? { id: row.lead.id, name: row.lead.name } : null,
    customerName: row.customerName,
    company: row.company,
    address: row.address,
    gstin: row.gstin,
    phone: row.phone,
    email: row.email,
    items: serializeItems(row.items),
    discount: paiseToRupees(row.discount),
    gstSummary: gstSummaryOf(row),
    subtotal: paiseToRupees(row.subtotal),
    total: paiseToRupees(row.total),
    terms: row.terms,
    validityDays: row.validityDays,
    status: row.status,
    invoiceId: row.invoiceId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function serializeInvoice(row: any) {
  return {
    id: row.id,
    number: row.number,
    leadId: row.leadId,
    lead: row.lead ? { id: row.lead.id, name: row.lead.name } : null,
    quotationId: row.quotationId,
    customerName: row.customerName,
    company: row.company,
    billingAddress: row.billingAddress,
    gstin: row.gstin,
    items: serializeItems(row.items),
    discount: paiseToRupees(row.discount),
    gstSummary: gstSummaryOf(row),
    subtotal: paiseToRupees(row.subtotal),
    total: paiseToRupees(row.total),
    paidAmount: paiseToRupees(row.paidAmount),
    balanceDue: Math.max(0, paiseToRupees(row.total) - paiseToRupees(row.paidAmount)),
    status: row.status,
    dueDate: row.dueDate,
    terms: row.terms,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * Compute line amounts + document totals using the GST engine.
 * Inputs and outputs are INTEGER paise (rates and discount converted from
 * rupees by the route layer).
 */
export function computeDocumentTotals(items: Array<{ description: string; quantity: number; rate: number; discountPct?: number; taxPct?: number; gstType?: string }>, discount = 0) {
  const result = calculateTax(items as TaxItem[], discount);
  return {
    items: result.lines.map((l) => ({
      description: l.description,
      quantity: l.quantity,
      rate: l.rate,
      discountPct: l.discountPct,
      taxPct: l.taxPct,
      gstType: l.igst > 0 ? 'IGST' : 'CGST_SGST',
      cgst: l.cgst,
      sgst: l.sgst,
      igst: l.igst,
      amount: l.amount,
    })),
    gstSummary: { cgst: result.cgst, sgst: result.sgst, igst: result.igst },
    discount: result.discount,
    subtotal: result.subtotal,
    total: result.total,
  };
}

export function formatINR(n: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n);
}

/** PDF rendering receives paise — display as rupees. */
function money(paise: number): string {
  return formatINR(paiseToRupees(paise));
}

const KIND_META: Record<string, { title: string; accent: string }> = {
  QUOTATION: { title: 'QUOTATION', accent: '#4f46e5' },
  INVOICE: { title: 'TAX INVOICE', accent: '#059669' },
  CREDIT_NOTE: { title: 'CREDIT NOTE', accent: '#d97706' },
  DEBIT_NOTE: { title: 'DEBIT NOTE', accent: '#dc2626' },
};

/**
 * Generate a clean single-page PDF for a quotation, invoice, credit or debit
 * note. Buffers the document and returns it for download.
 */
export function renderDocumentPdf(opts: {
  kind: 'QUOTATION' | 'INVOICE' | 'CREDIT_NOTE' | 'DEBIT_NOTE';
  number: string;
  orgName: string;
  customerName: string;
  company?: string | null;
  address?: string | null;
  gstin?: string | null;
  referenceNumber?: string | null;
  items: Array<{ description: string; quantity: number; rate: number; taxPct: number; cgst: number; sgst: number; igst: number; amount: number }>;
  discount: number;
  gstSummary: { cgst: number; sgst: number; igst: number };
  subtotal: number;
  total: number;
  terms?: string | null;
  status: string;
  validityDays?: number;
  dueDate?: Date | null;
}): Promise<Buffer> {
  const chunks: Buffer[] = [];
  const doc: any = new PDFDocument({ size: 'A4', margin: 48 });
  doc.on('data', (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

  const meta = KIND_META[opts.kind];
  const title = meta.title;
  const accent = meta.accent;

  // Header band
  doc.rect(0, 0, 595.28, 8).fill(accent);
  doc.rect(48, 64, 499, 60).fill('#f8fafc').strokeColor('#e2e8f0').lineWidth(1).stroke();
  doc.fillColor('#0f172a').fontSize(22).text(opts.orgName, 62, 76);
  doc.fontSize(11).fillColor('#64748b').text(`GSTIN: ${opts.gstin || '—'}`, 62, 102);

  doc.fillColor(accent).fontSize(15).text(title, 400, 76);
  doc.fillColor('#0f172a').fontSize(11).text(`# ${opts.number}`, 400, 96);
  if (opts.referenceNumber) {
    doc.fillColor('#64748b').fontSize(9).text(`Against ${opts.referenceNumber}`, 400, 112);
    doc.fillColor('#64748b').fontSize(10).text(`Status: ${opts.status}`, 400, 124);
  } else {
    doc.fillColor('#64748b').fontSize(10).text(`Status: ${opts.status}`, 400, 112);
  }

  // Bill to
  doc.moveDown(2.4);
  doc.fontSize(9).fillColor('#94a3b8').text('BILL TO', 48, 148);
  doc.fontSize(12).fillColor('#0f172a').text(opts.customerName, 48, 162);
  doc.fontSize(10).fillColor('#334155');
  if (opts.company) doc.text(opts.company, 48, 178);
  if (opts.address) doc.text(opts.address, 48, 194);
  doc.text(
    opts.kind === 'INVOICE' && opts.dueDate
      ? `Due: ${opts.dueDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`
      : `Valid for ${opts.validityDays ?? 15} days`,
    48,
    194 + (opts.address ? 16 : 0) + (opts.company ? 16 : 0)
  );

  // Items table header
  let y = 260;
  doc.rect(48, y, 499, 22).fill(accent);
  doc.fontSize(9).fillColor('#ffffff');
  doc.text('DESCRIPTION', 56, y + 7);
  doc.text('QTY', 320, y + 7, { width: 40, align: 'right' });
  doc.text('RATE', 370, y + 7, { width: 60, align: 'right' });
  doc.text('GST', 430, y + 7, { width: 40, align: 'right' });
  doc.text('AMOUNT', 470, y + 7, { width: 70, align: 'right' });

  y += 22;
  doc.fontSize(9.5);
  opts.items.forEach((it, i) => {
    if (i % 2 === 0) doc.rect(48, y, 499, 20).fill('#f8fafc');
    doc.fillColor('#0f172a');
    doc.text(it.description.slice(0, 40), 56, y + 6, { width: 250 });
    doc.text(String(it.quantity), 320, y + 6, { width: 40, align: 'right' });
    doc.text(money(it.rate), 370, y + 6, { width: 60, align: 'right' });
    doc.text(`${it.taxPct}%`, 430, y + 6, { width: 40, align: 'right' });
    doc.text(money(it.amount), 470, y + 6, { width: 70, align: 'right' });
    y += 20;
  });

  // Totals
  y += 12;
  doc.fontSize(10).fillColor('#334155');
  doc.text('Subtotal', 400, y, { width: 140, align: 'right' });
  doc.text(money(opts.subtotal), 470, y + 14, { width: 70, align: 'right' });
  if (opts.discount > 0) {
    doc.text('Discount', 400, y + 28, { width: 140, align: 'right' });
    doc.text(`- ${money(opts.discount)}`, 470, y + 42, { width: 70, align: 'right' });
  }
  const g = opts.gstSummary;
  if (g.cgst) {
    doc.text(`CGST ${money(g.cgst)}`, 400, y + 28 + (opts.discount > 0 ? 28 : 0), { width: 140, align: 'right' });
  }
  if (g.sgst) {
    doc.text(`SGST ${money(g.sgst)}`, 400, y + 42 + (opts.discount > 0 ? 28 : 0), { width: 140, align: 'right' });
  }
  if (g.igst) {
    doc.text(`IGST ${money(g.igst)}`, 400, y + 42 + (opts.discount > 0 ? 28 : 0), { width: 140, align: 'right' });
  }
  const totalY = y + (opts.discount > 0 ? 70 : 42) + (g.cgst || g.igst ? 14 : 0);
  doc.rect(48, totalY - 6, 499, 26).fill(accent);
  doc.fillColor('#ffffff').fontSize(12).text('TOTAL', 56, totalY + 6);
  doc.text(money(opts.total), 470, totalY + 6, { width: 70, align: 'right' });

  // Terms
  if (opts.terms) {
    doc.fillColor('#94a3b8').fontSize(8).text('TERMS', 48, totalY + 44);
    doc.fillColor('#334155').fontSize(9).text(opts.terms, 48, totalY + 58, { width: 499 });
  }

  doc.end();
  return done;
}

/**
 * Payment receipt PDF — a clean summary of what was paid against an invoice.
 * Distinct from the tax invoice: it references the invoice and shows the
 * received amount, balance and date only.
 */
export function renderReceiptPdf(opts: {
  orgName: string;
  invoiceNumber: string;
  customerName: string;
  company?: string | null;
  amount: number; // paise
  total: number; // paise
  paidAt: Date;
  method?: string | null;
}): Promise<Buffer> {
  const chunks: Buffer[] = [];
  const doc: any = new PDFDocument({ size: 'A4', margin: 48 });
  doc.on('data', (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));
  const accent = '#0d9488';

  doc.rect(0, 0, 595.28, 8).fill(accent);
  doc.rect(48, 64, 499, 60).fill('#f8fafc').strokeColor('#e2e8f0').lineWidth(1).stroke();
  doc.fillColor('#0f172a').fontSize(22).text(opts.orgName, 62, 76);
  doc.fontSize(11).fillColor('#64748b').text('Payment receipt', 62, 102);
  doc.fillColor(accent).fontSize(15).text('PAYMENT RECEIPT', 360, 76);
  doc.fillColor('#0f172a').fontSize(11).text(`Received: ${money(opts.amount)}`, 360, 100);
  doc.fillColor('#64748b').fontSize(10).text(
    opts.paidAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
    360,
    116
  );

  doc.moveDown(2.4);
  doc.fontSize(9).fillColor('#94a3b8').text('RECEIVED FROM', 48, 148);
  doc.fontSize(12).fillColor('#0f172a').text(opts.customerName, 48, 162);
  if (opts.company) doc.fontSize(10).fillColor('#334155').text(opts.company, 48, 178);

  const boxY = 220;
  doc.rect(48, boxY, 499, 96).strokeColor('#e2e8f0').lineWidth(1).stroke();
  doc.fillColor('#64748b').fontSize(9).text('Invoice', 64, boxY + 14);
  doc.fillColor('#0f172a').fontSize(11).text(opts.invoiceNumber, 180, boxY + 12);
  doc.fillColor('#64748b').fontSize(9).text('Amount received', 64, boxY + 40);
  doc.fillColor('#0f172a').fontSize(13).text(money(opts.amount), 180, boxY + 38);
  doc.fillColor('#64748b').fontSize(9).text('Invoice total', 320, boxY + 14);
  doc.fillColor('#0f172a').fontSize(11).text(money(opts.total), 440, boxY + 12);
  const balance = Math.max(0, opts.total - opts.amount);
  doc.fillColor('#64748b').fontSize(9).text('Balance due', 320, boxY + 40);
  doc.fillColor(balance > 0 ? '#dc2626' : '#059669').fontSize(11).text(money(balance), 440, boxY + 38);
  if (opts.method) {
    doc.fillColor('#64748b').fontSize(9).text('Method', 64, boxY + 68);
    doc.fillColor('#334155').fontSize(10).text(opts.method, 180, boxY + 66);
  }

  doc.fillColor('#94a3b8').fontSize(8).text(
    'This receipt acknowledges the payment received against the invoice above. It is not a tax invoice.',
    48,
    360,
    { width: 499 }
  );

  doc.end();
  return done;
}
