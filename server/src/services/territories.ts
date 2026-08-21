/**
 * Phase 17 — Territory management.
 *
 * Territories define geographic/industry-based ownership regions.
 * Account ownership tracks which rep owns which accounts.
 */
import { prisma } from '../lib/prisma';

/* ── Territory CRUD ─────────────────────────────────────────── */

export interface TerritoryInput {
  name: string;
  description?: string;
  countries?: string[];
  states?: string[];
  cities?: string[];
  zipCodes?: string[];
  industries?: string[];
  employeeRanges?: string[];
  ownerId?: string;
  teamId?: string;
}

export async function createTerritory(orgId: string, input: TerritoryInput) {
  return prisma.territory.create({
    data: {
      orgId,
      name: input.name.trim(),
      description: input.description || null,
      countries: JSON.stringify(input.countries || []),
      states: JSON.stringify(input.states || []),
      cities: JSON.stringify(input.cities || []),
      zipCodes: JSON.stringify(input.zipCodes || []),
      industries: JSON.stringify(input.industries || []),
      employeeRanges: JSON.stringify(input.employeeRanges || []),
      ownerId: input.ownerId || null,
      teamId: input.teamId || null,
    },
  });
}

export async function getTerritories(orgId: string) {
  return prisma.territory.findMany({
    where: { orgId },
    orderBy: { createdAt: 'desc' },
    include: { owner: { select: { id: true, name: true, email: true } } },
  });
}

export async function getTerritory(orgId: string, id: string) {
  return prisma.territory.findFirst({
    where: { id, orgId },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      accounts: { where: { isActive: true }, include: { owner: { select: { id: true, name: true } } } },
    },
  });
}

export async function updateTerritory(orgId: string, id: string, input: Partial<TerritoryInput>) {
  const existing = await prisma.territory.findFirst({ where: { id, orgId } });
  if (!existing) throw Object.assign(new Error('Territory not found'), { status: 404 });

  return prisma.territory.update({
    where: { id },
    data: {
      ...(input.name !== undefined && { name: input.name.trim() }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.countries !== undefined && { countries: JSON.stringify(input.countries) }),
      ...(input.states !== undefined && { states: JSON.stringify(input.states) }),
      ...(input.cities !== undefined && { cities: JSON.stringify(input.cities) }),
      ...(input.zipCodes !== undefined && { zipCodes: JSON.stringify(input.zipCodes) }),
      ...(input.industries !== undefined && { industries: JSON.stringify(input.industries) }),
      ...(input.employeeRanges !== undefined && { employeeRanges: JSON.stringify(input.employeeRanges) }),
      ...(input.ownerId !== undefined && { ownerId: input.ownerId }),
      ...(input.teamId !== undefined && { teamId: input.teamId }),
    },
  });
}

export async function deleteTerritory(orgId: string, id: string) {
  const existing = await prisma.territory.findFirst({ where: { id, orgId } });
  if (!existing) throw Object.assign(new Error('Territory not found'), { status: 404 });
  return prisma.territory.delete({ where: { id } });
}

/* ── Territory Matching ─────────────────────────────────────── */

export interface MatchInput {
  country?: string;
  state?: string;
  city?: string;
  zipCode?: string;
  industry?: string;
  employeeCount?: number;
}

function matchesJsonArray(jsonArr: string, value: string | undefined): boolean {
  if (!value) return false;
  try {
    const arr = JSON.parse(jsonArr) as string[];
    if (arr.length === 0) return false;
    return arr.some((v) => v.toLowerCase() === value.toLowerCase());
  } catch { return false; }
}

function matchesEmployeeRange(jsonArr: string, count: number | undefined): boolean {
  if (!count) return false;
  try {
    const ranges = JSON.parse(jsonArr) as string[];
    if (ranges.length === 0) return false;
    return ranges.some((range) => {
      if (range.includes('+')) {
        const min = parseInt(range);
        return count >= min;
      }
      const [min, max] = range.split('-').map(Number);
      return count >= min && count <= max;
    });
  } catch { return false; }
}

