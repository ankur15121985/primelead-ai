import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { calculateTax } from './gst';
import { computeLeadScore } from '../constants';

// The GST engine works in INTEGER paise (₹×100); the API boundary converts
// rupees → paise on input and paise → rupees on output.
describe('GST calculation', () => {
  it('computes CGST+SGST split correctly for intra-state 18%', () => {
    const r = calculateTax([{ description: 'Item', quantity: 2, rate: 100000, taxPct: 18 }]); // ₹1,000
    expect(r.subtotal).toBe(200000);
    expect(r.cgst).toBe(18000);
    expect(r.sgst).toBe(18000);
    expect(r.igst).toBe(0);
    expect(r.total).toBe(236000);
  });

  it('computes IGST for inter-state', () => {
    const r = calculateTax([{ description: 'Item', quantity: 1, rate: 500000, taxPct: 18, gstType: 'IGST' }]);
    expect(r.igst).toBe(90000);
    expect(r.cgst).toBe(0);
    expect(r.sgst).toBe(0);
    expect(r.total).toBe(590000);
  });

  it('applies per-item discount before tax', () => {
    const r = calculateTax([{ description: 'Item', quantity: 1, rate: 100000, discountPct: 10, taxPct: 18 }]);
    expect(r.subtotal).toBe(90000);
    expect(r.total).toBe(106200);
  });

  it('applies document-level discount', () => {
    const r = calculateTax([{ description: 'A', quantity: 1, rate: 100000, taxPct: 5 }], 10000);
    expect(r.subtotal).toBe(100000);
    expect(r.discount).toBe(10000);
    expect(r.total).toBe(90000 + 5000);
  });

  it('rounds to paise', () => {
    const r = calculateTax([{ description: 'A', quantity: 3, rate: 9999, taxPct: 18 }]); // ₹99.99
    expect(r.subtotal).toBe(29997);
    expect(r.total).toBe(35396); // 29997 + round(29997*18/100)=5399 → 35396 paise = ₹353.96
  });
});

describe('Lead scoring', () => {
  it('rewards high priority and value', () => {
    const high = computeLeadScore({ priority: 'URGENT', expectedValue: 600000, hasEmail: true, notes: true });
    const low = computeLeadScore({ priority: 'LOW', expectedValue: 0, hasEmail: false, notes: false });
    expect(high).toBeGreaterThan(low);
    expect(low).toBe(30);
    // 20 base + 40 (URGENT) + 20 (₹6L) + 10 (email) + 5 (notes) = 95
    expect(high).toBe(95);
  });

  it('stays within 0-100', () => {
    const s = computeLeadScore({ priority: 'HIGH', expectedValue: 999999999, hasEmail: true, notes: true });
    expect(s).toBeLessThanOrEqual(100);
  });
});
