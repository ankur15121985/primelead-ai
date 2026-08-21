import { prisma } from '../lib/prisma';
import { notFound } from '../lib/http';

export interface CreateIcpInput {
  orgId: string;
  name: string;
  description?: string | null;
  industries?: string[] | null;
  subIndustries?: string[] | null;
  employeeRanges?: string[] | null;
  revenueRanges?: string[] | null;
  countries?: string[] | null;
  states?: string[] | null;
  cities?: string[] | null;
  companyTypes?: string[] | null;
  technologies?: string[] | null;
  fundingRanges?: string[] | null;
  foundedAfter?: number | null;
  foundedBefore?: number | null;
  jobTitles?: string[] | null;
  seniorities?: string[] | null;
  departments?: string[] | null;
  buyingSignals?: string[] | null;
  painPoints?: string[] | null;
  keywords?: string[] | null;
}

export type UpdateIcpInput = Partial<Omit<CreateIcpInput, 'orgId'>>;

function toJson(val: unknown): unknown {
  return val ? JSON.parse(JSON.stringify(val)) : undefined;
}

export async function createIcp(input: CreateIcpInput) {
  return (prisma as any).icp.create({
    data: {
      orgId: input.orgId,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      industries: toJson(input.industries),
      subIndustries: toJson(input.subIndustries),
      employeeRanges: toJson(input.employeeRanges),
      revenueRanges: toJson(input.revenueRanges),
      countries: toJson(input.countries),
      states: toJson(input.states),
      cities: toJson(input.cities),
      companyTypes: toJson(input.companyTypes),
      technologies: toJson(input.technologies),
      fundingRanges: toJson(input.fundingRanges),
      foundedAfter: input.foundedAfter ?? null,
      foundedBefore: input.foundedBefore ?? null,
      jobTitles: toJson(input.jobTitles),
      seniorities: toJson(input.seniorities),
      departments: toJson(input.departments),
      buyingSignals: toJson(input.buyingSignals),
      painPoints: toJson(input.painPoints),
      keywords: toJson(input.keywords),
    },
  });
}

export async function updateIcp(id: string, orgId: string, input: UpdateIcpInput) {
  const existing = await (prisma as any).icp.findFirst({ where: { id, orgId } });
  if (!existing) throw notFound('ICP not found');

  const data: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(input)) {
    if (val === undefined) continue;
    if (key === 'name') data.name = (val as string).trim();
    else if (key === 'description') data.description = (val as string)?.trim() || null;
    else if (typeof val === 'number') data[key] = val;
    else data[key] = toJson(val);
  }

  return (prisma as any).icp.update({ where: { id }, data });
}

export async function deleteIcp(id: string, orgId: string) {
  const existing = await (prisma as any).icp.findFirst({ where: { id, orgId } });
  if (!existing) throw notFound('ICP not found');
  await (prisma as any).icp.delete({ where: { id } });
  return { deleted: true };
}

export async function listIcps(orgId: string) {
  return (prisma as any).icp.findMany({
    where: { orgId },
    orderBy: { updatedAt: 'desc' },
  });
}

export async function getIcp(id: string, orgId: string) {
  const icp = await (prisma as any).icp.findFirst({ where: { id, orgId } });
  if (!icp) throw notFound('ICP not found');
  return icp;
}

/**
 * Calculate how many companies match this ICP.
 */
export async function getIcpMatchCount(orgId: string, icpId: string) {
  const icp = await getIcp(icpId, orgId);
  const where: Record<string, unknown> = { orgId, deletedAt: null };

  const conditions: Record<string, unknown>[] = [];

  if (icp.industries && (icp.industries as string[]).length > 0) {
    conditions.push({ industry: { in: icp.industries } });
  }
  if (icp.countries && (icp.countries as string[]).length > 0) {
    conditions.push({ country: { in: icp.countries } });
  }
  if (icp.employeeRanges && (icp.employeeRanges as string[]).length > 0) {
    conditions.push({ employeeRange: { in: icp.employeeRanges } });
  }
  if (icp.revenueRanges && (icp.revenueRanges as string[]).length > 0) {
    conditions.push({ revenueRange: { in: icp.revenueRanges } });
  }
  if (icp.companyTypes && (icp.companyTypes as string[]).length > 0) {
    conditions.push({ companyType: { in: icp.companyTypes } });
  }
  if (icp.foundedAfter) {
    conditions.push({ foundedYear: { gte: icp.foundedAfter } });
  }
  if (icp.foundedBefore) {
    conditions.push({ foundedYear: { lte: icp.foundedBefore } });
  }

  if (conditions.length > 0) {
    where.AND = conditions;
  }

  const count = await prisma.company.count({ where: where as any });

  // Update the match count on the ICP
  await (prisma as any).icp.update({
    where: { id: icpId },
    data: { matchScore: Math.min(100, count) },
  });

  return { count, icp };
}
