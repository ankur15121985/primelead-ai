import { prisma } from '../lib/prisma';
import { verifyEmailWaterfall, type VerificationResult } from './data-providers';

export interface BulkVerificationRequest {
  orgId: string;
  entityType: 'company' | 'contact';
  entityIds?: string[]; // specific IDs, or all if empty
  emails?: string[]; // direct email list
}

export interface VerificationSummary {
  total: number;
  verified: number;
  valid: number;
  invalid: number;
  risky: number;
  unknown: number;
  catchAll: number;
  disposable: number;
  results: VerificationResult[];
}

/**
 * Verify a single email address using the waterfall.
 */
export async function verifySingleEmail(orgId: string, email: string): Promise<VerificationResult | null> {
  if (!email || !email.includes('@')) return null;
  return verifyEmailWaterfall(orgId, email.toLowerCase().trim());
}

/**
 * Bulk verify emails from company contacts or direct list.
 */
export async function bulkVerifyEmails(request: BulkVerificationRequest): Promise<VerificationSummary> {
  const { orgId, entityType, entityIds, emails } = request;

  let emailList: { email: string; entityId?: string }[] = [];

  if (emails && emails.length > 0) {
    // Direct email list
    emailList = emails.filter(Boolean).map((e) => ({ email: e.toLowerCase().trim() }));
  } else if (entityType === 'contact') {
    // Fetch from company contacts
    const where: Record<string, unknown> = { orgId, deletedAt: null, email: { not: null } };
    if (entityIds && entityIds.length > 0) {
      where.id = { in: entityIds };
    }
    const contacts = await (prisma as any).companyContact.findMany({
      where,
      select: { id: true, email: true },
      take: 500,
    });
    emailList = contacts.filter((c: any) => c.email).map((c: any) => ({ email: c.email, entityId: c.id }));
  } else {
    // Fetch from companies
    const where: Record<string, unknown> = { orgId, deletedAt: null, emailDomains: { not: null } };
    if (entityIds && entityIds.length > 0) {
      where.id = { in: entityIds };
    }
    const companies = await prisma.company.findMany({
      where,
      select: { id: true, emailDomains: true },
      take: 200,
    });
    for (const c of companies) {
      const domains = c.emailDomains as string[] | null;
      if (domains) {
        for (const d of domains) {
          emailList.push({ email: `info@${d}`, entityId: c.id });
        }
      }
    }
  }

  const results: VerificationResult[] = [];
  let valid = 0, invalid = 0, risky = 0, unknown = 0, catchAll = 0, disposable = 0;

  for (const { email } of emailList) {
    const result = await verifySingleEmail(orgId, email);
    if (result) {
      results.push(result);
      switch (result.status) {
        case 'valid': valid++; break;
        case 'invalid': invalid++; break;
        case 'risky': risky++; break;
        case 'unknown': unknown++; break;
        case 'catch_all': catchAll++; break;
        case 'disposable': disposable++; break;
      }
    }
  }

  return {
    total: emailList.length,
    verified: results.length,
    valid,
    invalid,
    risky,
    unknown,
    catchAll,
    disposable,
    results,
  };
}
