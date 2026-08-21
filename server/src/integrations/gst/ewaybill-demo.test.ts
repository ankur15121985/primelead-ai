import { describe, it, expect } from 'vitest';
import { demoEWayBillProvider } from './ewaybill-demo';
import type { EWayBillRequest } from './ewaybill';

const sampleBill: EWayBillRequest = {
  orgId: 'test-org',
  supplierGstin: '27AABCU9603R1ZM',
  receiverGstin: '29AADCB2230M1ZT',
  documentNumber: 'INV-001',
  documentDate: new Date('2024-06-15'),
  documentType: 'INV',
  totalValue: 11800,
  igst: 0,
  cgst: 900,
  sgst: 900,
  transportDistanceKm: 250,
  vehicleNumber: 'MH12AB1234',
};

describe('Demo E-Way Bill Provider', () => {
  describe('generateEwayBill', () => {
    it('generates a valid 12-digit EWB number', async () => {
      const result = await demoEWayBillProvider.generateEwayBill(sampleBill);
      expect(result.ewbNo).toMatch(/^\d{12}$/);
      expect(result.ewbNo.length).toBe(12);
    });

    it('returns a valid ISO date string for validUpto', async () => {
      const result = await demoEWayBillProvider.generateEwayBill(sampleBill);
      const validDate = new Date(result.validUpto);
      expect(validDate.getTime()).toBeGreaterThan(Date.now());
      // Should be approximately 24 hours from now
      const diffHours = (validDate.getTime() - Date.now()) / (1000 * 60 * 60);
      expect(diffHours).toBeCloseTo(24, 0);
    });

    it('generates deterministic EWB for same input', async () => {
      const r1 = await demoEWayBillProvider.generateEwayBill(sampleBill);
      const r2 = await demoEWayBillProvider.generateEwayBill(sampleBill);
      expect(r1.ewbNo).toBe(r2.ewbNo);
    });

    it('generates different EWB for different input', async () => {
      const r1 = await demoEWayBillProvider.generateEwayBill(sampleBill);
      const r2 = await demoEWayBillProvider.generateEwayBill({ ...sampleBill, documentNumber: 'INV-002' });
      expect(r1.ewbNo).not.toBe(r2.ewbNo);
    });

    it('does not throw errors', async () => {
      await expect(demoEWayBillProvider.generateEwayBill(sampleBill)).resolves.toBeDefined();
    });
  });

  describe('cancelEwayBill', () => {
    it('always succeeds in demo mode', async () => {
      const result = await demoEWayBillProvider.cancelEwayBill('123456789012', 'Test cancellation');
      expect(result.cancelled).toBe(true);
    });

    it('does not throw', async () => {
      await expect(demoEWayBillProvider.cancelEwayBill('any-ewb', 'reason')).resolves.toBeDefined();
    });
  });
});
