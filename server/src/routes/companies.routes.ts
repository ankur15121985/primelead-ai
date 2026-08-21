/**
 * Companies — org-scoped B2B company database.
 *  - GET    /          list (search, filter, paginate)
 *  - POST   /          create
 *  - GET    /:id       one company with contacts
 *  - PATCH  /:id       update
 *  - DELETE /:id       soft delete
 *  - POST   /:id/enrich   trigger enrichment
 *  - GET    /:id/provenance   get data provenance
 */
import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { asyncHandler, badRequest, notFound, ok, validate } from '../lib/http';
import { requireAuth, requirePermission, type AuthedRequest } from '../middleware/auth';
import { createCompany, updateCompany, deleteCompany, getCompany } from '../services/companies';
import { executeSearch, getFilterOptions, type SearchFilter } from '../services/search';
import { enrichCompanyWaterfall, getProvenance } from '../services/data-providers';
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

    // Parse filters from query params
    const filters: SearchFilter[] = [];

    if (q.industry) filters.push({ field: 'industry', operator: 'eq', value: q.industry });
    if (q.country) filters.push({ field: 'country', operator: 'eq', value: q.country });
    if (q.state) filters.push({ field: 'state', operator: 'eq', value: q.state });
    if (q.city) filters.push({ field: 'city', operator: 'eq', value: q.city });
    if (q.status) filters.push({ field: 'status', operator: 'eq', value: q.status });
    if (q.companyType) filters.push({ field: 'companyType', operator: 'eq', value: q.companyType });
    if (q.employeeRange) {
      const ranges = q.employeeRange.split(',');
      filters.push({ field: 'employeeRange', operator: 'in', value: ranges });
    }
    if (q.revenueRange) {
      const ranges = q.revenueRange.split(',');
      filters.push({ field: 'revenueRange', operator: 'in', value: ranges });
    }
    if (q.minEmployees) filters.push({ field: 'employeeCount', operator: 'gte', value: Number(q.minEmployees) });
    if (q.maxEmployees) filters.push({ field: 'employeeCount', operator: 'lte', value: Number(q.maxEmployees) });
    if (q.foundedAfter) filters.push({ field: 'foundedYear', operator: 'gte', value: Number(q.foundedAfter) });
    if (q.foundedBefore) filters.push({ field: 'foundedYear', operator: 'lte', value: Number(q.foundedBefore) });
    if (q.hasPhone) filters.push({ field: 'phone', operator: 'exists', value: true });
    if (q.minScore) filters.push({ field: 'score', operator: 'gte', value: Number(q.minScore) });
    if (q.maxScore) filters.push({ field: 'score', operator: 'lte', value: Number(q.maxScore) });

    const result = await executeSearch(
      {
        entityType: 'companies',
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

// ── Filter options ───────────────────────────────────────────
router.get(
  '/filter-options/:fieldName',
  requirePermission('contacts.view'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const options = await getFilterOptions('companies', req.params.fieldName, user.orgId);
    return ok(res, { options });
  })
);

// ── Create ───────────────────────────────────────────────────
router.post(
  '/',
  requirePermission('contacts.create'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const input = validate(companyCreateSchema, req.body);
    const company = await createCompany({ orgId: user.orgId, ...input });
    return ok(res, { company }, 201);
  })
);

// ── Read ─────────────────────────────────────────────────────
router.get(
  '/:id',
  requirePermission('contacts.view'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const company = await getCompany(req.params.id, user.orgId);
    return ok(res, { company });
  })
);

// ── Update ───────────────────────────────────────────────────
router.patch(
  '/:id',
  requirePermission('contacts.edit'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const input = validate(companyUpdateSchema, req.body);
    const company = await updateCompany(req.params.id, user.orgId, input);
    return ok(res, { company });
  })
);

// ── Delete ───────────────────────────────────────────────────
router.delete(
  '/:id',
  requirePermission('contacts.delete'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const result = await deleteCompany(req.params.id, user.orgId);
    return ok(res, result);
  })
);

// ── Enrich ───────────────────────────────────────────────────
router.post(
  '/:id/enrich',
  requirePermission('contacts.enrich'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const company = await prisma.company.findFirst({
      where: { id: req.params.id, orgId: user.orgId, deletedAt: null },
    });
    if (!company) throw notFound('Company not found');

    if (!company.domain) {
      throw badRequest('Company has no domain to enrich from.');
    }

    const result = await enrichCompanyWaterfall(user.orgId, company.domain);
    if (!result) {
      return ok(res, {
        enriched: false,
        message: 'No data providers are configured or returned results.',
        provider: null,
      });
    }

    return ok(res, {
      enriched: true,
      provider: result.provider,
      fieldsEnriched: result.results.length,
    });
  })
);

// ── Provenance ───────────────────────────────────────────────
router.get(
  '/:id/provenance',
  requirePermission('contacts.view'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const provenance = await getProvenance(user.orgId, 'COMPANY', req.params.id);
    return ok(res, { provenance });
  })
);

// ── Schemas ──────────────────────────────────────────────────

const companyCreateSchema = z.object({
  name: z.string().trim().min(1, 'Company name is required').max(200),
  legalName: z.string().trim().max(200).optional().nullable(),
  website: z.string().trim().max(500).optional().nullable(),
  domain: z.string().trim().max(200).optional().nullable(),
  industry: z.string().trim().max(100).optional().nullable(),
  subIndustry: z.string().trim().max(100).optional().nullable(),
  description: z.string().max(5000).optional().nullable(),
  foundedYear: z.coerce.number().int().min(1800).max(2100).optional().nullable(),
  employeeCount: z.coerce.number().int().min(0).optional().nullable(),
  employeeRange: z.string().max(20).optional().nullable(),
  employeeGrowth: z.coerce.number().optional().nullable(),
  revenueRange: z.string().max(20).optional().nullable(),
  fundingTotal: z.coerce.number().int().min(0).optional().nullable(),
  headquarters: z.string().trim().max(300).optional().nullable(),
  country: z.string().trim().max(100).optional().nullable(),
  state: z.string().trim().max(100).optional().nullable(),
  city: z.string().trim().max(100).optional().nullable(),
  postalCode: z.string().trim().max(20).optional().nullable(),
  technologies: z.array(z.string().max(100)).max(50).optional().nullable(),
  socialProfiles: z.record(z.string().max(500)).optional().nullable(),
  phone: z.string().trim().max(20).optional().nullable(),
  emailDomains: z.array(z.string().max(100)).max(20).optional().nullable(),
  naicsCode: z.string().trim().max(10).optional().nullable(),
  sicCode: z.string().trim().max(10).optional().nullable(),
  companyType: z.string().max(30).optional().nullable(),
  ownership: z.string().max(100).optional().nullable(),
  parentCompanyId: z.string().max(100).optional().nullable(),
  tags: z.array(z.string().max(40)).max(20).optional().nullable(),
  customFields: z.record(z.string().max(200)).optional().nullable(),
});

const companyUpdateSchema = companyCreateSchema.partial();

export default router;
