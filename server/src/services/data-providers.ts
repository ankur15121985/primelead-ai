import { prisma } from '../lib/prisma';

// ────────────────────────────────────────────────────────────
// DataProvider interface — every provider implements this
// ────────────────────────────────────────────────────────────

export interface CompanySearchResult {
  name: string;
  domain?: string;
  website?: string;
  industry?: string;
  employeeCount?: number;
  employeeRange?: string;
  revenueRange?: string;
  country?: string;
  city?: string;
  state?: string;
  description?: string;
  foundedYear?: number;
  technologies?: string[];
  socialProfiles?: Record<string, string>;
  phone?: string;
  fundingTotal?: number;
  confidence: number;
  sourceId?: string;
}

export interface ContactSearchResult {
  firstName: string;
  lastName?: string;
  fullName?: string;
  email?: string;
  emailStatus?: string;
  phone?: string;
  mobile?: string;
  jobTitle?: string;
  department?: string;
  seniority?: string;
  location?: string;
  linkedinUrl?: string;
  companyId?: string;
  companyName?: string;
  confidence: number;
  sourceId?: string;
}

export interface EnrichmentResult {
  field: string;
  value: string | number | null;
  source: string;
  sourceId?: string;
  confidence: number;
  collectedAt: Date;
}

export interface VerificationResult {
  email: string;
  status: 'valid' | 'invalid' | 'risky' | 'unknown' | 'catch_all' | 'disposable';
  confidence: number;
  source: string;
  checkedAt: Date;
}

export interface DataProviderAdapter {
  name: string;
  type: 'COMPANY_SEARCH' | 'CONTACT_SEARCH' | 'ENRICHMENT' | 'VERIFICATION' | 'INTENT';

  searchCompanies?(query: string, filters?: Record<string, unknown>): Promise<CompanySearchResult[]>;
  searchContacts?(query: string, filters?: Record<string, unknown>): Promise<ContactSearchResult[]>;
  enrichCompany?(domain: string): Promise<EnrichmentResult[]>;
  enrichContact?(email: string): Promise<EnrichmentResult[]>;
  verifyEmail?(email: string): Promise<VerificationResult>;
}

// ────────────────────────────────────────────────────────────
// Demo provider — used when no real provider is configured
// ────────────────────────────────────────────────────────────

export class DemoDataProvider implements DataProviderAdapter {
  name = 'demo';
  type = 'COMPANY_SEARCH' as const;

  async searchCompanies(query: string): Promise<CompanySearchResult[]> {
    // Return empty — never fabricate data
    return [];
  }

  async searchContacts(query: string): Promise<ContactSearchResult[]> {
    return [];
  }

  async enrichCompany(domain: string): Promise<EnrichmentResult[]> {
    return [];
  }

  async enrichContact(email: string): Promise<EnrichmentResult[]> {
    return [];
  }

  async verifyEmail(email: string): Promise<VerificationResult> {
    return {
      email,
      status: 'unknown',
      confidence: 0,
      source: 'demo',
      checkedAt: new Date(),
    };
  }
}

// ────────────────────────────────────────────────────────────
// Waterfall enrichment — tries providers in priority order
// ────────────────────────────────────────────────────────────

const providerRegistry = new Map<string, DataProviderAdapter>();

export function registerProvider(adapter: DataProviderAdapter) {
  providerRegistry.set(adapter.name, adapter);
}

export function getProvider(name: string): DataProviderAdapter | undefined {
  return providerRegistry.get(name);
}

// Register the demo provider by default
registerProvider(new DemoDataProvider());

/**
 * Waterfall company enrichment — tries providers in priority order until
 * at least one field is enriched.
 */
export async function enrichCompanyWaterfall(
  orgId: string,
  domain: string,
): Promise<{ results: EnrichmentResult[]; provider: string } | null> {
  const providers = await prisma.dataProvider.findMany({
    where: {
      orgId,
      type: { in: ['ENRICHMENT', 'COMPANY_SEARCH'] },
      enabled: true,
    },
    orderBy: { priority: 'desc' },
  });

  for (const p of providers) {
    const adapter = getProvider(p.name);
    if (!adapter?.enrichCompany) continue;

    try {
      const results = await adapter.enrichCompany(domain);
      if (results.length > 0) {
        // Record provenance for each enriched field
        for (const r of results) {
          await recordProvenance(orgId, {
            entityType: 'COMPANY',
            entityId: '', // caller must set this
            fieldName: r.field,
            value: r.value != null ? String(r.value) : null,
            source: r.source,
            sourceId: r.sourceId,
            confidence: r.confidence,
            providerId: p.id,
          });
        }
        return { results, provider: p.name };
      }
    } catch {
      // Provider failed — try next one
      await prisma.dataProvider.update({
        where: { id: p.id },
        data: { lastError: 'Enrichment failed', status: 'ERROR' },
      });
    }
  }

  return null;
}

/**
 * Waterfall email verification — tries verification providers in priority order.
 */
export async function verifyEmailWaterfall(
  orgId: string,
  email: string,
): Promise<VerificationResult | null> {
  const providers = await prisma.dataProvider.findMany({
    where: {
      orgId,
      type: 'VERIFICATION',
      enabled: true,
    },
    orderBy: { priority: 'desc' },
  });

  for (const p of providers) {
    const adapter = getProvider(p.name);
    if (!adapter?.verifyEmail) continue;

    try {
      const result = await adapter.verifyEmail(email);
      if (result.status !== 'unknown') {
        return result;
      }
    } catch {
      await prisma.dataProvider.update({
        where: { id: p.id },
        data: { lastError: 'Verification failed', status: 'ERROR' },
      });
    }
  }

  return null;
}

// ────────────────────────────────────────────────────────────
// Data Provenance recording
// ────────────────────────────────────────────────────────────

interface ProvenanceInput {
  entityType: string;
  entityId: string;
  fieldName: string;
  value: string | null;
  source: string;
  sourceId?: string;
  confidence: number;
  providerId?: string;
  expiresAt?: Date;
}

export async function recordProvenance(orgId: string, input: ProvenanceInput) {
  return prisma.dataProvenance.create({
    data: {
      orgId,
      providerId: input.providerId || null,
      entityType: input.entityType,
      entityId: input.entityId,
      fieldName: input.fieldName,
      value: input.value,
      source: input.source,
      sourceId: input.sourceId || null,
      confidence: input.confidence,
      collectedAt: new Date(),
      expiresAt: input.expiresAt || null,
    },
  });
}

/**
 * Get all provenance records for an entity.
 */
export async function getProvenance(
  orgId: string,
  entityType: string,
  entityId: string,
) {
  return prisma.dataProvenance.findMany({
    where: { orgId, entityType, entityId },
    orderBy: { collectedAt: 'desc' },
    include: { provider: { select: { name: true, type: true } } },
  });
}

/**
 * Get the latest provenance for a specific field.
 */
export async function getFieldProvenance(
  orgId: string,
  entityType: string,
  entityId: string,
  fieldName: string,
) {
  return prisma.dataProvenance.findFirst({
    where: { orgId, entityType, entityId, fieldName },
    orderBy: { collectedAt: 'desc' },
    include: { provider: { select: { name: true, type: true } } },
  });
}
