import { prisma } from '../lib/prisma';

/** Normalise phone numbers for comparison (strip spaces, dashes, parens, leading +). */
function normPhone(p: string | null | undefined): string {
  if (!p) return '';
  return p.replace(/[\s\-().+]/g, '').slice(-10); // last 10 digits
}

function normEmail(e: string | null | undefined): string {
  if (!e) return '';
  return e.toLowerCase().trim();
}

function normDomain(d: string | null | undefined): string {
  if (!d) return '';
  return d.replace(/^www\./, '').toLowerCase().trim();
}

interface DuplicateGroup {
  field: string;
  value: string;
  entityType: string;
  records: Array<{ id: string; name: string; [k: string]: unknown }>;
}

/**
 * Detect duplicates among leads within an org.
 * Groups by email, phone, and name+company.
 */
export async function detectLeadDuplicates(orgId: string) {
  // 1. Duplicate emails
  const leadsWithEmail = await prisma.lead.findMany({
    where: { orgId, deletedAt: null, email: { not: null } },
    select: { id: true, name: true, email: true, phone: true, company: true, score: true, createdAt: true, status: true, ownerId: true },
  });
  const emailMap = new Map<string, typeof leadsWithEmail>();
  for (const l of leadsWithEmail) {
    const key = normEmail(l.email);
    if (!key) continue;
    if (!emailMap.has(key)) emailMap.set(key, []);
    emailMap.get(key)!.push(l);
  }
  const emailGroups: DuplicateGroup[] = [];
  for (const [email, records] of emailMap) {
    if (records.length > 1) {
      emailGroups.push({ field: 'email', value: email, entityType: 'LEAD', records });
    }
  }

  // 2. Duplicate phones
  const leadsWithPhone = await prisma.lead.findMany({
    where: { orgId, deletedAt: null, phone: { not: null } },
    select: { id: true, name: true, email: true, phone: true, company: true, score: true, createdAt: true, status: true, ownerId: true },
  });
  const phoneMap = new Map<string, typeof leadsWithPhone>();
  for (const l of leadsWithPhone) {
    const key = normPhone(l.phone);
    if (!key || key.length < 6) continue;
    if (!phoneMap.has(key)) phoneMap.set(key, []);
    phoneMap.get(key)!.push(l);
  }
  const phoneGroups: DuplicateGroup[] = [];
  for (const [phone, records] of phoneMap) {
    if (records.length > 1) {
      phoneGroups.push({ field: 'phone', value: phone, entityType: 'LEAD', records });
    }
  }

  // 3. Duplicate contacts by email
  const contactsWithEmail = await prisma.contact.findMany({
    where: { orgId, email: { not: null } },
    select: { id: true, name: true, email: true, phone: true, company: true, createdAt: true },
  });
  const cEmailMap = new Map<string, typeof contactsWithEmail>();
  for (const c of contactsWithEmail) {
    const key = normEmail(c.email);
    if (!key) continue;
    if (!cEmailMap.has(key)) cEmailMap.set(key, []);
    cEmailMap.get(key)!.push(c);
  }
  const contactEmailGroups: DuplicateGroup[] = [];
  for (const [email, records] of cEmailMap) {
    if (records.length > 1) {
      contactEmailGroups.push({ field: 'email', value: email, entityType: 'CONTACT', records });
    }
  }

  // 4. Duplicate companies by domain
  const companies = await prisma.company.findMany({
    where: { orgId, deletedAt: null, domain: { not: null } },
    select: { id: true, name: true, domain: true, website: true, employeeCount: true, industry: true, createdAt: true },
  });
  const domainMap = new Map<string, typeof companies>();
  for (const c of companies) {
    const key = normDomain(c.domain);
    if (!key) continue;
    if (!domainMap.has(key)) domainMap.set(key, []);
    domainMap.get(key)!.push(c);
  }
  const companyGroups: DuplicateGroup[] = [];
  for (const [domain, records] of domainMap) {
    if (records.length > 1) {
      companyGroups.push({ field: 'domain', value: domain, entityType: 'COMPANY', records });
    }
  }

  return {
    totalGroups: emailGroups.length + phoneGroups.length + contactEmailGroups.length + companyGroups.length,
    leads: { byEmail: emailGroups, byPhone: phoneGroups },
    contacts: { byEmail: contactEmailGroups },
    companies: { byDomain: companyGroups },
  };
}

/**
 * Merge two leads — the "winner" keeps its data; the "loser" gets soft-deleted
 * and its activities/tasks/quotations are reassigned to the winner.
 */
