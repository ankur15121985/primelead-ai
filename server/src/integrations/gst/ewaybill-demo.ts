/**
 * Demo e-way bill provider — simulates EWB generation and cancellation
 * without calling any government API.
 *
 * Follows the same pattern as the WhatsApp demo provider: fully functional
 * locally, clearly labelled as demo.
 *
 * In demo mode:
 *   - EWB number is a deterministic 12-digit number derived from the document
 *   - Validity is 24 hours from generation (statutory window)
 *   - Cancellation always succeeds
 */
import crypto from 'crypto';
import type { EWayBillRequest, EWayBillProvider, EWayBillResult } from './ewaybill';

function generateDemoEwbNo(req: EWayBillRequest): string {
  // Deterministic 12-digit EWB number from document details
  const hash = crypto
    .createHash('sha256')
    .update(`${req.documentNumber}:${req.supplierGstin}:${req.documentDate.toISOString()}`)
    .digest('hex');
  // Take first 12 hex chars, ensure it's numeric by using last 12 digits
  const num = hash.replace(/[^0-9]/g, '').slice(0, 12);
  return num.padStart(12, '1');
}

/** Demo adapter — fully functional, clearly labelled. */
export const demoEWayBillProvider: EWayBillProvider = {
  name: 'demo',

  async generateEwayBill(req: EWayBillRequest): Promise<EWayBillResult> {
    const ewbNo = generateDemoEwbNo(req);
    // Statutory validity: 24 hours in demo (real is 1-30 days based on distance)
    const validUpto = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    console.log(
      `[DEMO E-WAY BILL] EWB generated for doc ${req.documentNumber}: ${ewbNo} | ` +
      `Valid until: ${validUpto.split('T')[0]} | ` +
      `Vehicle: ${req.vehicleNumber || 'N/A'}`
    );

    return { ewbNo, validUpto };
  },

  async cancelEwayBill(ewbNo: string, reason: string): Promise<{ cancelled: boolean }> {
    console.log(`[DEMO E-WAY BILL] EWB cancelled: ${ewbNo} | Reason: ${reason}`);
    return { cancelled: true };
  },
};
