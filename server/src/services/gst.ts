/**
 * GST calculation engine for quotations & invoices.
 *
 * Works entirely in INTEGER paise (₹×100). The API boundary converts
 * rupees → paise before calling in, and paise → rupees on the way out.
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
  rate: number; // paise
  discountPct?: number;
  taxPct?: number;
  gstType?: 'CGST_SGST' | 'IGST';
}

export interface TaxLine {
  description: string;
  quantity: number;
  rate: number; // paise
  discountPct: number;
  taxPct: number;
  taxable: number; // paise
  cgst: number; // paise
  sgst: number; // paise
  igst: number; // paise
  amount: number; // paise
}

export interface TaxResult {
  lines: TaxLine[];
  subtotal: number; // paise
  discount: number; // paise
  cgst: number; // paise
  sgst: number; // paise
  igst: number; // paise
  total: number; // paise
}

export function calculateTax(items: TaxItem[], documentDiscount = 0): TaxResult {
  const lines: TaxLine[] = items.map((it) => {
    const qty = it.quantity || 0;
    const rate = it.rate || 0; // paise
    const discountPct = it.discountPct || 0;
    const taxPct = it.taxPct || 0;
    const gross = qty * rate; // may be fractional paise when quantity is fractional
    const discountAmt = Math.round((gross * discountPct) / 100);
    const taxable = Math.round(gross - discountAmt);
    const taxAmt = Math.round((taxable * taxPct) / 100);
    const isIgst = it.gstType === 'IGST';
    const igst = isIgst ? taxAmt : 0;
    const cgst = isIgst ? 0 : Math.round(taxAmt / 2);
    const sgst = isIgst ? 0 : taxAmt - cgst;
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
      amount: taxable + taxAmt,
    };
  });

  const subtotal = lines.reduce((s, l) => s + l.taxable, 0);
  const discount = Math.min(Math.round(documentDiscount || 0), subtotal);
  const cgst = lines.reduce((s, l) => s + l.cgst, 0);
  const sgst = lines.reduce((s, l) => s + l.sgst, 0);
  const igst = lines.reduce((s, l) => s + l.igst, 0);
  const total = subtotal - discount + cgst + sgst + igst;

  return { lines, subtotal, discount, cgst, sgst, igst, total };
}