export async function mergeLeads(orgId: string, winnerId: string, loserId: string) {
  if (winnerId === loserId) throw Object.assign(new Error('Cannot merge a lead with itself.'), { status: 400 });

  const [winner, loser] = await Promise.all([
    prisma.lead.findFirst({ where: { id: winnerId, orgId, deletedAt: null } }),
    prisma.lead.findFirst({ where: { id: loserId, orgId, deletedAt: null } }),
  ]);
  if (!winner || !loser) throw Object.assign(new Error('Lead not found.'), { status: 404 });

  // Winner gets the best data from loser (fill blanks)
  const patch: Record<string, unknown> = {};
  if (!winner.email && loser.email) patch.email = loser.email;
  if (!winner.phone && loser.phone) patch.phone = loser.phone;
  if (!winner.company && loser.company) patch.company = loser.company;
  if (loser.score > winner.score) patch.score = loser.score;
  if (loser.expectedValue > winner.expectedValue) patch.expectedValue = loser.expectedValue;
  if (!winner.notes && loser.notes) patch.notes = loser.notes;

  // Merge tags
  const wTags = Array.isArray(winner.tags) ? winner.tags : [];
  const lTags = Array.isArray(loser.tags) ? loser.tags : [];
  if (lTags.length > 0) patch.tags = [...new Set([...(wTags as string[]), ...(lTags as string[])])];

  // Execute merge within a transaction
  await prisma.$transaction(async (tx) => {
    // Update winner with merged data
    if (Object.keys(patch).length > 0) {
      await tx.lead.update({ where: { id: winnerId }, data: patch });
    }

    // Reassign loser's related records to winner
    await Promise.all([
      tx.activity.updateMany({ where: { leadId: loserId }, data: { leadId: winnerId } }),
      tx.task.updateMany({ where: { leadId: loserId }, data: { leadId: winnerId } }),
      tx.quotation.updateMany({ where: { leadId: loserId }, data: { leadId: winnerId } }),
      tx.invoice.updateMany({ where: { leadId: loserId }, data: { leadId: winnerId } }),
      tx.conversation.updateMany({ where: { leadId: loserId }, data: { leadId: winnerId } }),
      tx.meeting.updateMany({ where: { leadId: loserId }, data: { leadId: winnerId } }),
      tx.contact.updateMany({ where: { leadId: loserId }, data: { leadId: winnerId } }),
    ]);

    // Soft-delete the loser
    await tx.lead.update({
      where: { id: loserId },
      data: { deletedAt: new Date(), name: `[MERGED] ${loser.name}` },
    });
  });

  return { winner: { id: winnerId, name: winner.name }, loser: { id: loserId, name: loser.name }, fieldsMerged: Object.keys(patch) };
}

/**
 * Merge two contacts — the "winner" keeps its data; the "loser" is deleted.
 */
export async function mergeContacts(orgId: string, winnerId: string, loserId: string) {
  if (winnerId === loserId) throw Object.assign(new Error('Cannot merge a contact with itself.'), { status: 400 });

  const [winner, loser] = await Promise.all([
    prisma.contact.findFirst({ where: { id: winnerId, orgId } }),
    prisma.contact.findFirst({ where: { id: loserId, orgId } }),
  ]);
  if (!winner || !loser) throw Object.assign(new Error('Contact not found.'), { status: 404 });

  const patch: Record<string, unknown> = {};
  if (!winner.email && loser.email) patch.email = loser.email;
  if (!winner.phone && loser.phone) patch.phone = loser.phone;
  if (!winner.company && loser.company) patch.company = loser.company;
  if (!winner.notes && loser.notes) patch.notes = loser.notes;

  await prisma.$transaction(async (tx) => {
    if (Object.keys(patch).length > 0) {
      await tx.contact.update({ where: { id: winnerId }, data: patch });
    }
    await tx.conversation.updateMany({ where: { contactId: loserId }, data: { contactId: winnerId } });
    await tx.contact.delete({ where: { id: loserId } });
  });

  return { winner: { id: winnerId, name: winner.name }, loser: { id: loserId, name: loser.name }, fieldsMerged: Object.keys(patch) };
}

/**
 * Merge two companies — the "winner" keeps its data; the "loser" is deleted.
 * Related company contacts and website visits are reassigned.
 */
export async function mergeCompanies(orgId: string, winnerId: string, loserId: string) {
  if (winnerId === loserId) throw Object.assign(new Error('Cannot merge a company with itself.'), { status: 400 });

  const [winner, loser] = await Promise.all([
    prisma.company.findFirst({ where: { id: winnerId, orgId, deletedAt: null } }),
    prisma.company.findFirst({ where: { id: loserId, orgId, deletedAt: null } }),
  ]);
  if (!winner || !loser) throw Object.assign(new Error('Company not found.'), { status: 404 });

  const patch: Record<string, unknown> = {};
  if (!winner.website && loser.website) patch.website = loser.website;
  if (!winner.domain && loser.domain) patch.domain = loser.domain;
  if (!winner.industry && loser.industry) patch.industry = loser.industry;
  if (!winner.description && loser.description) patch.description = loser.description;
  if (loser.employeeCount && (!winner.employeeCount || loser.employeeCount > (winner.employeeCount || 0))) patch.employeeCount = loser.employeeCount;
  if (!winner.country && loser.country) patch.country = loser.country;
  if (!winner.city && loser.city) patch.city = loser.city;
  if (!winner.headquarters && loser.headquarters) patch.headquarters = loser.headquarters;

  await prisma.$transaction(async (tx) => {
    if (Object.keys(patch).length > 0) {
      await tx.company.update({ where: { id: winnerId }, data: patch });
    }
    await tx.companyContact.updateMany({ where: { companyId: loserId }, data: { companyId: winnerId } });
    await tx.websiteVisit.updateMany({ where: { companyId: loserId }, data: { companyId: winnerId } });
    await tx.company.update({
      where: { id: loserId },
      data: { deletedAt: new Date(), name: `[MERGED] ${loser.name}` },
    });
  });

  return { winner: { id: winnerId, name: winner.name }, loser: { id: loserId, name: loser.name }, fieldsMerged: Object.keys(patch) };
}
