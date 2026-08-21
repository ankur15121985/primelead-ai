/**
 * AI Research Agent (Phase 10, spec §36-37).
 *
 * Generates structured research reports for companies, contacts, deals,
 * and competitors. Every output section is labelled as FACT, INFERENCE,
 * or AI_SUGGESTION — the UI must show this distinction clearly.
 *
 * Provider-agnostic: uses the same `getAiProvider()` abstraction.
 * Falls back to deterministic rule-based research when no AI key is set.
 */
import { prisma } from '../lib/prisma';
import { getAiProvider } from '../ai/provider';
import { recordAiUsage, assertAiBudget } from './ai-usage';
import type { ChatMessage } from '../ai/provider';

export type ReportType = 'COMPANY_RESEARCH' | 'CONTACT_RESEARCH' | 'DEAL_RESEARCH' | 'COMPETITOR_RESEARCH';

interface ResearchSection {
  key: string;
  title: string;
  content: string;
  label: 'FACT' | 'INFERENCE' | 'AI_SUGGESTION';
}

interface ResearchResult {
  title: string;
  summary: string;
  sections: ResearchSection[];
  sources: Array<{ title: string; url?: string; snippet?: string }>;
  confidence: number;
  tokensUsed: number;
  costPaise: number;
  provider: string;
  model: string;
}

// ── Company Research ────────────────────────────────────────

