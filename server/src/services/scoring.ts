import { prisma } from '../lib/prisma';
import { notFound } from '../lib/http';

export interface CreateScoringRuleInput {
  orgId: string;
  name: string;
  description?: string | null;
  field: string;
  operator: string;
  value?: unknown;
  points: number;
  enabled?: boolean;
  priority?: number;
}

export type UpdateScoringRuleInput = Partial<Omit<CreateScoringRuleInput, 'orgId'>>;

function toJson(val: unknown): unknown {
  return val !== undefined && val !== null ? JSON.parse(JSON.stringify(val)) : undefined;
}

export async function createRule(input: CreateScoringRuleInput) {
  return (prisma as any).scoringRule.create({
    data: {
      orgId: input.orgId,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      field: input.field,
      operator: input.operator,
      value: toJson(input.value),
      points: input.points,
      enabled: input.enabled ?? true,
      priority: input.priority ?? 0,
    },
  });
}

export async function updateRule(id: string, orgId: string, input: UpdateScoringRuleInput) {
  const existing = await (prisma as any).scoringRule.findFirst({ where: { id, orgId } });
  if (!existing) throw notFound('Scoring rule not found');
  const data: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(input)) {
    if (val === undefined) continue;
    if (key === 'name' || key === 'description') data[key] = typeof val === 'string' ? val.trim() || null : val;
    else if (key === 'value') data.value = toJson(val);
    else data[key] = val;
  }
  return (prisma as any).scoringRule.update({ where: { id }, data });
}

export async function deleteRule(id: string, orgId: string) {
  const existing = await (prisma as any).scoringRule.findFirst({ where: { id, orgId } });
  if (!existing) throw notFound('Scoring rule not found');
  await (prisma as any).scoringRule.delete({ where: { id } });
  return { deleted: true };
}

export async function listRules(orgId: string) {
  return (prisma as any).scoringRule.findMany({ where: { orgId }, orderBy: { priority: 'desc' } });
}

/**
 * Evaluate all enabled scoring rules against a lead and compute the final score.
 */
export async function evaluateLeadScore(orgId: string, lead: Record<string, unknown>): Promise<{ score: number; breakdown: { ruleId: string; name: string; points: number; matched: boolean }[] }> {
  const rules = await (prisma as any).scoringRule.findMany({
    where: { orgId, enabled: true },
    orderBy: { priority: 'desc' },
  });

  let totalScore = 0;
  const breakdown: { ruleId: string; name: string; points: number; matched: boolean }[] = [];

  for (const rule of rules) {
    const matched = evaluateCondition(lead, rule.field, rule.operator, rule.value);
    if (matched) {
      totalScore += rule.points;
    }
    breakdown.push({ ruleId: rule.id, name: rule.name, points: rule.points, matched });
  }

  return { score: Math.max(0, Math.min(100, totalScore)), breakdown };
}

function evaluateCondition(lead: Record<string, unknown>, field: string, operator: string, ruleValue: unknown): boolean {
  const fieldValue = lead[field];

  switch (operator) {
    case 'eq': return fieldValue === ruleValue || String(fieldValue) === String(ruleValue);
    case 'neq': return fieldValue !== ruleValue && String(fieldValue) !== String(ruleValue);
    case 'in': return Array.isArray(ruleValue) && ruleValue.includes(String(fieldValue));
    case 'nin': return Array.isArray(ruleValue) && !ruleValue.includes(String(fieldValue));
    case 'contains': return typeof fieldValue === 'string' && typeof ruleValue === 'string' && fieldValue.toLowerCase().includes(ruleValue.toLowerCase());
    case 'gt': return Number(fieldValue) > Number(ruleValue);
    case 'gte': return Number(fieldValue) >= Number(ruleValue);
    case 'lt': return Number(fieldValue) < Number(ruleValue);
    case 'lte': return Number(fieldValue) <= Number(ruleValue);
    case 'exists': return fieldValue !== null && fieldValue !== undefined && fieldValue !== '';
    default: return false;
  }
}

/**
 * Auto-score a lead using all active rules.
 */
export async function autoScoreLead(orgId: string, leadId: string): Promise<number> {
  const lead = await prisma.lead.findFirst({ where: { id: leadId, orgId } });
  if (!lead) return 0;

  const leadData = {
    source: lead.source,
    status: lead.status,
    priority: lead.priority,
    hasEmail: !!lead.email,
    hasPhone: !!lead.phone,
    company: lead.company || '',
    score: lead.score,
  };

  const { score } = await evaluateLeadScore(orgId, leadData);
  await prisma.lead.update({ where: { id: leadId }, data: { score } });
  return score;
}
