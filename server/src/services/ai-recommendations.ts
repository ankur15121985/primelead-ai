/**
 * AI Recommendation Engine (Phase 10, spec §79).
 *
 * Generates actionable recommendations: next-best-lead, deal risk alerts,
 * cross-sell opportunities, re-engagement targets. Every recommendation
 * includes reasoning and confidence — no black-box scores.
 *
 * Provider-agnostic with deterministic fallbacks.
 */
import { prisma } from '../lib/prisma';
import { getAiProvider } from '../ai/provider';
import { recordAiUsage, assertAiBudget } from './ai-usage';
import { OPEN_STATUSES } from '../constants';
import type { ChatMessage } from '../ai/provider';

export type RecommendationType =
  | 'NEXT_BEST_LEAD'
  | 'NEXT_BEST_ACTION'
  | 'DEAL_RISK'
  | 'CROSS_SELL'
  | 'UPSELL'
  | 'REACTIVATION';

// ── Generate Recommendations ────────────────────────────────

export async function generateRecommendations(
  orgId: string,
  userId: string,
  type?: RecommendationType,
  limit: number = 10
): Promise<any[]> {
  const provider = await getAiProvider(orgId);
  const user = await prisma.user.findFirst({ where: { id: userId, orgId } });
  const role = user?.role || 'SALES';
  const isSales = role === 'SALES';

  // Gather context
  const leadWhere: Record<string, unknown> = isSales
    ? { orgId, ownerId: userId, deletedAt: null, status: { in: [...OPEN_STATUSES] } }
    : { orgId, deletedAt: null, status: { in: [...OPEN_STATUSES] } };

  const staleLeads = await prisma.lead.findMany({
    where: {
      ...leadWhere,
      OR: [
        { lastContactedAt: null },
        { lastContactedAt: { lt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) } },
      ],
    },
    orderBy: { expectedValue: 'desc' },
    take: 20,
    select: { id: true, name: true, company: true, email: true, phone: true, source: true, priority: true, expectedValue: true, status: true, lastContactedAt: true, createdAt: true, ownerId: true },
  });

  const highValueLeads = await prisma.lead.findMany({
    where: { ...leadWhere, expectedValue: { gt: 0 } },
    orderBy: { expectedValue: 'desc' },
    take: 20,
    select: { id: true, name: true, company: true, email: true, source: true, priority: true, expectedValue: true, status: true, stageId: true, lastContactedAt: true, ownerId: true },
  });

  const allOpenLeads = await prisma.lead.findMany({
    where: leadWhere,
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: { id: true, name: true, company: true, source: true, priority: true, expectedValue: true, status: true, lastContactedAt: true, ownerId: true },
  });

  if (provider) {
    try {
      return await aiGenerateRecommendations(orgId, userId, provider, {
        staleLeads, highValueLeads, allOpenLeads, type, limit, role, userName: user?.name || '',
      });
    } catch {
      // Fall through to rule-based
    }
  }

  // Rule-based recommendations
  return ruleBasedRecommendations(orgId, userId, { staleLeads, highValueLeads, allOpenLeads, type, limit, role });
}

