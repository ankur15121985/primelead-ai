/**
 * Company Contacts — B2B contact directory with job titles, seniority, department.
 *  - GET    /          list (search, filter, paginate)
 *  - POST   /          create
 *  - GET    /:id       one contact
 *  - PATCH  /:id       update
 *  - DELETE /:id       soft delete
 *  - GET    /:id/provenance   data provenance
 */
import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { asyncHandler, notFound, ok, validate, badRequest } from '../lib/http';
import { requireAuth, requirePermission, type AuthedRequest } from '../middleware/auth';
import { executeSearch, type SearchFilter } from '../services/search';
import { getProvenance } from '../services/data-providers';
import { z } from 'zod';

const router = Router();
router.use(requireAuth);

// ── List / Search ────────────────────────────────────────────
router.get(
  '/',
  requirePermission('contacts.view'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const q = req.query as Record<string, string>;

    const filters: SearchFilter[] = [];

    if (q.companyId) filters.push({ field: 'companyId', operator: 'eq', value: q.companyId });
    if (q.seniority) {
      const vals = q.seniority.split(',');
      filters.push({ field: 'seniority', operator: 'in', value: vals });
    }
    if (q.department) {
      const vals = q.department.split(',');
      filters.push({ field: 'department', operator: 'in', value: vals });
    }
    if (q.emailStatus) filters.push({ field: 'emailStatus', operator: 'eq', value: q.emailStatus });
    if (q.status) filters.push({ field: 'status', operator: 'eq', value: q.status });
    if (q.hasLinkedin) filters.push({ field: 'linkedinUrl', operator: 'exists', value: true });
    if (q.minScore) filters.push({ field: 'score', operator: 'gte', value: Number(q.minScore) });
    if (q.maxScore) filters.push({ field: 'score', operator: 'lte', value: Number(q.maxScore) });
    if (q.minYears) filters.push({ field: 'yearsAtCompany', operator: 'gte', value: Number(q.minYears) });

    // Company cross-filters
    if (q.companyIndustry) filters.push({ field: 'companyIndustry', operator: 'eq', value: q.companyIndustry });
    if (q.companyCountry) filters.push({ field: 'companyCountry', operator: 'eq', value: q.companyCountry });

    const result = await executeSearch(
      {
        entityType: 'contacts',
        filters,
        search: q.search,
        sort: q.sortField ? { field: q.sortField, direction: (q.sortDir as 'asc' | 'desc') || 'desc' } : undefined,
        page: Number(q.page) || 1,
        pageSize: Math.min(Number(q.pageSize) || 25, 100),
      },
      user.orgId,
    );

    return ok(res, result);
  })
);

// ── Create ───────────────────────────────────────────────────
router.post(
  '/',
  requirePermission('contacts.create'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const input = validate(companyContactCreateSchema, req.body);

    // Validate company exists
    if (input.companyId) {
      const company = await prisma.company.findFirst({
        where: { id: input.companyId, orgId: user.orgId, deletedAt: null },
      });
      if (!company) throw badRequest('Company not found.');
    }

    const fullName = [input.firstName, input.lastName].filter(Boolean).join(' ') || input.firstName;

    const contact = await prisma.companyContact.create({
      data: {
        orgId: user.orgId,
        companyId: input.companyId || '',
        firstName: input.firstName.trim(),
        lastName: input.lastName?.trim() || null,
        fullName,
        jobTitle: input.jobTitle?.trim() || null,
        department: input.department || null,
        seniority: input.seniority || null,
        email: input.email?.trim().toLowerCase() || null,
        emailStatus: input.emailStatus || null,
        phone: input.phone?.trim() || null,
        mobile: input.mobile?.trim() || null,
        location: input.location?.trim() || null,
        linkedinUrl: input.linkedinUrl?.trim() || null,
        otherProfiles: input.otherProfiles || undefined,
        yearsAtCompany: input.yearsAtCompany || null,
        employmentHistory: input.employmentHistory || undefined,
        education: input.education || undefined,
        skills: input.skills || undefined,
        notes: input.notes?.trim() || null,
        tags: input.tags || undefined,
      },
      include: { company: { select: { id: true, name: true, domain: true } } },
    });

    return ok(res, { contact }, 201);
  })
);

// ── Read ─────────────────────────────────────────────────────
router.get(
  '/:id',
  requirePermission('contacts.view'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const contact = await prisma.companyContact.findFirst({
      where: { id: req.params.id, orgId: user.orgId, deletedAt: null },
      include: { company: true },
    });
    if (!contact) throw notFound('Contact not found');
    return ok(res, { contact });
  })
);

