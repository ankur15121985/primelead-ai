import { prisma } from '../lib/prisma';

export interface QualityIssue {
  type: 'duplicate' | 'stale' | 'missing_field' | 'invalid_email' | 'conflict' | 'unverified';
  entityType: 'company' | 'contact';
  entityId: string;
  entityName: string;
  field?: string;
  severity: 'high' | 'medium' | 'low';
  description: string;
  relatedIds?: string[];
}

export interface QualityReport {
  generatedAt: string;
  companies: { total: number; issues: number };
  contacts: { total: number; issues: number };
  issues: QualityIssue[];
  summary: {
    duplicates: number;
    stale: number;
    missingFields: number;
    invalidEmails: number;
    unverified: number;
  };
}

/**
 * Scan for duplicate companies (same domain, different IDs).
 */
async function findDuplicateCompanies(orgId: string): Promise<QualityIssue[]> {
  const companies = await prisma.company.findMany({
    where: { orgId, deletedAt: null, domain: { not: null } },
    select: { id: true, name: true, domain: true },
  });

  const domainMap = new Map<string, typeof companies>();
  for (const c of companies) {
    if (!c.domain) continue;
    const existing = domainMap.get(c.domain) || [];
    existing.push(c);
    domainMap.set(c.domain, existing);
  }

  const issues: QualityIssue[] = [];
  for (const [, group] of domainMap) {
    if (group.length > 1) {
      for (const c of group) {
        issues.push({
          type: 'duplicate',
          entityType: 'company',
          entityId: c.id,
          entityName: c.name,
          severity: 'high',
          description: `Duplicate domain "${c.domain}" found with ${group.length} companies`,
          relatedIds: group.filter((g: { id: string }) => g.id !== c.id).map((g: { id: string }) => g.id),
        });
      }
    }
  }

  return issues;
}

/**
 * Scan for duplicate contacts (same email, different IDs).
 */
async function findDuplicateContacts(orgId: string): Promise<QualityIssue[]> {
  const contacts = await (prisma as any).companyContact.findMany({
    where: { orgId, deletedAt: null, email: { not: null } },
    select: { id: true, firstName: true, lastName: true, email: true },
  });

  const emailMap = new Map<string, typeof contacts>();
  for (const c of contacts) {
    if (!c.email) continue;
    const existing = emailMap.get(c.email) || [];
    existing.push(c);
    emailMap.set(c.email, existing);
  }

  const issues: QualityIssue[] = [];
  for (const [, group] of emailMap) {
    if (group.length > 1) {
      for (const c of group) {
        issues.push({
          type: 'duplicate',
          entityType: 'contact',
          entityId: c.id,
          entityName: [c.firstName, c.lastName].filter(Boolean).join(' '),
          severity: 'high',
          description: `Duplicate email "${c.email}" found with ${group.length} contacts`,
          relatedIds: group.filter((g: { id: string }) => g.id !== c.id).map((g: { id: string }) => g.id),
        });
      }
    }
  }

  return issues;
}

/**
 * Find contacts with missing critical fields.
 */
