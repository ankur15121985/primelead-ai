import { prisma } from '../lib/prisma';
import { notFound } from '../lib/http';

export interface CreatePersonaInput {
  orgId: string;
  name: string;
  description?: string | null;
  jobTitles?: string[] | null;
  seniorities?: string[] | null;
  departments?: string[] | null;
  industries?: string[] | null;
  companySizes?: string[] | null;
  locations?: string[] | null;
  painPoints?: string[] | null;
  goals?: string[] | null;
  objections?: string[] | null;
  messagingTips?: string[] | null;
  valuePropositions?: string[] | null;
  preferredChannels?: string[] | null;
  bestApproach?: string | null;
}

export type UpdatePersonaInput = Partial<Omit<CreatePersonaInput, 'orgId'>>;

function toJson(val: unknown): unknown {
  return val ? JSON.parse(JSON.stringify(val)) : undefined;
}

export async function createPersona(input: CreatePersonaInput) {
  return (prisma as any).persona.create({
    data: {
      orgId: input.orgId,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      jobTitles: toJson(input.jobTitles),
      seniorities: toJson(input.seniorities),
      departments: toJson(input.departments),
      industries: toJson(input.industries),
      companySizes: toJson(input.companySizes),
      locations: toJson(input.locations),
      painPoints: toJson(input.painPoints),
      goals: toJson(input.goals),
      objections: toJson(input.objections),
      messagingTips: toJson(input.messagingTips),
      valuePropositions: toJson(input.valuePropositions),
      preferredChannels: toJson(input.preferredChannels),
      bestApproach: input.bestApproach?.trim() || null,
    },
  });
}

export async function updatePersona(id: string, orgId: string, input: UpdatePersonaInput) {
  const existing = await (prisma as any).persona.findFirst({ where: { id, orgId } });
  if (!existing) throw notFound('Persona not found');

  const data: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(input)) {
    if (val === undefined) continue;
    if (key === 'name') data.name = (val as string).trim();
    else if (key === 'description' || key === 'bestApproach') data[key] = (val as string)?.trim() || null;
    else data[key] = toJson(val);
  }

  return (prisma as any).persona.update({ where: { id }, data });
}

export async function deletePersona(id: string, orgId: string) {
  const existing = await (prisma as any).persona.findFirst({ where: { id, orgId } });
  if (!existing) throw notFound('Persona not found');
  await (prisma as any).persona.delete({ where: { id } });
  return { deleted: true };
}

export async function listPersonas(orgId: string) {
  return (prisma as any).persona.findMany({
    where: { orgId },
    orderBy: { updatedAt: 'desc' },
  });
}

export async function getPersona(id: string, orgId: string) {
  const persona = await (prisma as any).persona.findFirst({ where: { id, orgId } });
  if (!persona) throw notFound('Persona not found');
  return persona;
}

/**
 * Count how many CompanyContacts match this persona's criteria.
 */
export async function getPersonaMatchCount(orgId: string, personaId: string) {
  const persona = await getPersona(personaId, orgId);
  const conditions: Record<string, unknown>[] = [];

  if (persona.seniorities && (persona.seniorities as string[]).length > 0) {
    conditions.push({ seniority: { in: persona.seniorities } });
  }
  if (persona.departments && (persona.departments as string[]).length > 0) {
    conditions.push({ department: { in: persona.departments } });
  }

  // Job title matching — check if any job title contains any of the keywords
  if (persona.jobTitles && (persona.jobTitles as string[]).length > 0) {
    const titleConditions = (persona.jobTitles as string[]).map((t) => ({
      jobTitle: { contains: t },
    }));
    conditions.push({ OR: titleConditions });
  }

  const where: Record<string, unknown> = {
    orgId,
    deletedAt: null,
  };

  if (conditions.length > 0) {
    where.AND = conditions;
  }

  const count = await (prisma as any).companyContact.count({ where });

  await (prisma as any).persona.update({
    where: { id: personaId },
    data: { contactCount: count },
  });

  return { count, persona };
}
