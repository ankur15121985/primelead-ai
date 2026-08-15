/**
 * Invoices — GST-ready billing documents.
 *  - GET    /              list (filters: status, leadId, search)
 *  - POST   /              create (auto-numbered, GST calculated server-side)
 *  - GET    /:id           one invoice with items
 *  - PATCH  /:id           update (recalculates totals)
 *  - DELETE /:id           remove (manager+)
 *  - POST   /:id/payment   record a payment (auto-advances status)
 *  - GET    /:id/pdf       download PDF
 */
import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { asyncHandler, badRequest, notFound, ok, validate } from '../lib/http';
import { requireAuth, requirePermission, assertManagerOrAbove, type AuthedRequest } from '../middleware/auth';
import { invoiceCreateSchema, invoiceUpdateSchema, invoicePaymentSchema } from '../validators/schemas';
import { withNextNumber, serializeInvoice, computeDocumentTotals, renderDocumentPdf } from '../services/documents';
import { rupeesToPaise, paiseToRupees } from '../lib/money';
import { audit } from '../lib/audit';
import { notify } from '../lib/serializers';

const router = Router();
router.use(requireAuth);

/** Invoices belong to the org; SALES users only see ones for leads they own. */
function docWhere(user: { role: string; id: string }, orgId: string, extra: Record<string, unknown> = {}) {
  return {
    orgId,
    ...(user.role === 'SALES' ? { lead: { ownerId: user.id } } : {}),
    ...extra,
  };
}

router.get(
  '/',
  requirePermission('invoices.view'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const q = req.query as Record<string, string>;
    const where = docWhere(user, user.orgId, {
      ...(q.status && q.status !== 'ALL' ? { status: q.status } : {}),
      ...(q.leadId ? { leadId: q.leadId } : {}),
      ...(q.search
        ? { OR: [{ number: { contains: q.search } }, { customerName: { contains: q.search } }, { company: { contains: q.search } }] }
        : {}),
    });
    const rows = await prisma.invoice.findMany({
      where: where as any,
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { lead: { select: { id: true, name: true } }, items: true },
    });
    const base = docWhere(user, user.orgId);
    const total = await prisma.invoice.count({ where: where as any });
    const [paidCount, pendingCount, overdueCount] = await Promise.all([
      prisma.invoice.count({ where: { ...base, status: 'PAID' } as any }),
      prisma.invoice.count({ where: { ...base, status: { in: ['DRAFT', 'SENT', 'PARTIALLY_PAID'] } } as any }),
      prisma.invoice.count({ where: { ...base, status: 'OVERDUE' } as any }),
    ]);
    const totalValue = await prisma.invoice.aggregate({ where: { ...base } as any, _sum: { total: true } });
    return ok(res, {
      invoices: rows.map(serializeInvoice),
      counts: { total, paid: paidCount, pending: pendingCount, overdue: overdueCount, totalValue: paiseToRupees(totalValue._sum.total || 0) },
    });
  })
);

