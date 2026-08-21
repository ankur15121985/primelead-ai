/**
 * Website Visitor Tracking (Phase 11, spec §25).
 *
 * First-party cookie-based visitor identification.
 * Tracks page visits, UTM params, referrer, and assigns visit scores.
 * Company identification where technically and legally available.
 *
 * Privacy: respects consent requirements. Does not promise individual
 * identification when only company-level data is available from IP.
 */
import { prisma } from '../lib/prisma';

// ── Track Visit ─────────────────────────────────────────────

export async function trackVisit(
  orgId: string,
  data: {
    anonymousId: string;
    pageUrl: string;
    pageTitle?: string;
    referrer?: string;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    utmContent?: string;
    ipAddress?: string;
    userAgent?: string;
    country?: string;
    city?: string;
    companyId?: string;
    leadId?: string;
    contactId?: string;
    sessionId?: string;
  }
) {
  // Calculate visit score based on engagement signals
  let score = 0;

  // Page type scoring
  if (data.pageUrl.includes('/pricing')) score += 30;
  else if (data.pageUrl.includes('/demo') || data.pageUrl.includes('/trial')) score += 25;
  else if (data.pageUrl.includes('/contact')) score += 20;
  else if (data.pageUrl.includes('/features')) score += 15;
  else if (data.pageUrl.includes('/case-study') || data.pageUrl.includes('/testimonial')) score += 20;
  else if (data.pageUrl.includes('/blog')) score += 5;

  // UTM source scoring
  if (data.utmSource) score += 10;
  if (data.utmCampaign) score += 5;

  // Returning visitor
  const previousVisits = await prisma.websiteVisit.count({
    where: { orgId, anonymousId: data.anonymousId },
  });
  if (previousVisits > 0) score += Math.min(previousVisits * 5, 25);

  // Company identified
  if (data.companyId) score += 20;

  // Matched to lead/contact
  if (data.leadId || data.contactId) score += 15;

  const visit = await prisma.websiteVisit.create({
    data: {
      orgId,
      anonymousId: data.anonymousId,
      companyId: data.companyId || null,
      sessionId: data.sessionId || null,
      pageUrl: data.pageUrl,
      pageTitle: data.pageTitle || null,
      referrer: data.referrer || null,
      utmSource: data.utmSource || null,
      utmMedium: data.utmMedium || null,
      utmCampaign: data.utmCampaign || null,
      utmContent: data.utmContent || null,
      ipAddress: data.ipAddress || null,
      userAgent: data.userAgent || null,
      country: data.country || null,
      city: data.city || null,
      visitScore: Math.min(100, score),
      isIdentified: Boolean(data.leadId || data.contactId || data.companyId),
      leadId: data.leadId || null,
      contactId: data.contactId || null,
    },
  });

  return visit;
}

// ── Query Visits ────────────────────────────────────────────

export async function getVisits(
  orgId: string,
  filters: {
    companyId?: string;
    isIdentified?: boolean;
    startDate?: Date;
    endDate?: Date;
    minScore?: number;
    limit?: number;
    offset?: number;
  }
) {
  const where: Record<string, unknown> = { orgId };
  if (filters.companyId) where.companyId = filters.companyId;
  if (filters.isIdentified !== undefined) where.isIdentified = filters.isIdentified;
  if (filters.minScore) where.visitScore = { gte: filters.minScore };
  if (filters.startDate || filters.endDate) {
    where.visitedAt = {};
    if (filters.startDate) (where.visitedAt as any).gte = filters.startDate;
    if (filters.endDate) (where.visitedAt as any).lte = filters.endDate;
  }

  const [visits, total] = await Promise.all([
    prisma.websiteVisit.findMany({
      where,
      orderBy: { visitedAt: 'desc' },
      take: filters.limit || 50,
      skip: filters.offset || 0,
      include: { company: { select: { id: true, name: true, domain: true } } },
    }),
    prisma.websiteVisit.count({ where }),
  ]);

  return { visits, total };
}

export async function getVisitorStats(orgId: string, days: number = 30) {
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [totalVisits, uniqueVisitors, identifiedVisits, byPage, bySource, highScoreVisits, recentVisits] =
    await Promise.all([
      prisma.websiteVisit.count({ where: { orgId, visitedAt: { gte: startDate } } }),
      prisma.websiteVisit.groupBy({
        by: ['anonymousId'],
        where: { orgId, visitedAt: { gte: startDate } },
        _count: { _all: true },
      }),
      prisma.websiteVisit.count({ where: { orgId, isIdentified: true, visitedAt: { gte: startDate } } }),
      prisma.websiteVisit.groupBy({
        by: ['pageUrl'],
        where: { orgId, visitedAt: { gte: startDate } },
        _count: { _all: true },
        orderBy: { _count: { pageUrl: 'desc' } },
        take: 10,
      }),
      prisma.websiteVisit.groupBy({
        by: ['utmSource'],
        where: { orgId, utmSource: { not: null }, visitedAt: { gte: startDate } },
        _count: { _all: true },
        orderBy: { _count: { utmSource: 'desc' } },
        take: 10,
      }),
      prisma.websiteVisit.findMany({
        where: { orgId, visitScore: { gte: 70 }, visitedAt: { gte: startDate } },
        orderBy: { visitScore: 'desc' },
        take: 20,
        include: { company: { select: { id: true, name: true, domain: true } } },
      }),
      prisma.websiteVisit.findMany({
        where: { orgId, visitedAt: { gte: startDate } },
        orderBy: { visitedAt: 'desc' },
        take: 20,
        include: { company: { select: { id: true, name: true } } },
      }),
    ]);

  return {
    period: `${days}d`,
    totalVisits,
    uniqueVisitors: uniqueVisitors.length,
    identifiedVisits,
    identificationRate: totalVisits > 0 ? Math.round((identifiedVisits / totalVisits) * 100) : 0,
    avgScore: highScoreVisits.length > 0
      ? Math.round(highScoreVisits.reduce((sum, v) => sum + v.visitScore, 0) / highScoreVisits.length)
      : 0,
    byPage: byPage.map((p) => ({ url: p.pageUrl, visits: p._count._all })),
    bySource: bySource.map((s) => ({ source: s.utmSource || 'direct', visits: s._count._all })),
    highScoreVisits,
    recentVisits,
  };
}

// ── Anonymous → Identified Matching ─────────────────────────

/**
 * When a visitor fills out a form or is identified, link their anonymous
 * visits to the identified lead/contact/company.
 */
export async function identifyVisitor(
  orgId: string,
  anonymousId: string,
  identification: { leadId?: string; contactId?: string; companyId?: string }
) {
  const updateData: Record<string, unknown> = { isIdentified: true };
  if (identification.leadId) updateData.leadId = identification.leadId;
  if (identification.contactId) updateData.contactId = identification.contactId;
  if (identification.companyId) updateData.companyId = identification.companyId;

  const result = await prisma.websiteVisit.updateMany({
    where: { orgId, anonymousId, isIdentified: false },
    data: updateData,
  });

  return { identified: result.count };
}
