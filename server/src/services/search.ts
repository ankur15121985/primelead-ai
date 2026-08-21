import { prisma } from '../lib/prisma';

// ────────────────────────────────────────────────────────────
// Filter definition — every filter is a named, typed entry
// ────────────────────────────────────────────────────────────

export interface SearchFilter {
  field: string;
  operator: 'eq' | 'neq' | 'in' | 'nin' | 'contains' | 'gt' | 'gte' | 'lt' | 'lte' | 'between' | 'exists' | 'not_exists';
  value?: unknown;
}

export interface SearchQuery {
  entityType: 'companies' | 'contacts' | 'leads';
  filters: SearchFilter[];
  search?: string; // free-text search
  sort?: { field: string; direction: 'asc' | 'desc' };
  page?: number;
  pageSize?: number;
}

// ────────────────────────────────────────────────────────────
// Company filter definitions (25+ filters)
// ────────────────────────────────────────────────────────────

const COMPANY_FILTERS: Record<string, { dbField: string; type: string }> = {
  name:             { dbField: 'name', type: 'string' },
  domain:           { dbField: 'domain', type: 'string' },
  website:          { dbField: 'website', type: 'string' },
  industry:         { dbField: 'industry', type: 'string' },
  subIndustry:      { dbField: 'subIndustry', type: 'string' },
  country:          { dbField: 'country', type: 'string' },
  state:            { dbField: 'state', type: 'string' },
  city:             { dbField: 'city', type: 'string' },
  employeeRange:    { dbField: 'employeeRange', type: 'enum' },
  employeeCount:    { dbField: 'employeeCount', type: 'number' },
  employeeGrowth:   { dbField: 'employeeGrowth', type: 'number' },
  revenueRange:     { dbField: 'revenueRange', type: 'enum' },
  fundingTotal:     { dbField: 'fundingTotal', type: 'number' },
  foundedYear:      { dbField: 'foundedYear', type: 'number' },
  companyType:      { dbField: 'companyType', type: 'enum' },
  ownership:        { dbField: 'ownership', type: 'string' },
  naicsCode:        { dbField: 'naicsCode', type: 'string' },
  sicCode:          { dbField: 'sicCode', type: 'string' },
  status:           { dbField: 'status', type: 'enum' },
  score:            { dbField: 'score', type: 'number' },
  phone:            { dbField: 'phone', type: 'exists' },
  technologies:     { dbField: 'technologies', type: 'json_contains' },
  tags:             { dbField: 'tags', type: 'json_contains' },
  headquarters:     { dbField: 'headquarters', type: 'string' },
  postalCode:       { dbField: 'postalCode', type: 'string' },
  parentCompanyId:  { dbField: 'parentCompanyId', type: 'string' },
  description:      { dbField: 'description', type: 'string' },
  legalName:        { dbField: 'legalName', type: 'string' },
  cityAndState:     { dbField: 'city', type: 'composite_location' },
};

// ────────────────────────────────────────────────────────────
// Contact filter definitions (25+ filters)
// ────────────────────────────────────────────────────────────

const CONTACT_FILTERS: Record<string, { dbField: string; type: string }> = {
  firstName:        { dbField: 'firstName', type: 'string' },
  lastName:         { dbField: 'lastName', type: 'string' },
  fullName:         { dbField: 'fullName', type: 'string' },
  email:            { dbField: 'email', type: 'string' },
  emailStatus:      { dbField: 'emailStatus', type: 'enum' },
  phone:            { dbField: 'phone', type: 'string' },
  mobile:           { dbField: 'mobile', type: 'string' },
  jobTitle:         { dbField: 'jobTitle', type: 'string' },
  department:       { dbField: 'department', type: 'enum' },
  seniority:        { dbField: 'seniority', type: 'enum' },
  companyId:        { dbField: 'companyId', type: 'string' },
  location:         { dbField: 'location', type: 'string' },
  linkedinUrl:      { dbField: 'linkedinUrl', type: 'exists' },
  yearsAtCompany:   { dbField: 'yearsAtCompany', type: 'number' },
  score:            { dbField: 'score', type: 'number' },
  status:           { dbField: 'status', type: 'enum' },
  skills:           { dbField: 'skills', type: 'json_contains' },
  tags:             { dbField: 'tags', type: 'json_contains' },
  notes:            { dbField: 'notes', type: 'exists' },
  // Cross-table: company filters
  companyIndustry:  { dbField: 'company.industry', type: 'string' },
  companyCountry:   { dbField: 'company.country', type: 'string' },
  companyEmployeeRange: { dbField: 'company.employeeRange', type: 'enum' },
  companyRevenueRange:  { dbField: 'company.revenueRange', type: 'enum' },
  companyTechnologies:  { dbField: 'company.technologies', type: 'json_contains' },
};