async function findMissingFields(orgId: string): Promise<QualityIssue[]> {
  const issues: QualityIssue[] = [];

  // Companies missing industry
  const missingIndustry = await prisma.company.count({
    where: { orgId, deletedAt: null, industry: null },
  });
  if (missingIndustry > 0) {
    const samples = await prisma.company.findMany({
      where: { orgId, deletedAt: null, industry: null },
      select: { id: true, name: true },
      take: 5,
    });
    for (const s of samples) {
      issues.push({
        type: 'missing_field',
        entityType: 'company',
        entityId: s.id,
        entityName: s.name,
        field: 'industry',
        severity: 'low',
        description: 'Missing industry classification',
      });
    }
  }

  // Companies missing country
  const missingCountry = await prisma.company.count({
    where: { orgId, deletedAt: null, country: null },
  });
  if (missingCountry > 0) {
    const samples = await prisma.company.findMany({
      where: { orgId, deletedAt: null, country: null },
      select: { id: true, name: true },
      take: 3,
    });
    for (const s of samples) {
      issues.push({
        type: 'missing_field',
        entityType: 'company',
        entityId: s.id,
        entityName: s.name,
        field: 'country',
        severity: 'low',
        description: 'Missing country/location',
      });
    }
  }

  // Contacts missing job title
  const missingTitle = await (prisma as any).companyContact.count({
    where: { orgId, deletedAt: null, jobTitle: null },
  });
  if (missingTitle > 0) {
    const samples = await (prisma as any).companyContact.findMany({
      where: { orgId, deletedAt: null, jobTitle: null },
      select: { id: true, firstName: true, lastName: true },
      take: 3,
    });
    for (const s of samples) {
      issues.push({
        type: 'missing_field',
        entityType: 'contact',
        entityId: s.id,
        entityName: [s.firstName, s.lastName].filter(Boolean).join(' '),
        field: 'jobTitle',
        severity: 'medium',
        description: 'Missing job title — limits persona matching',
      });
    }
  }

  return issues;
}

/**
 * Find contacts with unverified emails.
 */
async function findUnverifiedEmails(orgId: string): Promise<QualityIssue[]> {
  const contacts = await (prisma as any).companyContact.findMany({
    where: { orgId, deletedAt: null, email: { not: null }, emailStatus: null },
    select: { id: true, firstName: true, lastName: true, email: true },
    take: 10,
  });

  return contacts.map((c: any) => ({
    type: 'unverified' as const,
    entityType: 'contact' as const,
    entityId: c.id,
    entityName: [c.firstName, c.lastName].filter(Boolean).join(' '),
    field: 'emailStatus',
    severity: 'medium' as const,
    description: `Email "${c.email}" has not been verified`,
  }));
}

/**
 * Find stale contacts (not updated in 90+ days).
 */
async function findStaleContacts(orgId: string): Promise<QualityIssue[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);

  const stale = await (prisma as any).companyContact.findMany({
    where: { orgId, deletedAt: null, updatedAt: { lt: cutoff } },
    select: { id: true, firstName: true, lastName: true, updatedAt: true },
    take: 10,
  });

  return stale.map((c: any) => ({
    type: 'stale' as const,
    entityType: 'contact' as const,
    entityId: c.id,
    entityName: [c.firstName, c.lastName].filter(Boolean).join(' '),
    severity: 'low' as const,
    description: `Not updated since ${c.updatedAt.toLocaleDateString()}`,
  }));
}

/**
 * Generate a full data quality report.
 */
export async function generateQualityReport(orgId: string): Promise<QualityReport> {
  const [companyCount, contactCount, dupCompanies, dupContacts, missingFields, unverified, stale] = await Promise.all([
    prisma.company.count({ where: { orgId, deletedAt: null } }),
    (prisma as any).companyContact.count({ where: { orgId, deletedAt: null } }),
    findDuplicateCompanies(orgId),
    findDuplicateContacts(orgId),
    findMissingFields(orgId),
    findUnverifiedEmails(orgId),
    findStaleContacts(orgId),
  ]);

  const allIssues = [...dupCompanies, ...dupContacts, ...missingFields, ...unverified, ...stale];

  return {
    generatedAt: new Date().toISOString(),
    companies: { total: companyCount, issues: dupCompanies.length + missingFields.filter((i) => i.entityType === 'company').length },
    contacts: { total: contactCount, issues: dupContacts.length + unverified.length + stale.length + missingFields.filter((i) => i.entityType === 'contact').length },
    issues: allIssues,
    summary: {
      duplicates: dupCompanies.length + dupContacts.length,
      stale: stale.length,
      missingFields: missingFields.length,
      invalidEmails: 0,
      unverified: unverified.length,
    },
  };
}