export async function researchCompany(
  orgId: string,
  companyId: string,
  userId?: string
): Promise<{ report: any; fromCache: boolean }> {
  // Check for recent report (within 24h)
  const recent = await prisma.aiResearchReport.findFirst({
    where: { orgId, companyId, reportType: 'COMPANY_RESEARCH', createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    orderBy: { createdAt: 'desc' },
  });
  if (recent) return { report: recent, fromCache: true };

  const company = await prisma.company.findFirst({ where: { id: companyId, orgId } });
  if (!company) throw Object.assign(new Error('Company not found'), { status: 404 });

  await assertAiBudget(orgId);

  const provider = await getAiProvider(orgId);
  if (!provider) {
    // Rule-based fallback
    const report = await ruleBasedCompanyResearch(orgId, company, userId);
    return { report, fromCache: false };
  }

  const context = buildCompanyContext(company);
  const system: ChatMessage = {
    role: 'system',
    content: `You are a B2B sales research analyst. Research this company and produce a structured report.
Return JSON with this exact structure:
{
  "title": "Company Research: <name>",
  "summary": "2-3 sentence executive summary",
  "sections": [
    { "key": "overview", "title": "Company Overview", "content": "...", "label": "FACT" },
    { "key": "business_model", "title": "Business Model", "content": "...", "label": "INFERENCE" },
    { "key": "pain_points", "title": "Potential Pain Points", "content": "...", "label": "AI_SUGGESTION" },
    { "key": "stakeholders", "title": "Key Stakeholders", "content": "...", "label": "INFERENCE" },
    { "key": "signals", "title": "Buying Signals", "content": "...", "label": "FACT" },
    { "key": "messaging", "title": "Suggested Messaging", "content": "...", "label": "AI_SUGGESTION" }
  ],
  "confidence": 0.7
}
Label each section accurately: FACT (from provided data), INFERENCE (reasonable deduction), AI_SUGGESTION (recommendation).
Never fabricate facts. Use only the provided context.`,
  };

  const user: ChatMessage = { role: 'user', content: context };
  const started = Date.now();
  const result = await provider.generateText([system, user], { temperature: 0.4, maxTokens: 1500 });

  await recordAiUsage({
    orgId, userId, category: 'OTHER',
    provider: provider.name, model: provider.model || null,
    usage: result.usage, latencyMs: Date.now() - started,
  });

  let parsed: any;
  try {
    // Extract JSON from response (may be wrapped in markdown code block)
    const jsonMatch = result.text.match(/\{[\s\S]*\}/);
    parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { title: `Research: ${company.name}`, summary: result.text.slice(0, 500), sections: [], confidence: 0.5 };
  } catch {
    parsed = { title: `Research: ${company.name}`, summary: result.text.slice(0, 500), sections: [], confidence: 0.5 };
  }

  const report = await prisma.aiResearchReport.create({
    data: {
      orgId,
      userId: userId || null,
      reportType: 'COMPANY_RESEARCH',
      companyId,
      title: parsed.title || `Research: ${company.name}`,
      summary: parsed.summary || null,
      sections: (parsed.sections || []) as any,
      confidence: parsed.confidence || 0.5,
      tokensUsed: result.usage?.totalTokens || 0,
      costPaise: 0, // Calculated by recordAiUsage
      provider: provider.name,
      model: provider.model || null,
    },
  });

  return { report, fromCache: false };
}

// ── Contact Research ────────────────────────────────────────

export async function researchContact(
  orgId: string,
  contactId: string,
  userId?: string
): Promise<{ report: any; fromCache: boolean }> {
  const recent = await prisma.aiResearchReport.findFirst({
    where: { orgId, contactId, reportType: 'CONTACT_RESEARCH', createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    orderBy: { createdAt: 'desc' },
  });
  if (recent) return { report: recent, fromCache: true };

  const contact = await prisma.companyContact.findFirst({ where: { id: contactId, orgId } });
  if (!contact) throw Object.assign(new Error('Contact not found'), { status: 404 });

  await assertAiBudget(orgId);

  const provider = await getAiProvider(orgId);
  if (!provider) {
    const report = await ruleBasedContactResearch(orgId, contact, userId);
    return { report, fromCache: false };
  }

  const context = buildContactContext(contact);
  const system: ChatMessage = {
    role: 'system',
    content: `You are a B2B sales research analyst. Research this contact and produce a structured report.
Return JSON with this exact structure:
{
  "title": "Contact Research: <name>",
  "summary": "2-3 sentence executive summary",
  "sections": [
    { "key": "profile", "title": "Professional Profile", "content": "...", "label": "FACT" },
    { "key": "pain_points", "title": "Potential Pain Points", "content": "...", "label": "INFERENCE" },
    { "key": "engagement", "title": "Engagement Strategy", "content": "...", "label": "AI_SUGGESTION" },
    { "key": "talking_points", "title": "Talking Points", "content": "...", "label": "AI_SUGGESTION" }
  ],
  "confidence": 0.7
}
Label each section accurately. Never fabricate facts.`,
  };

  const user: ChatMessage = { role: 'user', content: context };
  const started = Date.now();
  const result = await provider.generateText([system, user], { temperature: 0.4, maxTokens: 1200 });

  await recordAiUsage({
    orgId, userId, category: 'OTHER',
    provider: provider.name, model: provider.model || null,
    usage: result.usage, latencyMs: Date.now() - started,
  });

  let parsed: any;
  try {
    const jsonMatch = result.text.match(/\{[\s\S]*\}/);
    parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { title: `Research: ${contact.firstName} ${contact.lastName}`, summary: result.text.slice(0, 500), sections: [], confidence: 0.5 };
  } catch {
    parsed = { title: `Research: ${contact.firstName} ${contact.lastName}`, summary: result.text.slice(0, 500), sections: [], confidence: 0.5 };
  }

  const report = await prisma.aiResearchReport.create({
    data: {
      orgId,
      userId: userId || null,
      reportType: 'CONTACT_RESEARCH',
      contactId,
      title: parsed.title || `Research: ${contact.firstName} ${contact.lastName}`,
      summary: parsed.summary || null,
      sections: (parsed.sections || []) as any,
      confidence: parsed.confidence || 0.5,
      tokensUsed: result.usage?.totalTokens || 0,
      costPaise: 0,
      provider: provider.name,
      model: provider.model || null,
    },
  });

  return { report, fromCache: false };
}

// ── Get Research Reports ────────────────────────────────────

export async function getResearchReports(
  orgId: string,
  filters: { reportType?: string; companyId?: string; contactId?: string; limit?: number }
) {
  const where: Record<string, unknown> = { orgId };
  if (filters.reportType) where.reportType = filters.reportType;
  if (filters.companyId) where.companyId = filters.companyId;
  if (filters.contactId) where.contactId = filters.contactId;

  return prisma.aiResearchReport.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: filters.limit || 20,
  });
}