// ────────────────────────────────────────────────────────────
// Lead filter definitions (30+ filters)
// ────────────────────────────────────────────────────────────

const LEAD_FILTERS: Record<string, { dbField: string; type: string }> = {
  name:             { dbField: 'name', type: 'string' },
  email:            { dbField: 'email', type: 'string' },
  phone:            { dbField: 'phone', type: 'string' },
  company:          { dbField: 'company', type: 'string' },
  source:           { dbField: 'source', type: 'enum' },
  status:           { dbField: 'status', type: 'enum' },
  priority:         { dbField: 'priority', type: 'enum' },
  score:            { dbField: 'score', type: 'number' },
  ownerId:          { dbField: 'ownerId', type: 'string' },
  stageId:          { dbField: 'stageId', type: 'string' },
  expectedValue:    { dbField: 'expectedValue', type: 'number' },
  tags:             { dbField: 'tags', type: 'json_contains' },
  campaignName:     { dbField: 'campaignName', type: 'string' },
  hasEmail:         { dbField: 'email', type: 'exists' },
  hasPhone:         { dbField: 'phone', type: 'exists' },
  hasFollowUp:      { dbField: 'nextFollowUpAt', type: 'exists' },
  lastContactedAt:  { dbField: 'lastContactedAt', type: 'datetime' },
  nextFollowUpAt:   { dbField: 'nextFollowUpAt', type: 'datetime' },
  expectedCloseAt:  { dbField: 'expectedCloseAt', type: 'datetime' },
  createdAt:        { dbField: 'createdAt', type: 'datetime' },
  customField:      { dbField: 'customFields', type: 'json_path' },
};

export const ALL_FILTERS: Record<string, Record<string, { dbField: string; type: string }>> = {
  companies: COMPANY_FILTERS,
  contacts: CONTACT_FILTERS,
  leads: LEAD_FILTERS,
};

/**
 * Build a Prisma where clause from a list of SearchFilters.
 */
