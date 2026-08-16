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

/** Resolve the configured e-way bill provider for an org (null = not enabled). */
export async function resolveEWayBillProvider(orgId: string): Promise<EWayBillProvider | null> {
  const settings = await prisma.orgSetting.findUnique({ where: { orgId_key: { orgId, key: 'ewaybill' } } });
  const cfg = (settings?.value as { enabled?: boolean; provider?: string } | null) || null;
  if (!cfg?.enabled) return null;
  throw new NotImplementedError(
    `e-way bills are enabled for this org but no provider adapter is implemented yet. Connect one in Settings → Tax before generating EWBs.`
  );
}
