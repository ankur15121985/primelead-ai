/**
 * Credit & debit notes — GST correction documents, built from one shared
 * factory so the two types can never drift apart.
 *
 *  - GET    /              list (filters: status, search)
 *  - POST   /              create (auto-numbered CN-/DN-, GST computed server-side)
 *  - GET    /:id           one note with items
 *  - PATCH  /:id           status transitions (DRAFT → ISSUED → CANCELLED), reason
 *  - DELETE /:id           remove (manager+)
 *  - GET    /:id/pdf       download PDF
 */
import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { asyncHandler, badRequest, notFound, ok, validate } from '../lib/http';
import { requireAuth, requirePermission, assertManagerOrAbove, type AuthedRequest } from '../middleware/auth';
import { withNextNumber, computeDocumentTotals, renderDocumentPdf, serializeCreditNote, serializeDebitNote } from '../services/documents';
import { rupeesToPaise, paiseToRupees } from '../lib/money';
import { audit } from '../lib/audit';
import { creditNoteCreateSchema, debitNoteCreateSchema, noteUpdateSchema } from '../validators/schemas';

function formatINR(n: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

export interface NoteConfig {
  /** CN | DN */
  prefix: 'CN' | 'DN';
  kind: 'CREDIT_NOTE' | 'DEBIT_NOTE';
  /** Prisma delegate: prisma.creditNote | prisma.debitNote */
  model: any;
  itemModel: any;
  serializer: (row: any) => any;
  singular: string;
  /** credit notes may reference the invoice being corrected */
  allowInvoiceRef?: boolean;
}

export function createNoteRouter(cfg: NoteConfig): Router {
  const router = Router();
  router.use(requireAuth);

  router.get(
    '/',
    requirePermission('invoices.view'),
    asyncHandler(async (req, res) => {
      const user = (req as AuthedRequest).user;
      const q = req.query as Record<string, string>;
      const where: Record<string, unknown> = {
        orgId: user.orgId,
        ...(q.status && q.status !== 'ALL' ? { status: q.status } : {}),
        ...(q.search
          ? { OR: [{ number: { contains: q.search } }, { customerName: { contains: q.search } }, { company: { contains: q.search } }] }
          : {}),
      };
      const [rows, issued, cancelled] = await Promise.all([
        cfg.model.findMany({ where, orderBy: { createdAt: 'desc' }, take: 200, include: { items: true, invoice: { select: { id: true, number: true } } } }),
        cfg.model.count({ where: { orgId: user.orgId, status: 'ISSUED' } }),
        cfg.model.count({ where: { orgId: user.orgId, status: 'CANCELLED' } }),
      ]);
      const totalValue = await cfg.model.aggregate({ where: { orgId: user.orgId, status: { in: ['DRAFT', 'ISSUED'] } }, _sum: { total: true } });
      return ok(res, {
        notes: rows.map(cfg.serializer),
        counts: { issued, cancelled, totalValue: paiseToRupees(totalValue._sum.total || 0) },
      });
    })
  );

  router.post(
    '/',
    requirePermission('invoices.create'),
    asyncHandler(async (req, res) => {
      const user = (req as AuthedRequest).user;
      const input: any = validate(cfg.prefix === 'CN' ? creditNoteCreateSchema : debitNoteCreateSchema, req.body);

      let invoiceRef: { id: string; number: string } | null = null;
      if (cfg.allowInvoiceRef && input.invoiceId) {
        invoiceRef = await prisma.invoice.findFirst({
          where: { id: input.invoiceId, orgId: user.orgId },
          select: { id: true, number: true },
        });
        if (!invoiceRef) throw badRequest('The linked invoice was not found.');
      }
      if (input.leadId) {
        const lead = await prisma.lead.findFirst({ where: { id: input.leadId, orgId: user.orgId, deletedAt: null } });
        if (!lead) throw badRequest('The linked lead was not found.');
      }

      const itemsPaise = input.items.map((it: any) => ({ ...it, rate: rupeesToPaise(it.rate) }));
      const calc = computeDocumentTotals(itemsPaise, rupeesToPaise(input.discount || 0));
      const status = input.status || 'DRAFT';

      const note: any = await withNextNumber(user.orgId, cfg.prefix, (docNumber) =>
        cfg.model.create({
          data: {
            orgId: user.orgId,
            number: docNumber,
            ...(cfg.allowInvoiceRef ? { invoiceId: invoiceRef?.id || null } : {}),
            leadId: input.leadId || null,
            customerName: input.customerName,
            company: input.company || null,
            gstin: input.gstin || null,
            reason: input.reason || null,
            discount: calc.discount,
            gstSummary: calc.gstSummary as any,
            subtotal: calc.subtotal,
            total: calc.total,
            status,
            issuedAt: status === 'ISSUED' ? new Date() : null,
            items: {
              create: calc.items.map((it: any, idx: number) => ({
                description: it.description,
                hsnSac: input.items[idx]?.hsnSac || null,
                quantity: it.quantity,
                rate: it.rate,
                discountPct: it.discountPct,
                taxPct: it.taxPct,
                cgst: it.cgst,
                sgst: it.sgst,
                igst: it.igst,
                amount: it.amount,
              })),
            },
          },
          include: { items: true, ...(cfg.allowInvoiceRef ? { invoice: { select: { id: true, number: true } } } : {}) },
        })
      );

      await audit({
        orgId: user.orgId,
        userId: user.id,
        action: `${cfg.prefix === 'CN' ? 'CREDIT_NOTE' : 'DEBIT_NOTE'}_CREATED`,
        entity: cfg.singular,
        entityId: note.id,
        metadata: { number: note.number, invoiceId: input.invoiceId || null },
        req,
      });
      if (note.leadId) {
        await prisma.activity.create({
          data: {
            orgId: user.orgId,
            leadId: note.leadId,
            userId: user.id,
            type: 'INVOICE',
            title: `${cfg.prefix === 'CN' ? 'Credit' : 'Debit'} note created`,
            body: `${note.number} for ${formatINR(paiseToRupees(note.total))}${invoiceRef ? ` against ${invoiceRef.number}` : ''}`,
          },
        });
      }
      return ok(res, { note: cfg.serializer(note) }, 201);
    })
  );

  router.get(
    '/:id',
    requirePermission('invoices.view'),
    asyncHandler(async (req, res) => {
      const user = (req as AuthedRequest).user;
      const note = await cfg.model.findFirst({
        where: { id: req.params.id, orgId: user.orgId },
        include: { items: true, ...(cfg.allowInvoiceRef ? { invoice: { select: { id: true, number: true } } } : {}) },
      });
      if (!note) throw notFound(`${cfg.singular} not found`);
      return ok(res, { note: cfg.serializer(note) });
    })
  );

  router.patch(
    '/:id',
    requirePermission('invoices.edit'),
    asyncHandler(async (req, res) => {
      const user = (req as AuthedRequest).user;
      const input = validate(noteUpdateSchema, req.body);
      const existing = await cfg.model.findFirst({ where: { id: req.params.id, orgId: user.orgId } });
      if (!existing) throw notFound(`${cfg.singular} not found`);

      const data: Record<string, unknown> = {};
      if (input.reason !== undefined) data.reason = input.reason;
      if (input.status) {
        if (existing.status === 'CANCELLED') throw badRequest('A cancelled note cannot be changed.');
        data.status = input.status;
        if (input.status === 'ISSUED' && !existing.issuedAt) data.issuedAt = new Date();
        if (input.status === 'CANCELLED') data.issuedAt = null;
      }
      const updated = await cfg.model.update({
        where: { id: existing.id },
        data,
        include: { items: true, ...(cfg.allowInvoiceRef ? { invoice: { select: { id: true, number: true } } } : {}) },
      });
      await audit({ orgId: user.orgId, userId: user.id, action: `${cfg.prefix === 'CN' ? 'CREDIT_NOTE' : 'DEBIT_NOTE'}_UPDATED`, entity: cfg.singular, entityId: existing.id, req });
      return ok(res, { note: cfg.serializer(updated) });
    })
  );

  router.delete(
    '/:id',
    requirePermission('invoices.delete'),
    asyncHandler(async (req, res) => {
      const user = (req as AuthedRequest).user;
      assertManagerOrAbove(user);
      const existing = await cfg.model.findFirst({ where: { id: req.params.id, orgId: user.orgId } });
      if (!existing) throw notFound(`${cfg.singular} not found`);
      await cfg.model.delete({ where: { id: existing.id } });
      await audit({ orgId: user.orgId, userId: user.id, action: `${cfg.prefix === 'CN' ? 'CREDIT_NOTE' : 'DEBIT_NOTE'}_DELETED`, entity: cfg.singular, entityId: existing.id, req });
      return ok(res, { deleted: true });
    })
  );

  router.get(
    '/:id/pdf',
    requirePermission('invoices.view'),
    asyncHandler(async (req, res) => {
      const user = (req as AuthedRequest).user;
      const note = await cfg.model.findFirst({
        where: { id: req.params.id, orgId: user.orgId },
        include: { items: true, org: { select: { name: true } }, ...(cfg.allowInvoiceRef ? { invoice: { select: { number: true } } } : {}) },
      });
      if (!note) throw notFound(`${cfg.singular} not found`);
      const buf = await renderDocumentPdf({
        kind: cfg.kind,
        number: note.number,
        orgName: note.org.name,
        customerName: note.customerName,
        company: note.company,
        gstin: note.gstin,
        referenceNumber: note.invoice?.number || null,
        items: (note.items as any[]).map((it: any) => ({
          description: it.description,
          quantity: it.quantity,
          rate: it.rate,
          taxPct: it.taxPct,
          cgst: it.cgst,
          sgst: it.sgst,
          igst: it.igst,
          amount: it.amount,
        })),
        discount: note.discount,
        gstSummary: (note.gstSummary as any) || {},
        subtotal: note.subtotal,
        total: note.total,
        terms: note.reason,
        status: note.status,
      });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${note.number}.pdf"`);
      res.send(buf);
    })
  );

  return router;
}

export const creditNotesRouter = createNoteRouter({
  prefix: 'CN',
  kind: 'CREDIT_NOTE',
  model: prisma.creditNote,
  itemModel: prisma.creditNoteItem,
  serializer: serializeCreditNote,
  singular: 'Credit note',
  allowInvoiceRef: true,
});

export const debitNotesRouter = createNoteRouter({
  prefix: 'DN',
  kind: 'DEBIT_NOTE',
  model: prisma.debitNote,
  itemModel: prisma.debitNoteItem,
  serializer: serializeDebitNote,
  singular: 'Debit note',
});
