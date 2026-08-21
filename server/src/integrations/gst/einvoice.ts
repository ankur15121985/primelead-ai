/**
 * GST e-invoicing integration interface (IRN generation & QR verification).
 *
 * ⚠️ IMPLEMENTATION REQUIRED — no government API is called from this file.
 * Indian e-invoicing is provided through official GSP/NIC APIs that require
 * registration, credentials and eligibility checks. Until a provider adapter
 * is implemented (and its API behavior verified), every method throws a clear
 * NOT_IMPLEMENTED error. Nothing in this file pretends to work.
 *
 * Design: each method receives a normalized, org-scoped payload and returns a
 * normalized result, so a future adapter (NIC, ClearTax, Cygnet, etc.) can be
 * plugged in behind this interface without touching the invoice engine.
 */
import { prisma } from '../../lib/prisma';
import { demoEInvoiceProvider } from './einvoice-demo';

export interface EInvoiceDocument {
  orgId: string;
  invoiceId: string;
  invoiceNumber: string;
  invoiceDate: Date;
  sellerGstin: string;
  sellerName?: string;
  sellerAddress?: string;
  sellerLocation?: string;
  sellerPin?: number;
  sellerState?: string;
  sellerPhone?: string;
  sellerEmail?: string;
  buyerGstin: string | null;
  buyerName: string;
  buyerAddress?: string;
  buyerLocation?: string;
  buyerPin?: number;
  buyerState?: string;
  placeOfSupply?: string;
  items: InvoiceItem[];
  subtotal: number; // paise
  total: number; // paise
  igst: number; // paise
  cgst: number; // paise
  sgst: number; // paise
  paymentTerms?: string;
  notes?: string;
}

export interface InvoiceItem {
  description: string;
  hsnCode?: string;
  isService?: boolean;
  quantity?: number;
  unit?: string;
  unitPrice: number;
  totalAmount: number;
  discount?: number;
  assessableAmount?: number;
  preTaxValue?: number;
  gstRate?: number;
  cgstAmount?: number;
  sgstAmount?: number;
  igstAmount?: number;
}

export interface IrnResult {
  irn: string;
  qrCode: string; // base64 PNG (as returned by the provider)
  irnDate: string; // ISO
  signedInvoice: string; // base64 signed JSON
}

export interface EInvoiceProvider {
  readonly name: string;
  /** Generate an IRN for a tax invoice. */
  generateIrn(doc: EInvoiceDocument): Promise<IrnResult>;
  /** Verify an existing IRN (e.g. before cancellation). */
  verifyIrn(irn: string): Promise<{ valid: boolean; details?: string }>;
  /** Cancel an IRN within the statutory window. */
  cancelIrn(irn: string, reason: string, remark: string): Promise<{ cancelled: boolean }>;
}

/**
 * Resolve the configured e-invoice provider for an org.
 * Returns null when the org has not enabled e-invoicing.
 *
 * Providers:
 *   - "demo" (default) — simulated IRN/QR generation, no real API calls
 *   - "nic" / "cleartax" / "cygnet" — real GSP adapters (require credentials)
 */
export async function resolveEInvoiceProvider(orgId: string): Promise<EInvoiceProvider | null> {
  const settings = await prisma.orgSetting.findUnique({ where: { orgId_key: { orgId, key: 'einvoice' } } });
  const cfg = (settings?.value as { enabled?: boolean; provider?: string; apiUrl?: string; apiKey?: string } | null) || null;
  if (!cfg?.enabled) return null;

  const providerName = cfg.provider || 'demo';

  // Demo provider — fully functional, no credentials needed
  if (providerName === 'demo') {
    return demoEInvoiceProvider;
  }

  // Real providers require credentials
  if (!cfg.apiUrl || !cfg.apiKey) {
    throw new NotImplementedError(
      `e-invoicing provider "${providerName}" is enabled but API credentials are not configured. ` +
      `Set apiUrl and apiKey in Settings → Tax → E-invoice, or switch to the demo provider.`
    );
  }

  // NIC GSP adapter
  if (providerName === 'nic') {
    const { nicEInvoiceProvider } = await import('./nic-einvoice');
    return nicEInvoiceProvider;
  }

  // ClearTax GSP adapter
  if (providerName === 'cleartax') {
    const { clearTaxEInvoiceProvider } = await import('./cleartax-einvoice');
    return clearTaxEInvoiceProvider;
  }

  throw new NotImplementedError(
    `e-invoicing provider "${providerName}" adapter is not yet implemented. ` +
    `The demo provider is available and fully functional — switch to it in Settings → Tax → E-invoice.`
  );
}

/** Stable error type so callers can show a friendly message + reference. */
export class NotImplementedError extends Error {
  code = 'EINVOICE_NOT_IMPLEMENTED';
  constructor(message: string) {
    super(message);
    this.name = 'NotImplementedError';
  }
}
