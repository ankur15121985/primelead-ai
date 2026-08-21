import { describe, it, expect } from 'vitest';
import { demoEInvoiceProvider } from './einvoice-demo';
import type { EInvoiceDocument } from './einvoice';

const sampleDoc: EInvoiceDocument = {
  orgId: 'test-org',
  invoiceId: 'inv-1',
  invoiceNumber: 'INV-001',
  invoiceDate: new Date('2024-06-15'),
  sellerGstin: '27AABCU9603R1ZM',
  buyerGstin: '29AADCB2230M1ZT',
  buyerName: 'Test Buyer',
  items: [],
  subtotal: 10000,
  total: 11800,
  igst: 0,
  cgst: 900,
  sgst: 900,
};

describe('Demo E-Invoice Provider', () => {
  describe('generateIrn', () => {
    it('generates a valid 64-character IRN', async () => {
      const result = await demoEInvoiceProvider.generateIrn(sampleDoc);
      expect(result.irn).toMatch(/^[A-F0-9]{64}$/);
      expect(result.irn.length).toBe(64);
    });

    it('returns a valid QR code (base64 SVG)', async () => {
      const result = await demoEInvoiceProvider.generateIrn(sampleDoc);
      const decoded = Buffer.from(result.qrCode, 'base64').toString('utf-8');
      expect(decoded).toContain('<svg');
      expect(decoded).toContain('xmlns');
    });

    it('returns an irnDate and signedInvoice', async () => {
      const result = await demoEInvoiceProvider.generateIrn(sampleDoc);
      expect(result.irnDate).toBeTruthy();
      expect(result.signedInvoice).toBeTruthy();
      // signedInvoice should be valid base64
      const decoded = Buffer.from(result.signedInvoice, 'base64').toString('utf-8');
      expect(decoded).toContain('version');
    });

    it('generates deterministic IRN for same input', async () => {
      const r1 = await demoEInvoiceProvider.generateIrn(sampleDoc);
      const r2 = await demoEInvoiceProvider.generateIrn(sampleDoc);
      expect(r1.irn).toBe(r2.irn);
    });

    it('generates different IRN for different input', async () => {
      const r1 = await demoEInvoiceProvider.generateIrn(sampleDoc);
      const r2 = await demoEInvoiceProvider.generateIrn({ ...sampleDoc, invoiceNumber: 'INV-002' });
      expect(r1.irn).not.toBe(r2.irn);
    });
  });

  describe('verifyIrn', () => {
    it('always returns valid for demo mode', async () => {
      const result = await demoEInvoiceProvider.verifyIrn('abc123');
      expect(result.valid).toBe(true);
    });
  });

  describe('cancelIrn', () => {
    it('always succeeds in demo mode', async () => {
      const result = await demoEInvoiceProvider.cancelIrn('abc123', 'Test cancellation', 'test remark');
      expect(result.cancelled).toBe(true);
    });
  });
});