router.post(
  '/',
  requirePermission('invoices.create'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const input = validate(invoiceCreateSchema, req.body);
    if (input.leadId) {
      const lead = await prisma.lead.findFirst({ where: { id: input.leadId, orgId: user.orgId, deletedAt: null } });
      if (!lead) throw badRequest('The linked lead was not found.');
    }
    if (input.quotationId) {
      const q = await prisma.quotation.findFirst({ where: { id: input.quotationId, orgId: user.orgId } });
      if (!q) throw badRequest('The linked quotation was not found.');
    }

    // API boundary: rates, discount and paid amount arrive in rupees → paise.
    const itemsPaise = input.items.map((it) => ({ ...it, rate: rupeesToPaise(it.rate) }));
    const calc = computeDocumentTotals(itemsPaise, rupeesToPaise(input.discount || 0));
    let status = input.status || 'DRAFT';
    let paidAmount = rupeesToPaise(input.paidAmount || 0);
    if (input.status === 'SENT' && paidAmount >= calc.total) status = 'PAID';
    if (input.status === 'PAID') paidAmount = calc.total;

    const invoice = await withNextNumber(user.orgId, 'INV', async (docNumber) =>
      prisma.invoice.create({
      data: {
        orgId: user.orgId,
        number: docNumber,
        leadId: input.leadId || null,
        quotationId: input.quotationId || null,
        customerName: input.customerName,
        company: input.company || null,
        billingAddress: input.billingAddress || null,
        gstin: input.gstin || null,
        discount: calc.discount, // clamped to subtotal so totals stay consistent
        gstSummary: calc.gstSummary as any,
        subtotal: calc.subtotal,
        total: calc.total,
        paidAmount,
        status,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        terms: input.terms || null,
        items: {
          create: calc.items.map((it, idx) => ({
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
      include: { lead: { select: { id: true, name: true } }, items: true },
    })
    );

    await audit({ orgId: user.orgId, userId: user.id, action: 'INVOICE_CREATED', entity: 'Invoice', entityId: invoice.id, metadata: { number: invoice.number }, req });
    if (invoice.leadId) {
      await prisma.activity.create({
        data: {
          orgId: user.orgId,
          leadId: invoice.leadId,
          userId: user.id,
          type: 'INVOICE',
          title: 'Invoice created',
          body: `${invoice.number} for ${formatINR(paiseToRupees(invoice.total))}`,
        },
      });
    }
    return ok(res, { invoice: serializeInvoice(invoice) }, 201);
  })
);

router.get(
  '/:id',
  requirePermission('invoices.view'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const invoice = await prisma.invoice.findFirst({
      where: { id: req.params.id, ...docWhere(user, user.orgId) },
      include: { lead: { select: { id: true, name: true, phone: true, email: true } }, items: true },
    });
    if (!invoice) throw notFound('Invoice not found');
    return ok(res, { invoice: serializeInvoice(invoice) });
  })
);

router.patch(
  '/:id',
  requirePermission('invoices.edit'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const input = validate(invoiceUpdateSchema, req.body);
    const existing = await prisma.invoice.findFirst({ where: { id: req.params.id, ...docWhere(user, user.orgId) }, include: { items: true } });
    if (!existing) throw notFound('Invoice not found');

    const itemsPaise = (input.items || (existing.items as any[])).map((it: any) =>
      input.items ? { ...it, rate: rupeesToPaise(it.rate) } : it
    );
    const calc = computeDocumentTotals(itemsPaise, input.discount !== undefined ? rupeesToPaise(input.discount) : existing.discount);
    let status = input.status ?? existing.status;
    let paidAmount = input.paidAmount !== undefined ? rupeesToPaise(input.paidAmount) : existing.paidAmount;
    if (input.status === 'PAID') paidAmount = calc.total;
    else if (status === 'DRAFT') paidAmount = 0;

    const updated = await prisma.invoice.update({
      where: { id: existing.id },
      data: {
        leadId: input.leadId === undefined ? undefined : (input.leadId || null),
        customerName: input.customerName,
        company: input.company === undefined ? undefined : (input.company || null),
        billingAddress: input.billingAddress === undefined ? undefined : (input.billingAddress || null),
        gstin: input.gstin === undefined ? undefined : (input.gstin || null),
        discount: calc.discount, // always the clamped value
        gstSummary: calc.gstSummary as any,
        subtotal: calc.subtotal,
        total: calc.total,
        paidAmount,
        status,
        dueDate: input.dueDate === undefined ? undefined : (input.dueDate ? new Date(input.dueDate) : null),
        terms: input.terms === undefined ? undefined : (input.terms || null),
        ...(input.items
          ? {
              items: {
                deleteMany: {},
                create: calc.items.map((it, idx) => ({
                  description: it.description,
                  hsnSac: input.items![idx]?.hsnSac || null,
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
    await audit({ orgId: user.orgId, userId: user.id, action: 'INVOICE_UPDATED', entity: 'Invoice', entityId: existing.id, req });
    return ok(res, { invoice: serializeInvoice(updated) });
  })
);

router.delete(
  '/:id',
  requirePermission('invoices.delete'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    assertManagerOrAbove(user);
    const existing = await prisma.invoice.findFirst({ where: { id: req.params.id, orgId: user.orgId } });
    if (!existing) throw notFound('Invoice not found');
    await prisma.invoice.delete({ where: { id: existing.id } });
    await audit({ orgId: user.orgId, userId: user.id, action: 'INVOICE_DELETED', entity: 'Invoice', entityId: existing.id, req });
    return ok(res, { deleted: true });
  })
);

/** Record a payment; auto-advances status to PARTIALLY_PAID / PAID. */
router.post(
  '/:id/payment',
  requirePermission('invoices.pay'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const input = validate(invoicePaymentSchema, req.body);
    const invoice = await prisma.invoice.findFirst({ where: { id: req.params.id, ...docWhere(user, user.orgId) } });
    if (!invoice) throw notFound('Invoice not found');
    if (invoice.status === 'CANCELLED') throw badRequest('A cancelled invoice cannot accept payments.');

    const paidAmount = Math.min(invoice.total, invoice.paidAmount + rupeesToPaise(input.paidAmount));
    const status = paidAmount >= invoice.total ? 'PAID' : invoice.status === 'DRAFT' ? 'SENT' : 'PARTIALLY_PAID';
    const updated = await prisma.invoice.update({
      where: { id: invoice.id },
      data: { paidAmount, status },
      include: { lead: { select: { id: true, name: true } }, items: true },
    });

    await prisma.payment.create({
      data: {
        orgId: user.orgId,
        subscriptionId: null,
        amount: rupeesToPaise(input.paidAmount),
        status: 'SUCCEEDED',
        provider: 'MANUAL',
      },
    });
    await audit({ orgId: user.orgId, userId: user.id, action: 'PAYMENT_RECORDED', entity: 'Invoice', entityId: invoice.id, metadata: { amount: input.paidAmount }, req });

    if (status === 'PAID' && invoice.leadId) {
      await notify({
        orgId: user.orgId,
        userId: user.id,
        type: 'INVOICE_OVERDUE' as any, // reuse bell; content is friendly
        title: 'Invoice paid in full 🎉',
        body: `${invoice.number} is fully paid (${formatINR(paiseToRupees(invoice.total))}).`,
        link: `/app/invoices/${invoice.id}`,
      });
    }
    return ok(res, { invoice: serializeInvoice(updated) });
  })
);

router.get(
  '/:id/pdf',
  requirePermission('invoices.view'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const invoice = await prisma.invoice.findFirst({
      where: { id: req.params.id, ...docWhere(user, user.orgId) },
      include: { items: true, org: { select: { name: true } } },
    });
    if (!invoice) throw notFound('Invoice not found');
    const buf = await renderDocumentPdf({
      kind: 'INVOICE',
      number: invoice.number,
      orgName: invoice.org.name,
      customerName: invoice.customerName,
      company: invoice.company,
      address: invoice.billingAddress,
      gstin: invoice.gstin,
      items: (invoice.items as any[]).map((it) => ({
        description: it.description,
        quantity: it.quantity,
        rate: it.rate,
        taxPct: it.taxPct,
        cgst: it.cgst,
        sgst: it.sgst,
        igst: it.igst,
        amount: it.amount,
      })),
      discount: invoice.discount,
      gstSummary: (invoice.gstSummary as any) || {},
      subtotal: invoice.subtotal,
      total: invoice.total,
      terms: invoice.terms,
      status: invoice.status,
      dueDate: invoice.dueDate,
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${invoice.number}.pdf"`);
    res.send(buf);
  })
);

function formatINR(n: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

export default router;
