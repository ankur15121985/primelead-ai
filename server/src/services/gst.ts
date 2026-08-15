/**
 * GST calculation engine for quotations & invoices.
 *
 * Supports CGST+SGST (intra-state) and IGST (inter-state) at per-item level.
 * Rules:
 *   - Each item: taxable = qty × rate − (qty × rate × discountPct/100)
 *   - tax = taxable × taxPct/100, split cgst = sgst = tax/2 (intra-state)
 *   - document total = Σ items − document-level discount
 */
export interface TaxItem {
  description: string;
  quantity: number;
  rate: number;
  discountPct?: number;
  taxPct?: number;
  gstType?: 'CGST_SGST' | 'IGST';
}

export interface TaxLine {
  description: string;
  quantity: number;
  rate: number;
  discountPct: number;
  taxPct: number;
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  amount: number;
}

export interface TaxResult {
  lines: TaxLine[];
  subtotal: number;
  discount: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function calculateTax(items: TaxItem[], documentDiscount = 0): TaxResult {
  const lines: TaxLine[] = items.map((it) => {
    const qty = it.quantity || 0;
    const rate = it.rate || 0;
    const discountPct = it.discountPct || 0;
    const taxPct = it.taxPct || 0;
    const gross = qty * rate;
    const discountAmt = round2((gross * discountPct) / 100);
    const taxable = round2(gross - discountAmt);
    const taxAmt = round2((taxable * taxPct) / 100);
    const isIgst = it.gstType === 'IGST';
    const igst = isIgst ? taxAmt : 0;
    const cgst = isIgst ? 0 : round2(taxAmt / 2);
    const sgst = isIgst ? 0 : round2(taxAmt - cgst);
    return {
      description: it.description,
      quantity: qty,
      rate,
      discountPct,
      taxPct,
      taxable,
      cgst,
      sgst,
      igst,
      amount: round2(taxable + taxAmt),
    };
  });

  const subtotal = round2(lines.reduce((s, l) => s + l.taxable, 0));
  const discount = round2(Math.min(documentDiscount || 0, subtotal));
  const cgst = round2(lines.reduce((s, l) => s + l.cgst, 0));
  const sgst = round2(lines.reduce((s, l) => s + l.sgst, 0));
  const igst = round2(lines.reduce((s, l) => s + l.igst, 0));
  const total = round2(subtotal - discount + cgst + sgst + igst);

  return { lines, subtotal, discount, cgst, sgst, igst, total };
}
