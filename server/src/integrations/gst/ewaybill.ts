/**
 * E-way bill integration interface.
 *
 * ⚠️ IMPLEMENTATION REQUIRED — no government API is called from this file.
 * E-way bills (EWB) are generated through the official EWB portal APIs which
 * require GSTIN registration, credentials and eligibility. Until a provider
 * adapter is implemented and its API behavior verified, every method throws
 * NotImplementedError. Nothing here pretends to work.
 */
import { prisma } from '../../lib/prisma';
import { demoEWayBillProvider } from './ewaybill-demo';

export interface EWayBillRequest {
  orgId: string;
  supplierGstin: string;
  receiverGstin: string;
  documentNumber: string;
  documentDate: Date;
  documentType: 'INV' | 'CN' | 'DN'; // invoice / credit note / debit note
  totalValue: number; // paise
  igst: number; // paise
  cgst: number; // paise
  sgst: number; // paise
  transportDistanceKm?: number;
  vehicleNumber?: string;
}

export interface EWayBillResult {
  ewbNo: string;
  validUpto: string; // ISO
}

export interface EWayBillProvider {
  readonly name: string;
  generateEwayBill(req: EWayBillRequest): Promise<EWayBillResult>;
  /** Cancel an e-way bill (within the statutory window). */
  cancelEwayBill(ewbNo: string, reason: string): Promise<{ cancelled: boolean }>;
}

export class NotImplementedError extends Error {
  code = 'EWAYBILL_NOT_IMPLEMENTED';
  constructor(message: string) {
    super(message);
    this.name = 'NotImplementedError';
  }
}

/**
 * Resolve the configured e-way bill provider for an org (null = not enabled).
 *
 * Providers:
 *   - "demo" (default) — simulated EWB generation, no real API calls
 *   - "nic" / "cleartax" — real EWB adapters (require credentials)
 */
export async function resolveEWayBillProvider(orgId: string): Promise<EWayBillProvider | null> {
  const settings = await prisma.orgSetting.findUnique({ where: { orgId_key: { orgId, key: 'ewaybill' } } });
  const cfg = (settings?.value as { enabled?: boolean; provider?: string; apiUrl?: string; apiKey?: string } | null) || null;
  if (!cfg?.enabled) return null;

  const providerName = cfg.provider || 'demo';

  // Demo provider — fully functional, no credentials needed
  if (providerName === 'demo') {
    return demoEWayBillProvider;
  }

  // Real providers require credentials
  if (!cfg.apiUrl || !cfg.apiKey) {
    throw new NotImplementedError(
      `e-way bill provider "${providerName}" is enabled but API credentials are not configured. ` +
      `Set apiUrl and apiKey in Settings → Tax → E-way bill, or switch to the demo provider.`
    );
  }

  throw new NotImplementedError(
    `e-way bill provider "${providerName}" adapter is not yet implemented. ` +
    `The demo provider is available and fully functional — switch to it in Settings → Tax → E-way bill.`
  );
}
