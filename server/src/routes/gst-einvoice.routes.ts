import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, badRequest, ok, validate } from '../lib/http';
import { requireAuth, requirePermission, type AuthedRequest } from '../middleware/auth';
import { resolveEInvoiceProvider, type EInvoiceDocument } from '../integrations/gst/einvoice';
import { resolveEWayBillProvider, type EWayBillRequest } from '../integrations/gst/ewaybill';
import { prisma } from '../lib/prisma';

const router = Router();

// ── Zod schemas ────────────────────────────────────────────

const generateIrnSchema = z.object({
  invoiceId: z.string().min(1),
  sellerGstin: z.string().length(15),
  buyerGstin: z.string().length(15).nullable().optional(),
  buyerName: z.string().min(1),
});

const verifyIrnSchema = z.object({
  irn: z.string().min(1),
});

const cancelIrnSchema = z.object({
  irn: z.string().min(1),
  reason: z.enum(['DUPLICATE', 'ORDER_CANCELLED', 'DATA_ENTRY_MISTAKE', 'OTHER']),
  remark: z.string().min(1).max(500),
});

const generateEwayBillSchema = z.object({
  invoiceId: z.string().min(1),
  supplierGstin: z.string().length(15),
  receiverGstin: z.string().length(15),
  documentType: z.enum(['INV', 'CN', 'DN']).optional(),
  transportDistanceKm: z.number().int().positive().optional(),
  vehicleNumber: z.string().optional(),
});

const cancelEwayBillSchema = z.object({
  ewbNo: z.string().min(12).max(12),
  reason: z.enum(['CANCELLED', 'DUPLICATE', 'ORDER_CANCELLED', 'OTHER']),
});

// ── E-Invoice ──────────────────────────────────────────────

/** Get e-invoice provider status for the org */
router.get(
  '/einvoice/status',
  requireAuth,
  requirePermission('invoices.view'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const settings = await prisma.orgSetting.findUnique({
      where: { orgId_key: { orgId: user.orgId, key: 'einvoice' } },
    });
    const cfg = (settings?.value as any) || {};
    return ok(res, {
      enabled: Boolean(cfg.enabled),
      provider: cfg.provider || 'demo',
      hasCredentials: Boolean(cfg.apiUrl && cfg.apiKey),
    });
  })
);

/** Generate an IRN for an invoice */
router.post(
  '/einvoice/irn',
  requireAuth,
  requirePermission('invoices.edit'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const input = validate(generateIrnSchema, req.body);

    const provider = await resolveEInvoiceProvider(user.orgId);
    if (!provider) {
      throw badRequest('E-invoicing is not enabled for your organisation. Enable it in Settings → Tax → E-invoice.');
    }

    // Fetch the invoice
    const invoice = await prisma.invoice.findFirst({
      where: { id: input.invoiceId, orgId: user.orgId },
    });
    if (!invoice) throw badRequest('Invoice not found');

    // Build the document payload
    const doc: EInvoiceDocument = {
      orgId: user.orgId,
      invoiceId: invoice.id,
      invoiceNumber: invoice.number,
      invoiceDate: invoice.createdAt,
      sellerGstin: input.sellerGstin,
      buyerGstin: input.buyerGstin || null,
      buyerName: input.buyerName,
      items: [], // Items would be fetched from invoice items
      subtotal: invoice.subtotal || invoice.total,
      total: invoice.total,
      igst: (invoice.gstSummary as any)?.igst || 0,
      cgst: (invoice.gstSummary as any)?.cgst || 0,
      sgst: (invoice.gstSummary as any)?.sgst || 0,
    };

    const result = await provider.generateIrn(doc);

    // Store the IRN on the invoice
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        metadata: {
          ...((invoice as any).metadata || {}),
          irn: result.irn,
          irnDate: result.irnDate,
          eInvoiceProvider: provider.name,
        } as any,
      },
    });

    return ok(res, {
      irn: result.irn,
      qrCode: result.qrCode,
      irnDate: result.irnDate,
      provider: provider.name,
      isDemo: provider.name === 'demo',
    });
  })
);

