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

export interface EInvoiceDocument {
  orgId: string;
  invoiceId: string;
  invoiceNumber: string;
  invoiceDate: Date;
  sellerGstin: string;
  buyerGstin: string | null;
  buyerName: string;
  total: number; // paise
  igst: number; // paise
  cgst: number; // paise
  sgst: number; // paise
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
 * Returns null when the org has not enabled e-invoicing — callers should
 * surface a clear, configurable message instead of a crash.
 */
export async function resolveEInvoiceProvider(orgId: string): Promise<EInvoiceProvider | null> {
  const settings = await prisma.orgSetting.findUnique({ where: { orgId_key: { orgId, key: 'einvoice' } } });
  const cfg = (settings?.value as { enabled?: boolean; provider?: string } | null) || null;
  if (!cfg?.enabled) return null;
  throw new NotImplementedError(
    `e-invoicing is enabled for this org but no provider adapter is implemented yet. Connect one in Settings → Tax before generating IRNs.`
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
