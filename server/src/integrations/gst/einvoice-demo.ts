/**
 * Demo e-invoice provider — simulates IRN generation, QR code, verification
 * and cancellation without calling any government API.
 *
 * Follows the same pattern as the WhatsApp demo provider: fully functional
 * locally, labelled as demo, and fails loudly when real credentials are expected.
 *
 * In demo mode:
 *   - IRN is a deterministic hash of the invoice number
 *   - QR code is a base64-encoded SVG placeholder
 *   - Signed invoice is a base64-encoded JSON representation
 *   - Verification always returns valid
 *   - Cancellation always succeeds
 */
import crypto from 'crypto';
import type { EInvoiceDocument, EInvoiceProvider, IrnResult } from './einvoice';

function generateDemoIrn(doc: EInvoiceDocument): string {
  // Deterministic IRN from invoice details (real IRN is 64-char alphanumeric)
  const hash = crypto
    .createHash('sha256')
    .update(`${doc.invoiceNumber}:${doc.sellerGstin}:${doc.invoiceDate.toISOString()}`)
    .digest('hex');
  return hash.toUpperCase().slice(0, 64);
}

function generateDemoQrCode(doc: EInvoiceDocument, irn: string): string {
  // Generate a minimal SVG as base64 (real QR is a PNG from the government portal)
  const payload = `IRN:${irn}|GSTIN:${doc.sellerGstin}|INV:${doc.invoiceNumber}|TOTAL:${doc.total}`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
  <rect width="200" height="200" fill="white"/>
  <rect x="10" y="10" width="40" height="40" fill="black"/>
  <rect x="150" y="10" width="40" height="40" fill="black"/>
  <rect x="10" y="150" width="40" height="40" fill="black"/>
  <rect x="60" y="60" width="80" height="80" fill="black"/>
  <text x="100" y="190" text-anchor="middle" font-size="8" fill="black">DEMO IRN</text>
  <text x="100" y="198" text-anchor="middle" font-size="5" fill="gray">${irn.slice(0, 16)}...</text>
</svg>`;
  return Buffer.from(svg).toString('base64');
}

function generateDemoSignedInvoice(doc: EInvoiceDocument): string {
  const signed = {
    version: '1.1',
   tranDtls: { taxSch: 'GST', supTyp: 'B2B', regRev: 'N', igstOnIntra: 'N' },
    docDtls: {
      typ: 'INV',
      no: doc.invoiceNumber,
      dt: doc.invoiceDate.toISOString().split('T')[0],
    },
    sellerDtls: { gstin: doc.sellerGstin, trdNm: 'Demo Seller' },
    buyerDtls: { gstin: doc.buyerGstin, trdNm: doc.buyerName },
    valDtls: {
      AssVal: doc.total - doc.igst - doc.cgst - doc.sgst,
      IGSTVal: doc.igst,
      CGSTVal: doc.cgst,
      SGSTVal: doc.sgst,
      TotInvVal: doc.total,
    },
    _demo: true,
  };
  return Buffer.from(JSON.stringify(signed)).toString('base64');
}

/** Demo adapter — fully functional, clearly labelled. */
export const demoEInvoiceProvider: EInvoiceProvider = {
  name: 'demo',

  async generateIrn(doc: EInvoiceDocument): Promise<IrnResult> {
    const irn = generateDemoIrn(doc);
    const qrCode = generateDemoQrCode(doc, irn);
    const signedInvoice = generateDemoSignedInvoice(doc);

    console.log(`[DEMO E-INVOICE] IRN generated for invoice ${doc.invoiceNumber}: ${irn.slice(0, 16)}...`);

    return {
      irn,
      qrCode,
      irnDate: new Date().toISOString(),
      signedInvoice,
    };
  },

  async verifyIrn(irn: string): Promise<{ valid: boolean; details?: string }> {
    console.log(`[DEMO E-INVOICE] IRN verified: ${irn.slice(0, 16)}...`);
    return {
      valid: true,
      details: 'Demo mode — IRN is simulated. Connect a real provider for government portal verification.',
    };
  },

  async cancelIrn(irn: string, reason: string, remark: string): Promise<{ cancelled: boolean }> {
    console.log(`[DEMO E-INVOICE] IRN cancelled: ${irn.slice(0, 16)}... | Reason: ${reason} | Remark: ${remark}`);
    return { cancelled: true };
  },
};