/** Verify an IRN */
router.post(
  '/einvoice/verify',
  requireAuth,
  requirePermission('invoices.view'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const input = validate(verifyIrnSchema, req.body);

    const provider = await resolveEInvoiceProvider(user.orgId);
    if (!provider) {
      throw badRequest('E-invoicing is not enabled for your organisation.');
    }

    const result = await provider.verifyIrn(input.irn);
    return ok(res, { ...result, provider: provider.name });
  })
);

/** Cancel an IRN */
router.post(
  '/einvoice/cancel',
  requireAuth,
  requirePermission('invoices.edit'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const input = validate(cancelIrnSchema, req.body);

    const provider = await resolveEInvoiceProvider(user.orgId);
    if (!provider) {
      throw badRequest('E-invoicing is not enabled for your organisation.');
    }

    const result = await provider.cancelIrn(input.irn, input.reason, input.remark);
    return ok(res, { ...result, provider: provider.name });
  })
);

// ── E-Way Bill ─────────────────────────────────────────────

/** Get e-way bill provider status for the org */
router.get(
  '/ewaybill/status',
  requireAuth,
  requirePermission('invoices.view'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const settings = await prisma.orgSetting.findUnique({
      where: { orgId_key: { orgId: user.orgId, key: 'ewaybill' } },
    });
    const cfg = (settings?.value as any) || {};
    return ok(res, {
      enabled: Boolean(cfg.enabled),
      provider: cfg.provider || 'demo',
      hasCredentials: Boolean(cfg.apiUrl && cfg.apiKey),
    });
  })
);

/** Generate an E-way bill for an invoice */
router.post(
  '/ewaybill/generate',
  requireAuth,
  requirePermission('invoices.edit'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const input = validate(generateEwayBillSchema, req.body);

    const provider = await resolveEWayBillProvider(user.orgId);
    if (!provider) {
      throw badRequest('E-way billing is not enabled for your organisation. Enable it in Settings → Tax → E-way bill.');
    }

    // Fetch the invoice
    const invoice = await prisma.invoice.findFirst({
      where: { id: input.invoiceId, orgId: user.orgId },
    });
    if (!invoice) throw badRequest('Invoice not found');

    // Build the request payload
    const ewayReq: EWayBillRequest = {
      orgId: user.orgId,
      supplierGstin: input.supplierGstin,
      receiverGstin: input.receiverGstin,
      documentNumber: invoice.number,
      documentDate: invoice.createdAt,
      documentType: input.documentType || 'INV',
      totalValue: invoice.total,
      igst: (invoice.gstSummary as any)?.igst || 0,
      cgst: (invoice.gstSummary as any)?.cgst || 0,
      sgst: (invoice.gstSummary as any)?.sgst || 0,
      transportDistanceKm: input.transportDistanceKm,
      vehicleNumber: input.vehicleNumber,
    };

    const result = await provider.generateEwayBill(ewayReq);

    // Store the EWB on the invoice
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        metadata: {
          ...((invoice as any).metadata || {}),
          ewbNo: result.ewbNo,
          ewbValidUpto: result.validUpto,
          eWayBillProvider: provider.name,
        } as any,
      },
    });

    return ok(res, {
      ewbNo: result.ewbNo,
      validUpto: result.validUpto,
      provider: provider.name,
      isDemo: provider.name === 'demo',
    });
  })
);

/** Cancel an E-way bill */
router.post(
  '/ewaybill/cancel',
  requireAuth,
  requirePermission('invoices.edit'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const input = validate(cancelEwayBillSchema, req.body);

    const provider = await resolveEWayBillProvider(user.orgId);
    if (!provider) {
      throw badRequest('E-way billing is not enabled for your organisation.');
    }

    const result = await provider.cancelEwayBill(input.ewbNo, input.reason);
    return ok(res, { ...result, provider: provider.name });
  })
);

export default router;