export function findMatchingTerritory(territories: any[], input: MatchInput): any | null {
  // Score each territory by how many criteria match
  let bestMatch = null;
  let bestScore = 0;

  for (const t of territories) {
    let score = 0;
    let total = 0;

    if (matchesJsonArray(t.countries, input.country)) score++;
    total++;
    if (matchesJsonArray(t.states, input.state)) score++;
    total++;
    if (matchesJsonArray(t.cities, input.city)) score++;
    total++;
    if (matchesJsonArray(t.industries, input.industry)) score++;
    total++;
    if (matchesEmployeeRange(t.employeeRanges, input.employeeCount)) score++;
    total++;

    // Only match if at least one criterion matches
    if (score > 0 && score > bestScore) {
      bestScore = score;
      bestMatch = t;
    }
  }

  return bestMatch;
}

/* ── Account Ownership ──────────────────────────────────────── */

export interface OwnershipInput {
  entityType: string;
  entityId: string;
  ownerId: string;
  coOwnerId?: string;
  territoryId?: string;
  changeReason?: string;
}

export async function assignOwnership(orgId: string, actorId: string, input: OwnershipInput) {
  // Deactivate any existing active ownership for this entity
  await prisma.accountOwnership.updateMany({
    where: {
      orgId,
      entityType: input.entityType,
      entityId: input.entityId,
      isActive: true,
    },
    data: { isActive: false, lostAt: new Date(), lostReason: 'Reassigned' },
  });

  return prisma.accountOwnership.create({
    data: {
      orgId,
      entityType: input.entityType,
      entityId: input.entityId,
      ownerId: input.ownerId,
      coOwnerId: input.coOwnerId || null,
      territoryId: input.territoryId || null,
      changedBy: actorId,
      changeReason: input.changeReason || 'Initial assignment',
    },
  });
}

export async function transferOwnership(orgId: string, actorId: string, ownershipId: string, newOwnerId: string, reason?: string) {
  const existing = await prisma.accountOwnership.findFirst({ where: { id: ownershipId, orgId, isActive: true } });
  if (!existing) throw Object.assign(new Error('Active ownership not found'), { status: 404 });

  // Close current ownership
  await prisma.accountOwnership.update({
    where: { id: ownershipId },
    data: { isActive: false, lostAt: new Date(), lostReason: reason || 'Transferred' },
  });

  // Create new ownership
  return prisma.accountOwnership.create({
    data: {
      orgId,
      entityType: existing.entityType,
      entityId: existing.entityId,
      ownerId: newOwnerId,
      coOwnerId: existing.coOwnerId,
      territoryId: existing.territoryId,
      changedBy: actorId,
      changeReason: reason || 'Transfer',
    },
  });
}

export async function getOwnershipHistory(orgId: string, entityType: string, entityId: string) {
  return prisma.accountOwnership.findMany({
    where: { orgId, entityType, entityId },
    orderBy: { createdAt: 'desc' },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      coOwner: { select: { id: true, name: true, email: true } },
      territory: { select: { id: true, name: true } },
    },
  });
}

export async function getOwnerAccounts(orgId: string, userId: string) {
  return prisma.accountOwnership.findMany({
    where: { orgId, ownerId: userId, isActive: true },
    include: {
      territory: { select: { id: true, name: true } },
      coOwner: { select: { id: true, name: true } },
    },
  });
}

export async function getUnownedEntities(orgId: string, entityType: string) {
  const ownedEntityIds = (await prisma.accountOwnership.findMany({
    where: { orgId, entityType, isActive: true },
    select: { entityId: true },
  })).map((o) => o.entityId);

  if (entityType === 'COMPANY') {
    return prisma.company.findMany({
      where: { orgId, deletedAt: null, id: { notIn: ownedEntityIds } },
      select: { id: true, name: true, domain: true, industry: true, country: true, employeeCount: true },
      take: 50,
    });
  }

  return prisma.lead.findMany({
    where: { orgId, deletedAt: null, id: { notIn: ownedEntityIds } },
    select: { id: true, name: true, company: true, email: true, source: true },
    take: 50,
  });
}
