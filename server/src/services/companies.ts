import { prisma } from '../lib/prisma';
import { badRequest, conflict, notFound } from '../lib/http';

export interface CreateCompanyInput {
  orgId: string;
  name: string;
  legalName?: string | null;
  website?: string | null;
  domain?: string | null;
  industry?: string | null;
  subIndustry?: string | null;
  description?: string | null;
  foundedYear?: number | null;
  employeeCount?: number | null;
  employeeRange?: string | null;
  employeeGrowth?: number | null;
  revenueRange?: string | null;
  fundingTotal?: number | null;
  fundingRounds?: unknown[] | null;
  headquarters?: string | null;
  country?: string | null;
  state?: string | null;
  city?: string | null;
  postalCode?: string | null;
  technologies?: string[] | null;
  socialProfiles?: Record<string, string> | null;
  phone?: string | null;
  emailDomains?: string[] | null;
  naicsCode?: string | null;
  sicCode?: string | null;
  companyType?: string | null;
  ownership?: string | null;
  parentCompanyId?: string | null;
  subsidiaries?: string[] | null;
  tags?: string[] | null;
  customFields?: Record<string, string> | null;
}

export interface UpdateCompanyInput extends Partial<Omit<CreateCompanyInput, 'orgId'>> {}

function normalizeDomain(url: string | null | undefined): string | null {
  if (!url) return null;
  let d = url.trim().toLowerCase();
  d = d.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  const parts = d.split('.');
  if (parts.length >= 2) return parts.slice(-2).join('.');
  return d;
}

function extractDomain(website: string | null | undefined): string | null {
  return normalizeDomain(website);
}

export async function createCompany(input: CreateCompanyInput) {
  const { orgId } = input;
  const domain = input.domain || extractDomain(input.website);

  // Duplicate detection by domain
  if (domain) {
    const existing = await prisma.company.findFirst({
      where: { orgId, domain, deletedAt: null },
    });
    if (existing) {
      throw conflict(`A company with domain "${domain}" already exists (${existing.name}).`);
    }
  }

  const company = await prisma.company.create({
    data: {
      orgId,
      name: input.name.trim(),
      legalName: input.legalName || null,
      website: input.website || null,
      domain,
      industry: input.industry || null,
      subIndustry: input.subIndustry || null,
      description: input.description || null,
      foundedYear: input.foundedYear || null,
      employeeCount: input.employeeCount || null,
      employeeRange: input.employeeRange || null,
      employeeGrowth: input.employeeGrowth || null,
      revenueRange: input.revenueRange || null,
      fundingTotal: input.fundingTotal || null,
      fundingRounds: input.fundingRounds ? JSON.parse(JSON.stringify(input.fundingRounds)) : undefined,
      headquarters: input.headquarters || null,
      country: input.country || null,
      state: input.state || null,
      city: input.city || null,
      postalCode: input.postalCode || null,
      technologies: input.technologies ? JSON.parse(JSON.stringify(input.technologies)) : undefined,
      socialProfiles: input.socialProfiles ? JSON.parse(JSON.stringify(input.socialProfiles)) : undefined,
      phone: input.phone || null,
      emailDomains: input.emailDomains ? JSON.parse(JSON.stringify(input.emailDomains)) : undefined,
      naicsCode: input.naicsCode || null,
      sicCode: input.sicCode || null,
      companyType: input.companyType || null,
      ownership: input.ownership || null,
      parentCompanyId: input.parentCompanyId || null,
      subsidiaries: input.subsidiaries ? JSON.parse(JSON.stringify(input.subsidiaries)) : undefined,
      tags: input.tags ? JSON.parse(JSON.stringify(input.tags)) : undefined,
      customFields: input.customFields ? JSON.parse(JSON.stringify(input.customFields)) : undefined,
    },
  });

  return company;
}