async function aiGenerateRecommendations(
  orgId: string,
  userId: string,
  provider: any,
  ctx: {
    staleLeads: any[];
    highValueLeads: any[];
    allOpenLeads: any[];
    type?: RecommendationType;
    limit: number;
    role: string;
    userName: string;
  }
): Promise<any[]> {
  const staleSummary = ctx.staleLeads.slice(0, 10).map((l) =>
    `${l.name}${l.company ? ` (${l.company})` : ''} — ${l.source}, ${l.priority}, ₹${(l.expectedValue / 100).toLocaleString('en-IN')}, last contact: ${l.lastContactedAt ? l.lastContactedAt.toLocaleDateString('en-IN') : 'never'}`
  ).join('\n');

  const highValueSummary = ctx.highValueLeads.slice(0, 10).map((l) =>
    `${l.name}${l.company ? ` (${l.company})` : ''} — ${l.source}, ${l.priority}, ₹${(l.expectedValue / 100).toLocaleString('en-IN')}, status: ${l.status}`
  ).join('\n');

  const typeFilter = ctx.type ? `\nFocus on recommendation type: ${ctx.type}` : '';

  const system: ChatMessage = {
    role: 'system',
    content: `You are a sales intelligence AI. Analyze the open leads and generate exactly ${ctx.limit} actionable recommendations.
Return a JSON array of objects:
[{
  "type": "NEXT_BEST_LEAD" | "NEXT_BEST_ACTION" | "DEAL_RISK" | "CROSS_SELL" | "UPSELL" | "REACTIVATION",
  "entityType": "lead" | "company" | "deal",
  "entityId": "<lead id>",
  "title": "Short action title",
  "reasoning": "Why this recommendation (1-2 sentences)",
  "confidence": 0.0-1.0,
  "priority": "HIGH" | "MEDIUM" | "LOW"
}]
Prioritize by business impact. Be specific with lead names and IDs.${typeFilter}`,
  };

  const userMsg: ChatMessage = {
    role: 'user',
    content: `SALES REP: ${ctx.userName} (${ctx.role})

STALE LEADS (no contact in 3+ days):
${staleSummary || 'None'}

HIGH VALUE LEADS:
${highValueSummary || 'None'}

TOTAL OPEN LEADS: ${ctx.allOpenLeads.length}`,
  };

  const started = Date.now();
  const result = await provider.generateText([system, userMsg], { temperature: 0.3, maxTokens: 1500 });

  await recordAiUsage({
    orgId, userId, category: 'OTHER',
    provider: provider.name, model: provider.model || null,
    usage: result.usage, latencyMs: Date.now() - started,
  });

  let parsed: any[];
  try {
    const jsonMatch = result.text.match(/\[[\s\S]*\]/);
    parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
  } catch {
    parsed = [];
  }

  // Persist and return
  const saved = [];
  for (const rec of parsed.slice(0, ctx.limit)) {
    const created = await prisma.aiRecommendation.create({
      data: {
        orgId,
        userId,
        type: rec.type || 'NEXT_BEST_ACTION',
        entityType: rec.entityType || 'lead',
        entityId: rec.entityId || '',
        title: rec.title || 'Follow up',
        reasoning: rec.reasoning || '',
        confidence: Math.min(1, Math.max(0, rec.confidence || 0.5)),
        priority: rec.priority || 'MEDIUM',
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
    saved.push(created);
  }
  return saved;
}

// ── Rule-based Recommendations ──────────────────────────────

function ruleBasedRecommendations(
  orgId: string,
  userId: string,
  ctx: {
    staleLeads: any[];
    highValueLeads: any[];
    allOpenLeads: any[];
    type?: RecommendationType;
    limit: number;
    role: string;
  }
): any[] {
  const recs: any[] = [];

  // Stale high-value leads → NEXT_BEST_LEAD
  if (!ctx.type || ctx.type === 'NEXT_BEST_LEAD') {
    for (const lead of ctx.staleLeads.filter((l) => l.expectedValue > 0).slice(0, 5)) {
      const daysSince = lead.lastContactedAt
        ? Math.floor((Date.now() - lead.lastContactedAt.getTime()) / 86400000)
        : 999;
      recs.push({
        type: 'NEXT_BEST_LEAD',
        entityType: 'lead',
        entityId: lead.id,
        title: `Re-engage ${lead.name}${lead.company ? ` (${lead.company})` : ''}`,
        reasoning: daysSince > 10
          ? `No contact for ${daysSince} days. This ₹${(lead.expectedValue / 100).toLocaleString('en-IN')} lead is going cold.`
          : `Haven't reached out in ${daysSince} days. Expected value: ₹${(lead.expectedValue / 100).toLocaleString('en-IN')}.`,
        confidence: Math.min(1, 0.5 + (lead.expectedValue / 10000000) * 0.3),
        priority: daysSince > 7 ? 'HIGH' : 'MEDIUM',
      });
    }
  }

  // Untouched leads → NEXT_BEST_LEAD
  if (!ctx.type || ctx.type === 'NEXT_BEST_LEAD') {
    for (const lead of ctx.staleLeads.filter((l) => !l.lastContactedAt).slice(0, 3)) {
      recs.push({
        type: 'NEXT_BEST_LEAD',
        entityType: 'lead',
        entityId: lead.id,
        title: `First contact: ${lead.name}`,
        reasoning: `This lead was created but never contacted. ${lead.source} source, ${lead.priority} priority.`,
        confidence: 0.6,
        priority: lead.priority === 'HIGH' || lead.priority === 'URGENT' ? 'HIGH' : 'MEDIUM',
      });
    }
  }

  // High-value deals at risk → DEAL_RISK
  if (!ctx.type || ctx.type === 'DEAL_RISK') {
    for (const lead of ctx.highValueLeads.slice(0, 3)) {
      const daysSince = lead.lastContactedAt
        ? Math.floor((Date.now() - lead.lastContactedAt.getTime()) / 86400000)
        : 999;
      if (daysSince > 5 || lead.priority === 'LOW') {
        recs.push({
          type: 'DEAL_RISK',
          entityType: 'lead',
          entityId: lead.id,
          title: `Deal at risk: ${lead.name}`,
          reasoning: daysSince > 5
            ? `High-value lead (₹${(lead.expectedValue / 100).toLocaleString('en-IN')}) with no contact for ${daysSince} days.`
            : `Priority dropped to LOW on a high-value lead.`,
          confidence: Math.min(1, 0.6 + (daysSince > 10 ? 0.3 : 0)),
          priority: 'HIGH',
        });
      }
    }
  }

  // Deduplicate by entityId and sort by confidence
  const seen = new Set<string>();
  return recs
    .filter((r) => {
      if (seen.has(r.entityId)) return false;
      seen.add(r.entityId);
      return true;
    })
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, ctx.limit);
}

// ── Get/Manage Recommendations ──────────────────────────────

export async function getRecommendations(
  orgId: string,
  userId: string,
  filters: { type?: string; status?: string; limit?: number }
) {
  const where: Record<string, unknown> = { orgId };
  // Non-admins see only their own recommendations
  const user = await prisma.user.findFirst({ where: { id: userId, orgId } });
  if (user?.role === 'SALES') where.userId = userId;
  if (filters.type) where.type = filters.type;
  if (filters.status) where.status = filters.status;

  return prisma.aiRecommendation.findMany({
    where,
    orderBy: [{ priority: 'asc' }, { confidence: 'desc' }],
    take: filters.limit || 20,
  });
}

export async function dismissRecommendation(orgId: string, recommendationId: string) {
  const rec = await prisma.aiRecommendation.findFirst({ where: { id: recommendationId, orgId } });
  if (!rec) throw Object.assign(new Error('Recommendation not found'), { status: 404 });
  return prisma.aiRecommendation.update({
    where: { id: recommendationId },
    data: { status: 'DISMISSED' },
  });
}

export async function acceptRecommendation(orgId: string, recommendationId: string) {
  const rec = await prisma.aiRecommendation.findFirst({ where: { id: recommendationId, orgId } });
  if (!rec) throw Object.assign(new Error('Recommendation not found'), { status: 404 });
  return prisma.aiRecommendation.update({
    where: { id: recommendationId },
    data: { status: 'ACCEPTED' },
  });
}

// ── Per-User & Per-Feature Budget Caps ──────────────────────

export async function getUserAiUsage(orgId: string, userId: string) {
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);

  const [byCategory, total] = await Promise.all([
    prisma.aiUsage.groupBy({
      by: ['category'],
      where: { orgId, userId, createdAt: { gte: start } },
      _count: { _all: true },
      _sum: { totalTokens: true, costEstimatePaise: true },
    }),
    prisma.aiUsage.aggregate({
      where: { orgId, userId, createdAt: { gte: start } },
      _count: { _all: true },
      _sum: { totalTokens: true, costEstimatePaise: true },
    }),
  ]);

  return {
    userId,
    calls: total._count._all,
    totalTokens: total._sum.totalTokens || 0,
    spentPaise: (total._sum.costEstimatePaise as number) || 0,
    byCategory: byCategory.map((c) => ({
      category: c.category,
      calls: c._count._all,
      tokens: c._sum.totalTokens || 0,
      spentPaise: (c._sum.costEstimatePaise as number) || 0,
    })),
  };
}

export async function getAllUsersAiUsage(orgId: string) {
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);

  const byUser = await prisma.aiUsage.groupBy({
    by: ['userId'],
    where: { orgId, createdAt: { gte: start } },
    _count: { _all: true },
    _sum: { totalTokens: true, costEstimatePaise: true },
  });

  const userIds = byUser.map((u) => u.userId).filter(Boolean) as string[];
  const users = userIds.length
    ? await prisma.user.findMany({ where: { id: { in: userIds }, orgId }, select: { id: true, name: true } })
    : [];
  const userNameMap = new Map(users.map((u) => [u.id, u.name]));

  return byUser.map((u) => ({
    userId: u.userId,
    userName: u.userId ? userNameMap.get(u.userId) || 'Unknown' : 'System',
    calls: u._count._all,
    tokens: u._sum.totalTokens || 0,
    spentPaise: (u._sum.costEstimatePaise as number) || 0,
  }));
}