export async function deleteResearchReport(orgId: string, reportId: string) {
  const report = await prisma.aiResearchReport.findFirst({ where: { id: reportId, orgId } });
  if (!report) throw Object.assign(new Error('Report not found'), { status: 404 });
  await prisma.aiResearchReport.delete({ where: { id: reportId } });
}

// ── Context Builders ────────────────────────────────────────

function buildCompanyContext(c: any): string {
  return [
    `COMPANY: ${c.name}`,
    c.legalName ? `LEGAL NAME: ${c.legalName}` : null,
    c.website ? `WEBSITE: ${c.website}` : null,
    c.domain ? `DOMAIN: ${c.domain}` : null,
    c.industry ? `INDUSTRY: ${c.industry}` : null,
    c.subIndustry ? `SUB-INDUSTRY: ${c.subIndustry}` : null,
    c.description ? `DESCRIPTION: ${c.description.slice(0, 500)}` : null,
    c.foundedYear ? `FOUNDED: ${c.foundedYear}` : null,
    c.employeeCount ? `EMPLOYEES: ${c.employeeCount}` : null,
    c.employeeRange ? `EMPLOYEE RANGE: ${c.employeeRange}` : null,
    c.revenueRange ? `REVENUE: ${c.revenueRange}` : null,
    c.fundingTotal ? `TOTAL FUNDING: ${c.fundingTotal}` : null,
    c.fundingRounds ? `FUNDING ROUNDS: ${c.fundingRounds}` : null,
    c.headquarters ? `HEADQUARTERS: ${c.headquarters}` : null,
    c.country ? `COUNTRY: ${c.country}` : null,
    c.state ? `STATE: ${c.state}` : null,
    c.city ? `CITY: ${c.city}` : null,
    c.technologies ? `TECHNOLOGIES: ${Array.isArray(c.technologies) ? c.technologies.join(', ') : c.technologies}` : null,
    c.companyType ? `TYPE: ${c.companyType}` : null,
    c.naicsCode ? `NAICS: ${c.naicsCode}` : null,
    c.sicCode ? `SIC: ${c.sicCode}` : null,
    c.linkedinUrl ? `LINKEDIN: ${c.linkedinUrl}` : null,
    c.twitterUrl ? `TWITTER: ${c.twitterUrl}` : null,
  ].filter(Boolean).join('\n');
}

function buildContactContext(c: any): string {
  return [
    `NAME: ${c.firstName} ${c.lastName}`,
    c.jobTitle ? `TITLE: ${c.jobTitle}` : null,
    c.department ? `DEPARTMENT: ${c.department}` : null,
    c.seniority ? `SENIORITY: ${c.seniority}` : null,
    c.email ? `EMAIL: ${c.email}` : null,
    c.emailStatus ? `EMAIL STATUS: ${c.emailStatus}` : null,
    c.phone ? `PHONE: ${c.phone}` : null,
    c.location ? `LOCATION: ${c.location}` : null,
    c.linkedinUrl ? `LINKEDIN: ${c.linkedinUrl}` : null,
    c.yearsAtCompany ? `YEARS AT COMPANY: ${c.yearsAtCompany}` : null,
    c.skills ? `SKILLS: ${Array.isArray(c.skills) ? c.skills.join(', ') : c.skills}` : null,
    c.score ? `LEAD SCORE: ${c.score}` : null,
  ].filter(Boolean).join('\n');
}

// ── Rule-based Fallbacks ────────────────────────────────────