// ── Update ───────────────────────────────────────────────────
router.patch(
  '/:id',
  requirePermission('contacts.edit'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const input = validate(companyContactUpdateSchema, req.body);
    const existing = await prisma.companyContact.findFirst({
      where: { id: req.params.id, orgId: user.orgId, deletedAt: null },
    });
    if (!existing) throw notFound('Contact not found');

    const data: Record<string, unknown> = {};
    if (input.firstName !== undefined) data.firstName = input.firstName.trim();
    if (input.lastName !== undefined) data.lastName = input.lastName?.trim() || null;
    if (input.firstName !== undefined || input.lastName !== undefined) {
      const fn = input.firstName ?? existing.firstName;
      const ln = input.lastName !== undefined ? input.lastName : existing.lastName;
      data.fullName = [fn, ln].filter(Boolean).join(' ') || fn;
    }
    if (input.jobTitle !== undefined) data.jobTitle = input.jobTitle?.trim() || null;
    if (input.department !== undefined) data.department = input.department || null;
    if (input.seniority !== undefined) data.seniority = input.seniority || null;
    if (input.email !== undefined) data.email = input.email?.trim().toLowerCase() || null;
    if (input.emailStatus !== undefined) data.emailStatus = input.emailStatus || null;
    if (input.phone !== undefined) data.phone = input.phone?.trim() || null;
    if (input.mobile !== undefined) data.mobile = input.mobile?.trim() || null;
    if (input.location !== undefined) data.location = input.location?.trim() || null;
    if (input.linkedinUrl !== undefined) data.linkedinUrl = input.linkedinUrl?.trim() || null;
    if (input.otherProfiles !== undefined) data.otherProfiles = input.otherProfiles || undefined;
    if (input.yearsAtCompany !== undefined) data.yearsAtCompany = input.yearsAtCompany || null;
    if (input.employmentHistory !== undefined) data.employmentHistory = input.employmentHistory || undefined;
    if (input.education !== undefined) data.education = input.education || undefined;
    if (input.skills !== undefined) data.skills = input.skills || undefined;
    if (input.notes !== undefined) data.notes = input.notes?.trim() || null;
    if (input.tags !== undefined) data.tags = input.tags || undefined;
    if (input.status !== undefined) data.status = input.status;

    const contact = await prisma.companyContact.update({
      where: { id: existing.id },
      data,
      include: { company: { select: { id: true, name: true, domain: true } } },
    });

    return ok(res, { contact });
  })
);

// ── Delete ───────────────────────────────────────────────────
router.delete(
  '/:id',
  requirePermission('contacts.delete'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const existing = await prisma.companyContact.findFirst({
      where: { id: req.params.id, orgId: user.orgId, deletedAt: null },
    });
    if (!existing) throw notFound('Contact not found');
    await prisma.companyContact.update({
      where: { id: existing.id },
      data: { deletedAt: new Date() },
    });
    return ok(res, { deleted: true });
  })
);

// ── Provenance ───────────────────────────────────────────────
router.get(
  '/:id/provenance',
  requirePermission('contacts.view'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const provenance = await getProvenance(user.orgId, 'CONTACT', req.params.id);
    return ok(res, { provenance });
  })
);

// ── Schemas ──────────────────────────────────────────────────

const companyContactCreateSchema = z.object({
  companyId: z.string().min(1, 'Company is required'),
  firstName: z.string().trim().min(1, 'First name is required').max(80),
  lastName: z.string().trim().max(80).optional().nullable(),
  jobTitle: z.string().trim().max(120).optional().nullable(),
  department: z.enum(['ENGINEERING', 'SALES', 'MARKETING', 'FINANCE', 'HR', 'LEGAL', 'OPERATIONS', 'EXECUTIVE', 'SUPPORT', 'PRODUCT', 'DESIGN', 'OTHER']).optional().nullable(),
  seniority: z.enum(['C_LEVEL', 'VP', 'DIRECTOR', 'MANAGER', 'SENIOR', 'STAFF', 'INTERN', 'OTHER']).optional().nullable(),
  email: z.string().trim().email('Enter a valid email').max(120).optional().nullable().or(z.literal('')),
  emailStatus: z.enum(['VALID', 'INVALID', 'RISKY', 'UNKNOWN', 'CATCH_ALL', 'DISPOSABLE']).optional().nullable(),
  phone: z.string().trim().max(20).optional().nullable().or(z.literal('')),
  mobile: z.string().trim().max(20).optional().nullable().or(z.literal('')),
  location: z.string().trim().max(200).optional().nullable(),
  linkedinUrl: z.string().trim().url('Enter a valid URL').max(500).optional().nullable().or(z.literal('')),
  otherProfiles: z.record(z.string().max(500)).optional().nullable(),
  yearsAtCompany: z.coerce.number().int().min(0).max(50).optional().nullable(),
  employmentHistory: z.array(z.object({
    company: z.string().max(200),
    title: z.string().max(200),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  })).max(20).optional().nullable(),
  education: z.array(z.object({
    school: z.string().max(200),
    degree: z.string().max(100).optional(),
    field: z.string().max(100).optional(),
    startYear: z.coerce.number().int().optional(),
    endYear: z.coerce.number().int().optional(),
  })).max(10).optional().nullable(),
  skills: z.array(z.string().max(100)).max(50).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  tags: z.array(z.string().max(40)).max(20).optional().nullable(),
});

const companyContactUpdateSchema = companyContactCreateSchema.partial().extend({
  companyId: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'ARCHIVED']).optional(),
});

export default router;