export function buildWhereClause(
  orgId: string,
  filters: SearchFilter[],
  entityType: 'companies' | 'contacts' | 'leads',
  search?: string,
): Record<string, unknown> {
  const filterDefs = ALL_FILTERS[entityType];
  const conditions: Record<string, unknown>[] = [];

  // Always scope to org
  const where: Record<string, unknown> = { orgId, deletedAt: null };

  for (const f of filters) {
    const def = filterDefs[f.field];
    if (!def) continue;

    const { dbField, type } = def;

    switch (f.operator) {
      case 'eq':
        conditions.push({ [dbField]: f.value });
        break;
      case 'neq':
        conditions.push({ [dbField]: { not: f.value } });
        break;
      case 'in':
        if (Array.isArray(f.value) && f.value.length > 0) {
          conditions.push({ [dbField]: { in: f.value } });
        }
        break;
      case 'nin':
        if (Array.isArray(f.value) && f.value.length > 0) {
          conditions.push({ [dbField]: { notIn: f.value } });
        }
        break;
      case 'contains':
        if (typeof f.value === 'string' && f.value.trim()) {
          conditions.push({ [dbField]: { contains: f.value.trim() } });
        }
        break;
      case 'gt':
        conditions.push({ [dbField]: { gt: f.value } });
        break;
      case 'gte':
        conditions.push({ [dbField]: { gte: f.value } });
        break;
      case 'lt':
        conditions.push({ [dbField]: { lt: f.value } });
        break;
      case 'lte':
        conditions.push({ [dbField]: { lte: f.value } });
        break;
      case 'between':
        if (Array.isArray(f.value) && f.value.length === 2) {
          conditions.push({ [dbField]: { gte: f.value[0], lte: f.value[1] } });
        }
        break;
      case 'exists':
        conditions.push({ [dbField]: { not: null } });
        break;
      case 'not_exists':
        conditions.push({ [dbField]: null });
        break;
    }
  }

  // Free-text search
  if (search && search.trim()) {
    const s = search.trim();
    if (entityType === 'companies') {
      conditions.push({
        OR: [
          { name: { contains: s } },
          { domain: { contains: s } },
          { website: { contains: s } },
          { description: { contains: s } },
          { legalName: { contains: s } },
          { headquarters: { contains: s } },
          { city: { contains: s } },
        ],
      });
    } else if (entityType === 'contacts') {
      conditions.push({
        OR: [
          { firstName: { contains: s } },
          { lastName: { contains: s } },
          { fullName: { contains: s } },
          { email: { contains: s } },
          { phone: { contains: s } },
          { jobTitle: { contains: s } },
          { location: { contains: s } },
        ],
      });
    } else if (entityType === 'leads') {
      conditions.push({
        OR: [
          { name: { contains: s } },
          { email: { contains: s } },
          { phone: { contains: s } },
          { company: { contains: s } },
          { notes: { contains: s } },
        ],
      });
    }
  }

  // Combine all conditions with AND
  if (conditions.length > 0) {
    where.AND = conditions;
  }

  return where;
}

/**
 * Execute a search query against companies, contacts, or leads.
 */
export async function executeSearch(query: SearchQuery, orgId: string) {
  const { entityType, filters, search, sort, page = 1, pageSize = 25 } = query;
  const skip = (Math.max(1, page) - 1) * pageSize;

  const where = buildWhereClause(orgId, filters, entityType, search);

  const orderBy: Record<string, string> = {};
  if (sort) {
    orderBy[sort.field] = sort.direction;
  } else {
    orderBy.createdAt = 'desc';
  }

  const modelMap = {
    companies: prisma.company,
    contacts: prisma.companyContact,
    leads: prisma.lead,
  } as const;

  const model = modelMap[entityType];

  const [rows, total] = await Promise.all([
    (model as any).findMany({
      where: where as any,
      orderBy,
      skip,
      take: pageSize,
      ...(entityType === 'contacts' ? { include: { company: true } } : {}),
    }),
    (model as any).count({ where: where as any }),
  ]);

  return {
    results: rows,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
    hasMore: skip + rows.length < total,
  };
}

/**
 * Get available filter options (unique values for a field).
 * Useful for building filter dropdowns.
 */
export async function getFilterOptions(
  entityType: 'companies' | 'contacts' | 'leads',
  fieldName: string,
  orgId: string,
): Promise<string[]> {
  const filterDefs = ALL_FILTERS[entityType];
  const def = filterDefs[fieldName];
  if (!def) return [];

  const modelMap = {
    companies: prisma.company,
    contacts: prisma.companyContact,
    leads: prisma.lead,
  } as const;

  const model = modelMap[entityType];

  const results = await (model as any).groupBy({
    by: [def.dbField] as any,
    where: { orgId, deletedAt: null, [def.dbField]: { not: null } } as any,
    _count: true,
    orderBy: { _count: { [def.dbField]: 'desc' } as any },
    take: 100,
  });

  return results
    .map((r: any) => r[def.dbField])
    .filter((v: unknown) => v !== null && v !== undefined)
    .map(String);
}
