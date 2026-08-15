/**
 * Quotations — GST-ready documents.
 *  - GET    /              list (filters: status, leadId, search)
 *  - POST   /              create (auto-numbered, GST calculated server-side)
 *  - GET    /:id           one quotation with items
 *  - PATCH  /:id           update (recalculates totals)
 *  - DELETE /:id           remove (manager+)
 *  - POST   /:id/convert   convert to invoice
 *  - GET    /:id/pdf       download PDF
 */
import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { asyncHandler, badRequest, notFound, ok, validate } from '../lib/http';
import { requireAuth, requirePermission, assertManagerOrAbove, type AuthedRequest } from '../middleware/auth';
import { quotationCreateSchema, quotationUpdateSchema } from '../validators/schemas';
import { withNextNumber, serializeQuotation, computeDocumentTotals, renderDocumentPdf } from '../services/documents';
import { rupeesToPaise, paiseToRupees } from '../lib/money';
import { audit } from '../lib/audit';
import { notify } from '../lib/serializers';

const router = Router();
router.use(requireAuth);

/**
 * Quotations belong to the whole org but SALES users should only see ones
 * linked to leads they own (there is no ownerId on Quotation itself).
 */
function docWhere(user: { role: string; id: string }, orgId: string, extra: Record<string, unknown> = {}) {
  return {
    orgId,
    ...(user.role === 'SALES' ? { lead: { ownerId: user.id } } : {}),
    ...extra,
  };
}

router.get(
  '/',
  requirePermission('quotations.view'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const q = req.query as Record<string, string>;
    const where = docWhere(user, user.orgId, {
      ...(q.status && q.status !== 'ALL' ? { status: q.status } : {}),
      ...(q.leadId ? { leadId: q.leadId } : {}),
      ...(q.search
        ? {
            OR: [
              { number: { contains: q.search } },
              { customerName: { contains: q.search } },
              { company: { contains: q.search } },
            ],
          }
        : {}),
    });
    const rows = await prisma.quotation.findMany({
      where: where as any,
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { lead: { select: { id: true, name: true } }, items: true },
    });
    const total = await prisma.quotation.count({ where: where as any });
    return ok(res, {
      quotations: rows.map(serializeQuotation),
      counts: {
        total,
        draft: await prisma.quotation.count({ where: { ...docWhere(user, user.orgId), status: 'DRAFT' } as any }),
        sent: await prisma.quotation.count({ where: { ...docWhere(user, user.orgId), status: 'SENT' } as any }),
        accepted: await prisma.quotation.count({ where: { ...docWhere(user, user.orgId), status: 'ACCEPTED' } as any }),
      },
    });
  })
);

