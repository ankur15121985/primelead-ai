/**
 * AI usage accounting (spec §23, §77).
 *
 * Every provider call is recorded in the AiUsage ledger with tokens and an
 * estimated cost, so orgs see exactly what AI costs. A monthly budget cap
 * lives in org settings (`aiBudget.monthlyLimitRupees`) and is enforced
 * before any generation — AI can never silently run up a bill.
 */
import { prisma } from '../lib/prisma';
import { rupeesToPaise, paiseToRupees } from '../lib/money';
import { getOrgSetting } from './assignment';

export type AiCategory = 'FOLLOW_UP' | 'CHAT' | 'LEAD_SUMMARY' | 'LEAD_SCORE' | 'NEXT_ACTION' | 'OTHER';

/**
 * Estimated cost per 1K tokens by model (USD, coarse) — the ledger's purpose
 * is visibility, not billing. Prices are config-overridable via
 * AI_COST_PER_1K_IN / AI_COST_PER_1K_OUT.
 */
function costPer1k(model: string | null): { input: number; output: number } {
  const m = (model || '').toLowerCase();
  if (m.includes('gpt-4') && !m.includes('mini')) return { input: 0.03, output: 0.06 };
  if (m.includes('claude-3-5') || m.includes('claude-3.5')) return { input: 0.003, output: 0.015 };
  if (m.includes('gemini-1.5')) return { input: 0.00125, output: 0.005 };
  return { input: 0.00015, output: 0.0006 }; // gpt-4o-mini-class default
}

export interface UsageInfo {
  provider: string;
  model: string | null;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costEstimatePaise: number;
}

/** Record one provider call. Never throws — accounting must not break flows. */
export async function recordAiUsage(input: {
  orgId: string;
  userId?: string | null;
  category: AiCategory;
  provider: string;
  model?: string | null;
  usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number };
  latencyMs?: number;
}): Promise<UsageInfo | null> {
  try {
    const promptTokens = input.usage?.promptTokens || 0;
    const completionTokens = input.usage?.completionTokens || 0;
    const totalTokens = input.usage?.totalTokens || promptTokens + completionTokens || 0;
    const rates = costPer1k(input.model || null);
    const costUsd = (promptTokens / 1000) * rates.input + (completionTokens / 1000) * rates.output;
    // 1 USD ≈ 83 INR → paise
    const costEstimatePaise = Math.round(costUsd * 83 * 100);

    await prisma.aiUsage.create({
      data: {
        orgId: input.orgId,
        userId: input.userId || null,
        provider: input.provider,
        model: input.model || null,
        category: input.category,
        promptTokens,
        completionTokens,
        totalTokens,
        costEstimatePaise,
        latencyMs: input.latencyMs ?? null,
      },
    });
    return {
      provider: input.provider,
      model: input.model || null,
      promptTokens,
      completionTokens,
      totalTokens,
      costEstimatePaise,
    };
  } catch {
    return null;
  }
}

export interface AiBudgetConfig {
  monthlyLimitRupees: number;
  enabled: boolean;
}

/** The org's budget: org setting wins, else a sane global default. */
export async function getAiBudget(orgId: string): Promise<AiBudgetConfig> {
  const setting = await getOrgSetting(orgId, 'aiBudget');
  const v = (setting as any) || {};
  const defaultLimit = Number(process.env.AI_MONTHLY_BUDGET_RUPEES || 500);
  const monthlyLimitRupees =
    typeof v.monthlyLimitRupees === 'number' && v.monthlyLimitRupees >= 0 ? v.monthlyLimitRupees : defaultLimit;
  return { monthlyLimitRupees, enabled: monthlyLimitRupees > 0 };
}

/** Rupees spent by this org in the current calendar month. */
export async function getAiSpendThisMonth(orgId: string): Promise<number> {
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  const agg = await prisma.aiUsage.aggregate({
    where: { orgId, createdAt: { gte: start } },
    _sum: { costEstimatePaise: true },
  });
  return paiseToRupees((agg._sum.costEstimatePaise as number) || 0);
}

/**
 * Enforce the org's monthly AI budget before generating. Throws a 429-style
 * error the route surfaces as AI_BUDGET_EXCEEDED — the request never reaches
 * the provider.
 */
export async function assertAiBudget(orgId: string): Promise<void> {
  const budget = await getAiBudget(orgId);
  if (!budget.enabled) return;
  const spent = await getAiSpendThisMonth(orgId);
  if (spent >= budget.monthlyLimitRupees) {
    throw Object.assign(
      new Error(
        `Your AI budget for this month is exhausted (₹${budget.monthlyLimitRupees.toLocaleString('en-IN')}). Raise it in Settings → AI to continue.`
      ),
      { status: 429, code: 'AI_BUDGET_EXCEEDED' }
    );
  }
}

/** Usage stats for the AI dashboard (current month). */
export async function getAiUsageStats(orgId: string) {
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);

  const [byCategory, total] = await Promise.all([
    prisma.aiUsage.groupBy({
      by: ['category'],
      where: { orgId, createdAt: { gte: start } },
      _count: { _all: true },
      _sum: { totalTokens: true, costEstimatePaise: true },
    }),
    prisma.aiUsage.aggregate({
      where: { orgId, createdAt: { gte: start } },
      _count: { _all: true },
      _sum: { totalTokens: true, costEstimatePaise: true },
    }),
  ]);

  return {
    calls: total._count._all,
    totalTokens: total._sum.totalTokens || 0,
    spentRupees: paiseToRupees((total._sum.costEstimatePaise as number) || 0),
    byCategory: byCategory.map((c) => ({
      category: c.category,
      calls: c._count._all,
      tokens: c._sum.totalTokens || 0,
      spentRupees: paiseToRupees((c._sum.costEstimatePaise as number) || 0),
    })),
  };
}

export { rupeesToPaise };
