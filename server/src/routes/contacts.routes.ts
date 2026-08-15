/**
 * Contacts directory — org-scoped CRUD.
 *  - GET    /          list (search by name/phone/email/company)
 *  - POST   /          create (optionally linked to a lead)
 *  - GET    /:id       one contact
 *  - PATCH  /:id       update
 *  - DELETE /:id       remove
 */
import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { asyncHandler, badRequest, notFound, ok, validate } from '../lib/http';
import { requireAuth, requirePermission, type AuthedRequest } from '../middleware/auth';
import { contactCreateSchema, contactUpdateSchema } from '../validators/schemas';

const router = Router();
router.use(requireAuth);

router.get(
  '/',
  requirePermission('contacts.view'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const q = req.query as Record<string, string>;
    const where: Record<string, unknown> = { orgId: user.orgId };
    if (q.search) {
      const s = q.search.trim();
      where.OR = [
        { name: { contains: s } },
        { phone: { contains: s } },
        { email: { contains: s } },
        { company: { contains: s } },
      ];
    }
    const rows = await prisma.contact.findMany({
      where: where as any,
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { lead: { select: { id: true, name: true } } },
    });
    return ok(res, { contacts: rows, total: await prisma.contact.count({ where: where as any }) });
  })
);

router.post(
  '/',
  requirePermission('contacts.create'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const input = validate(contactCreateSchema, req.body);
    if (input.leadId) {
      const lead = await prisma.lead.findFirst({ where: { id: input.leadId, orgId: user.orgId, deletedAt: null } });
      if (!lead) throw badRequest('The linked lead was not found.');
    }
    const contact = await prisma.contact.create({
      data: {
        orgId: user.orgId,
        leadId: input.leadId || null,
        name: input.name,
        phone: input.phone || null,
        email: input.email || null,
        company: input.company || null,
        notes: input.notes || null,
        tags: input.tags?.length ? (input.tags as any) : undefined,
      },
      include: { lead: { select: { id: true, name: true } } },
    });
    return ok(res, { contact }, 201);
  })
);

router.get(
  '/:id',
  requirePermission('contacts.view'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const contact = await prisma.contact.findFirst({
      where: { id: req.params.id, orgId: user.orgId },
      include: { lead: { select: { id: true, name: true } } },
    });
    if (!contact) throw notFound('Contact not found');
    return ok(res, { contact });
  })
);

router.patch(
  '/:id',
  requirePermission('contacts.edit'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const input = validate(contactUpdateSchema, req.body);
    const existing = await prisma.contact.findFirst({ where: { id: req.params.id, orgId: user.orgId } });
    if (!existing) throw notFound('Contact not found');
    if (input.leadId) {
      const lead = await prisma.lead.findFirst({ where: { id: input.leadId, orgId: user.orgId, deletedAt: null } });
      if (!lead) throw badRequest('The linked lead was not found.');
    }
    const contact = await prisma.contact.update({
      where: { id: existing.id },
      data: {
        name: input.name,
        phone: input.phone === undefined ? undefined : (input.phone || null),
        email: input.email === undefined ? undefined : (input.email || null),
        company: input.company === undefined ? undefined : (input.company || null),
        notes: input.notes === undefined ? undefined : (input.notes || null),
        leadId: input.leadId === undefined ? undefined : (input.leadId || null),
        tags: input.tags ? ((input.tags as any) || undefined) : undefined,
      },
      include: { lead: { select: { id: true, name: true } } },
    });
    return ok(res, { contact });
  })
);

router.delete(
  '/:id',
  requirePermission('contacts.delete'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const existing = await prisma.contact.findFirst({ where: { id: req.params.id, orgId: user.orgId } });
    if (!existing) throw notFound('Contact not found');
    await prisma.contact.delete({ where: { id: existing.id } });
    return ok(res, { deleted: true });
  })
);

export default router;