router.post(
  '/',
  requirePermission('quotations.create'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const input = validate(quotationCreateSchema, req.body);

    // lead must belong to the org
    if (input.leadId) {
      const lead = await prisma.lead.findFirst({ where: { id: input.leadId, orgId: user.orgId, deletedAt: null } });
      if (!lead) throw badRequest('The linked lead was not found.');
    }

    // API boundary: rates and discounts arrive in rupees → store as paise.
    const itemsPaise = input.items.map((it) => ({ ...it, rate: rupeesToPaise(it.rate) }));
    const calc = computeDocumentTotals(itemsPaise, rupeesToPaise(input.discount || 0));
    const quotation = await withNextNumber(user.orgId, 'QT', async (docNumber) =>
      prisma.quotation.create({
      data: {
        orgId: user.orgId,
        number: docNumber,
        leadId: input.leadId || null,
        customerName: input.customerName,
        company: input.company || null,
        address: input.address || null,
        gstin: input.gstin || null,
        phone: input.phone || null,
        email: input.email || null,
        discount: calc.discount, // clamped to subtotal so totals stay consistent
        gstSummary: calc.gstSummary as any,
        subtotal: calc.subtotal,
        total: calc.total,
        terms: input.terms || null,
        validityDays: input.validityDays,
        status: input.status || 'DRAFT',
        items: {
          create: calc.items.map((it) => ({
            description: it.description,
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
      include: { lead: { select: { id: true, name: true } }, items: true },
    })
    );

    await audit({ orgId: user.orgId, userId: user.id, action: 'QUOTATION_CREATED', entity: 'Quotation', entityId: quotation.id, metadata: { number: quotation.number }, req });
    if (quotation.leadId) {
      await prisma.activity.create({
        data: {
          orgId: user.orgId,
          leadId: quotation.leadId,
          userId: user.id,
          type: 'QUOTATION',
          title: 'Quotation created',
          body: `${quotation.number} for ${formatINR(paiseToRupees(quotation.total))}`,
        },
      });
    }
    return ok(res, { quotation: serializeQuotation(quotation) }, 201);
  })
);

router.get(
  '/:id',
  requirePermission('quotations.view'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const quotation = await prisma.quotation.findFirst({
      where: { id: req.params.id, ...docWhere(user, user.orgId) },
      include: { lead: { select: { id: true, name: true, phone: true, email: true } }, items: true },
    });
    if (!quotation) throw notFound('Quotation not found');
    return ok(res, { quotation: serializeQuotation(quotation) });
  })
);

router.patch(
  '/:id',
  requirePermission('quotations.edit'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const input = validate(quotationUpdateSchema, req.body);
    const existing = await prisma.quotation.findFirst({ where: { id: req.params.id, ...docWhere(user, user.orgId) }, include: { items: true } });
    if (!existing) throw notFound('Quotation not found');

    // Rates arrive in rupees when the client sends items; existing rows are paise.
    const itemsPaise = (input.items || (existing.items as any[])).map((it: any) =>
      input.items ? { ...it, rate: rupeesToPaise(it.rate) } : it
    );
    const calc = computeDocumentTotals(itemsPaise, input.discount !== undefined ? rupeesToPaise(input.discount) : existing.discount);

    if (input.status === 'ACCEPTED' && existing.leadId) {
      await notify({
        orgId: user.orgId,
        userId: user.id,
        type: 'QUOTATION_ACCEPTED',
        title: 'Quotation accepted 🎉',
        body: `${existing.number} was marked as accepted.`,
        link: `/app/quotations/${existing.id}`,
      });
    }

    const updated = await prisma.quotation.update({
      where: { id: existing.id },
      data: {
        leadId: input.leadId === undefined ? undefined : (input.leadId || null),
        customerName: input.customerName,
        company: input.company === undefined ? undefined : (input.company || null),
        address: input.address === undefined ? undefined : (input.address || null),
        gstin: input.gstin === undefined ? undefined : (input.gstin || null),
        phone: input.phone === undefined ? undefined : (input.phone || null),
        email: input.email === undefined ? undefined : (input.email || null),
        discount: calc.discount, // always the clamped value
        gstSummary: calc.gstSummary as any,
        subtotal: calc.subtotal,
        total: calc.total,
        terms: input.terms === undefined ? undefined : (input.terms || null),
        validityDays: input.validityDays,
        status: input.status,
        ...(input.items
          ? {
              items: {
                deleteMany: {},
                create: calc.items.map((it) => ({
                  description: it.description,
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
            }
          : {}),
      },
      include: { lead: { select: { id: true, name: true } }, items: true },
    });
    await audit({ orgId: user.orgId, userId: user.id, action: 'QUOTATION_UPDATED', entity: 'Quotation', entityId: existing.id, req });
    return ok(res, { quotation: serializeQuotation(updated) });
  })
);

router.delete(
  '/:id',
  requirePermission('quotations.delete'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    assertManagerOrAbove(user);
    const existing = await prisma.quotation.findFirst({ where: { id: req.params.id, orgId: user.orgId } });
    if (!existing) throw notFound('Quotation not found');
    await prisma.quotation.delete({ where: { id: existing.id } });
    await audit({ orgId: user.orgId, userId: user.id, action: 'QUOTATION_DELETED', entity: 'Quotation', entityId: existing.id, req });
    return ok(res, { deleted: true });
  })
);

/** Convert an accepted quotation into an invoice (copies customer + items). */
router.post(
  '/:id/convert',
  requirePermission('quotations.convert'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const quotation = await prisma.quotation.findFirst({
      where: { id: req.params.id, ...docWhere(user, user.orgId) },
      include: { items: true },
    });
    if (!quotation) throw notFound('Quotation not found');
    if (quotation.invoiceId) throw badRequest('This quotation is already converted to an invoice.');

    const invoice = await withNextNumber(user.orgId, 'INV', async (docNumber) =>
      prisma.invoice.create({
      data: {
        orgId: user.orgId,
        number: docNumber,
        leadId: quotation.leadId,
        quotationId: quotation.id,
        customerName: quotation.customerName,
        company: quotation.company,
        billingAddress: quotation.address,
        gstin: quotation.gstin,
        discount: quotation.discount,
        gstSummary: quotation.gstSummary as any,
        subtotal: quotation.subtotal,
        total: quotation.total,
        terms: quotation.terms,
        dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
        items: {
          create: (quotation.items as any[]).map((it) => ({
            description: it.description,
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
      include: { lead: { select: { id: true, name: true } }, items: true },
    })
    );
    await prisma.quotation.update({
      where: { id: quotation.id },
      data: { status: 'CONVERTED', invoiceId: invoice.id },
    });
    await audit({ orgId: user.orgId, userId: user.id, action: 'QUOTATION_CONVERTED', entity: 'Quotation', entityId: quotation.id, metadata: { invoiceId: invoice.id }, req });
    return ok(res, { invoice: { id: invoice.id, number: invoice.number, total: paiseToRupees(invoice.total) }, quotationId: quotation.id });
  })
);

router.get(
  '/:id/pdf',
  requirePermission('quotations.view'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const quotation = await prisma.quotation.findFirst({
      where: { id: req.params.id, ...docWhere(user, user.orgId) },
      include: { items: true, org: { select: { name: true } } },
    });
    if (!quotation) throw notFound('Quotation not found');
    const buf = await renderDocumentPdf({
      kind: 'QUOTATION',
      number: quotation.number,
      orgName: quotation.org.name,
      customerName: quotation.customerName,
      company: quotation.company,
      address: quotation.address,
      gstin: quotation.gstin,
      items: (quotation.items as any[]).map((it) => ({
        description: it.description,
        quantity: it.quantity,
        rate: it.rate,
        taxPct: it.taxPct,
        cgst: it.cgst,
        sgst: it.sgst,
        igst: it.igst,
        amount: it.amount,
      })),
      discount: quotation.discount,
      gstSummary: (quotation.gstSummary as any) || {},
      subtotal: quotation.subtotal,
      total: quotation.total,
      terms: quotation.terms,
      status: quotation.status,
      validityDays: quotation.validityDays,
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${quotation.number}.pdf"`);
    res.send(buf);
  })
);

function formatINR(n: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

export default router;