async function ruleBasedCompanyResearch(orgId: string, company: any, userId?: string) {
  const sections: ResearchSection[] = [
    {
      key: 'overview', title: 'Company Overview', label: 'FACT',
      content: [
        `${company.name} is a ${company.industry || '未知行业'} company`,
        company.employeeRange ? `with ${company.employeeRange} employees` : '',
        company.headquarters ? `headquartered in ${company.headquarters}` : '',
        company.country ? `(${company.country})` : '',
        '.',
      ].filter(Boolean).join(' '),
    },
    {
      key: 'business_model', title: 'Business Model', label: 'INFERENCE',
      content: company.description
        ? `Based on their description: "${company.description.slice(0, 200)}"`
        : 'Business model information not available. Visit their website for details.',
    },
    {
      key: 'pain_points', title: 'Potential Pain Points', label: 'AI_SUGGESTION',
      content: [
        company.employeeRange && parseInt(company.employeeRange) < 50 ? 'Small team — likely needs efficient, easy-to-adopt tools.' : null,
        company.fundingTotal ? 'Recently funded — may be investing in growth and scaling.' : null,
        !company.technologies || (Array.isArray(company.technologies) && company.technologies.length < 3) ? 'Limited tech stack visible — may be open to new solutions.' : null,
      ].filter(Boolean).join(' ') || 'Pain point analysis requires more data. Try enriching this company first.',
    },
    {
      key: 'signals', title: 'Available Signals', label: 'FACT',
      content: [
        company.technologies?.length ? `Technologies: ${Array.isArray(company.technologies) ? company.technologies.join(', ') : company.technologies}` : null,
        company.fundingTotal ? `Funding: ${company.fundingTotal}` : null,
        company.foundedYear ? `Founded: ${company.foundedYear}` : null,
      ].filter(Boolean).join('. ') || 'No signals available. Connect a data provider for richer insights.',
    },
  ];

  const report = await prisma.aiResearchReport.create({
    data: {
      orgId, userId: userId || null, reportType: 'COMPANY_RESEARCH',
      companyId: company.id, title: `Research: ${company.name}`,
      summary: `Rule-based research for ${company.name}. Connect an AI provider for deeper insights.`,
      sections: sections as any, confidence: 0.3,
      tokensUsed: 0, costPaise: 0, provider: 'rules', model: null,
    },
  });
  return report;
}

async function ruleBasedContactResearch(orgId: string, contact: any, userId?: string) {
  const sections: ResearchSection[] = [
    {
      key: 'profile', title: 'Professional Profile', label: 'FACT',
      content: [
        `${contact.firstName} ${contact.lastName}`,
        contact.jobTitle ? `works as ${contact.jobTitle}` : '',
        contact.department ? `in the ${contact.department} department` : '',
        contact.seniority ? `(${contact.seniority} level)` : '',
        contact.yearsAtCompany ? `with ${contact.yearsAtCompany} years at the company` : '',
        '.',
      ].filter(Boolean).join(' '),
    },
    {
      key: 'engagement', title: 'Engagement Strategy', label: 'AI_SUGGESTION',
      content: [
        contact.email && contact.emailStatus === 'VALID' ? 'Email verified — good for outreach.' : null,
        contact.linkedinUrl ? 'LinkedIn available — consider connecting there first.' : null,
        contact.seniority === 'C_LEVEL' || contact.seniority === 'VP' ? 'Senior decision-maker — focus on business outcomes and ROI.' : null,
        contact.seniority === 'MANAGER' || contact.seniority === 'DIRECTOR' ? 'Mid-level influencer — emphasize ease of implementation and team benefits.' : null,
      ].filter(Boolean).join(' ') || 'Engagement strategy requires more data about this contact.',
    },
  ];

  const report = await prisma.aiResearchReport.create({
    data: {
      orgId, userId: userId || null, reportType: 'CONTACT_RESEARCH',
      contactId: contact.id, title: `Research: ${contact.firstName} ${contact.lastName}`,
      summary: `Rule-based research for ${contact.firstName} ${contact.lastName}. Connect an AI provider for deeper insights.`,
      sections: sections as any, confidence: 0.3,
      tokensUsed: 0, costPaise: 0, provider: 'rules', model: null,
    },
  });
  return report;
}