export async function updateCompany(id: string, orgId: string, input: UpdateCompanyInput) {
  const existing = await prisma.company.findFirst({
    where: { id, orgId, deletedAt: null },
  });
  if (!existing) throw notFound('Company not found');

  // If domain is changing, check for duplicates
  if (input.domain || input.website) {
    const newDomain = input.domain || extractDomain(input.website);
    if (newDomain && newDomain !== existing.domain) {
      const dup = await prisma.company.findFirst({
        where: { orgId, domain: newDomain, deletedAt: null, id: { not: id } },
      });
      if (dup) throw conflict(`A company with domain "${newDomain}" already exists (${dup.name}).`);
    }
  }

  const company = await prisma.company.update({
    where: { id },
    data: {
      ...(input.name !== undefined && { name: input.name.trim() }),
      ...(input.legalName !== undefined && { legalName: input.legalName || null }),
      ...(input.website !== undefined && { website: input.website || null }),
      ...(input.domain !== undefined && { domain: input.domain || null }),
      ...(input.industry !== undefined && { industry: input.industry || null }),
      ...(input.subIndustry !== undefined && { subIndustry: input.subIndustry || null }),
      ...(input.description !== undefined && { description: input.description || null }),
      ...(input.foundedYear !== undefined && { foundedYear: input.foundedYear || null }),
      ...(input.employeeCount !== undefined && { employeeCount: input.employeeCount || null }),
      ...(input.employeeRange !== undefined && { employeeRange: input.employeeRange || null }),
      ...(input.employeeGrowth !== undefined && { employeeGrowth: input.employeeGrowth || null }),
      ...(input.revenueRange !== undefined && { revenueRange: input.revenueRange || null }),
      ...(input.fundingTotal !== undefined && { fundingTotal: input.fundingTotal || null }),
      ...(input.fundingRounds !== undefined && { fundingRounds: input.fundingRounds ? JSON.parse(JSON.stringify(input.fundingRounds)) : undefined }),
      ...(input.headquarters !== undefined && { headquarters: input.headquarters || null }),
      ...(input.country !== undefined && { country: input.country || null }),
      ...(input.state !== undefined && { state: input.state || null }),
      ...(input.city !== undefined && { city: input.city || null }),
      ...(input.postalCode !== undefined && { postalCode: input.postalCode || null }),
      ...(input.technologies !== undefined && { technologies: input.technologies ? JSON.parse(JSON.stringify(input.technologies)) : undefined }),
      ...(input.socialProfiles !== undefined && { socialProfiles: input.socialProfiles ? JSON.parse(JSON.stringify(input.socialProfiles)) : undefined }),
      ...(input.phone !== undefined && { phone: input.phone || null }),
      ...(input.emailDomains !== undefined && { emailDomains: input.emailDomains ? JSON.parse(JSON.stringify(input.emailDomains)) : undefined }),
      ...(input.naicsCode !== undefined && { naicsCode: input.naicsCode || null }),
      ...(input.sicCode !== undefined && { sicCode: input.sicCode || null }),
      ...(input.companyType !== undefined && { companyType: input.companyType || null }),
      ...(input.ownership !== undefined && { ownership: input.ownership || null }),
      ...(input.tags !== undefined && { tags: input.tags ? JSON.parse(JSON.stringify(input.tags)) : undefined }),
      ...(input.customFields !== undefined && { customFields: input.customFields ? JSON.parse(JSON.stringify(input.customFields)) : undefined }),
    },
  });

  return company;
}

export async function deleteCompany(id: string, orgId: string) {
  const existing = await prisma.company.findFirst({
    where: { id, orgId, deletedAt: null },
  });
  if (!existing) throw notFound('Company not found');
  await prisma.company.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
  return { deleted: true };
}

export async function getCompany(id: string, orgId: string) {
  const company = await prisma.company.findFirst({
    where: { id, orgId, deletedAt: null },
    include: {
      contacts: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' } },
    },
  });
  if (!company) throw notFound('Company not found');
  return company;
}
