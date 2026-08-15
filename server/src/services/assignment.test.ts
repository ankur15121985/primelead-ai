import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { calculateTax } from './gst';
import { computeLeadScore } from '../constants';

describe('GST calculation', () => {
  it('computes CGST+SGST split correctly for intra-state 18%', () => {
    const r = calculateTax([{ description: 'Item', quantity: 2, rate: 1000, taxPct: 18 }]);
    expect(r.subtotal).toBe(2000);
    expect(r.cgst).toBe(180);
    expect(r.sgst).toBe(180);
    expect(r.igst).toBe(0);
    expect(r.total).toBe(2360);
  });

  it('computes IGST for inter-state', () => {
    const r = calculateTax([{ description: 'Item', quantity: 1, rate: 5000, taxPct: 18, gstType: 'IGST' }]);
    expect(r.igst).toBe(900);
    expect(r.cgst).toBe(0);
    expect(r.sgst).toBe(0);
    expect(r.total).toBe(5900);
  });

  it('applies per-item discount before tax', () => {
    const r = calculateTax([{ description: 'Item', quantity: 1, rate: 1000, discountPct: 10, taxPct: 18 }]);
    expect(r.subtotal).toBe(900);
    expect(r.total).toBe(1062);
  });

  it('applies document-level discount', () => {
    const r = calculateTax([{ description: 'A', quantity: 1, rate: 1000, taxPct: 5 }], 100);
    expect(r.subtotal).toBe(1000);
    expect(r.discount).toBe(100);
    expect(r.total).toBe(900 + 50);
  });

  it('rounds to paise', () => {
    const r = calculateTax([{ description: 'A', quantity: 3, rate: 99.99, taxPct: 18 }]);
    expect(r.subtotal).toBe(299.97);
    expect(r.total).toBeCloseTo(353.96, 2);
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
