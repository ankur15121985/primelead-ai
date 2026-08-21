/**
 * Inbound Lead Routing Engine (Phase 11, spec §27).
 *
 * Evaluates configurable rules against incoming leads and applies actions:
 * - Country / company size / industry / source / lead score matching
 * - Round-robin or fixed assignment
 * - Auto-create tasks, enroll sequences, add tags, change stage/priority
 *
 * Rules are evaluated in priority order; first match wins.
 */
import { prisma } from '../lib/prisma';
import { assignLeadOwner } from './assignment';
import { notify } from '../lib/serializers';

// ── CRUD: Rules ─────────────────────────────────────────────

export async function createInboundRule(
  orgId: string,
  data: {
    name: string;
    description?: string;
    conditions: Record<string, unknown>;
    actions: Record<string, unknown>;
    priority?: number;
  }
) {
  return prisma.inboundRule.create({
    data: {
      orgId,
      name: data.name,
      description: data.description || null,
      conditions: data.conditions as any,
      actions: data.actions as any,
      priority: data.priority ?? 100,
    },
  });
}

export async function getInboundRules(orgId: string) {
  return prisma.inboundRule.findMany({
    where: { orgId },
    orderBy: { priority: 'asc' },
  });
}

export async function updateInboundRule(orgId: string, ruleId: string, data: Partial<{
  name: string;
  description: string;
  conditions: Record<string, unknown>;
  actions: Record<string, unknown>;
  priority: number;
  isActive: boolean;
}>) {
  const rule = await prisma.inboundRule.findFirst({ where: { id: ruleId, orgId } });
  if (!rule) throw Object.assign(new Error('Rule not found'), { status: 404 });

  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.conditions !== undefined) updateData.conditions = data.conditions;
  if (data.actions !== undefined) updateData.actions = data.actions;
  if (data.priority !== undefined) updateData.priority = data.priority;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;

  return prisma.inboundRule.update({ where: { id: ruleId }, data: updateData });
}

export async function deleteInboundRule(orgId: string, ruleId: string) {
  const rule = await prisma.inboundRule.findFirst({ where: { id: ruleId, orgId } });
  if (!rule) throw Object.assign(new Error('Rule not found'), { status: 404 });
  await prisma.inboundRule.delete({ where: { id: ruleId } });
}

// ── Routing Engine ──────────────────────────────────────────

interface LeadContext {
  country?: string;
  state?: string;
  city?: string;
  industry?: string;
  employeeRange?: string;
  revenueRange?: string;
  source?: string;
  leadScore?: number;
  formId?: string;
  tags?: string[];
}

interface RoutingAction {
  type: 'ASSIGN' | 'NOTIFY' | 'CREATE_TASK' | 'ENROLL_SEQUENCE' | 'ADD_TAG' | 'CHANGE_STAGE' | 'CHANGE_PRIORITY' | 'ADD_TO_LIST';
  assignTo?: string;      // userId or 'roundRobin'
  notifyUserIds?: string[];
  taskTitle?: string;
  taskDueInDays?: number;
  sequenceId?: string;
  tag?: string;
  stageId?: string;
  priority?: string;
  listId?: string;
}

/** Check if a lead context matches the rule conditions. */
function matchesConditions(conditions: Record<string, unknown>, ctx: LeadContext): boolean {
  if (conditions.country && ctx.country && conditions.country !== ctx.country) return false;
  if (conditions.state && ctx.state && conditions.state !== ctx.state) return false;
  if (conditions.city && ctx.city && conditions.city !== ctx.city) return false;
  if (conditions.industry && ctx.industry && conditions.industry !== ctx.industry) return false;
  if (conditions.source && ctx.source && conditions.source !== ctx.source) return false;
  if (conditions.formId && ctx.formId && conditions.formId !== ctx.formId) return false;

  if (conditions.employeeRange && ctx.employeeRange) {
    const ranges = Array.isArray(conditions.employeeRange) ? conditions.employeeRange : [conditions.employeeRange];
    if (!ranges.includes(ctx.employeeRange)) return false;
  }

  if (conditions.revenueRange && ctx.revenueRange) {
    const ranges = Array.isArray(conditions.revenueRange) ? conditions.revenueRange : [conditions.revenueRange];
    if (!ranges.includes(ctx.revenueRange)) return false;
  }

  if (conditions.minScore != null && (ctx.leadScore || 0) < Number(conditions.minScore)) return false;
  if (conditions.maxScore != null && (ctx.leadScore || 0) > Number(conditions.maxScore)) return false;

  if (conditions.tags && ctx.tags) {
    const requiredTags = Array.isArray(conditions.tags) ? conditions.tags : [conditions.tags];
    if (!requiredTags.some((t: string) => ctx.tags!.includes(t))) return false;
  }

  return true;
}

/** Execute a single routing action. */
async function executeAction(
  orgId: string,
  leadId: string,
  action: RoutingAction
): Promise<{ ok: boolean; message: string }> {
  switch (action.type) {
    case 'ASSIGN': {
      if (action.assignTo === 'roundRobin') {
        const assignment = await assignLeadOwner({ orgId, source: 'INBOUND_ROUTING' });
        if (assignment.userId) {
          await prisma.lead.update({ where: { id: leadId }, data: { ownerId: assignment.userId } });
          return { ok: true, message: `Assigned via round-robin` };
        }
      } else if (action.assignTo) {
        const member = await prisma.user.findFirst({ where: { id: action.assignTo, orgId, active: true } });
        if (member) {
          await prisma.lead.update({ where: { id: leadId }, data: { ownerId: member.id } });
          return { ok: true, message: `Assigned to ${member.name}` };
        }
      }
      return { ok: false, message: 'Could not resolve assignee' };
    }

    case 'NOTIFY': {
      const userIds = action.notifyUserIds || [];
      for (const userId of userIds.slice(0, 10)) {
        await notify({ orgId, userId, type: 'SYSTEM', title: 'New inbound lead routed to you', body: 'A new lead has been assigned based on routing rules.', link: `/app/leads/${leadId}` });
      }
      return { ok: true, message: `Notified ${Math.min(userIds.length, 10)} user(s)` };
    }

    case 'CREATE_TASK': {
      const dueInDays = Math.max(0, Math.min(365, action.taskDueInDays ?? 1));
      await prisma.task.create({
        data: {
          orgId,
          leadId,
          userId: '', // Will be set by the assign action if present
          title: action.taskTitle || 'Follow up with inbound lead',
          kind: 'FOLLOW_UP',
          priority: 'MEDIUM',
          dueAt: new Date(Date.now() + dueInDays * 24 * 60 * 60 * 1000),
        },
      });
      return { ok: true, message: 'Task created' };
    }

    case 'ADD_TAG': {
      if (!action.tag) return { ok: false, message: 'No tag specified' };
      const lead = await prisma.lead.findFirst({ where: { id: leadId, orgId }, select: { tags: true } });
      if (!lead) return { ok: false, message: 'Lead not found' };
      const tags = Array.isArray(lead.tags) ? (lead.tags as string[]) : [];
      if (!tags.includes(action.tag)) {
        await prisma.lead.update({ where: { id: leadId }, data: { tags: [...tags, action.tag] as any } });
      }
      return { ok: true, message: `Tag "${action.tag}" added` };
    }

    case 'CHANGE_STAGE': {
      if (!action.stageId) return { ok: false, message: 'No stage specified' };
      await prisma.lead.update({ where: { id: leadId }, data: { stageId: action.stageId } });
      return { ok: true, message: 'Stage changed' };
    }

    case 'CHANGE_PRIORITY': {
      if (!action.priority) return { ok: false, message: 'No priority specified' };
      await prisma.lead.update({ where: { id: leadId }, data: { priority: action.priority } });
      return { ok: true, message: `Priority set to ${action.priority}` };
    }

    default:
      return { ok: false, message: `Unknown action type: ${(action as any).type}` };
  }
}

/**
 * Route an inbound lead through matching rules.
 * Called after a form submission, webhook, or import.
 */
export async function routeInboundLead(
  orgId: string,
  leadId: string,
  context: LeadContext
): Promise<{ matched: boolean; ruleName?: string; results: Array<{ type: string; ok: boolean; message: string }> }> {
  const rules = await prisma.inboundRule.findMany({
    where: { orgId, isActive: true },
    orderBy: { priority: 'asc' },
    take: 50,
  });

  for (const rule of rules) {
    const conditions = (rule.conditions as Record<string, unknown>) || {};
    if (!matchesConditions(conditions, context)) continue;

    const actions = (rule.actions as unknown as RoutingAction[]) || [];
    const results: Array<{ type: string; ok: boolean; message: string }> = [];

    for (const action of actions) {
      const r = await executeAction(orgId, leadId, action);
      results.push({ type: action.type, ok: r.ok, message: r.message });
    }

    // Update rule stats
    await prisma.inboundRule.update({
      where: { id: rule.id },
      data: { runCount: { increment: 1 }, lastRunAt: new Date() },
    });

    return { matched: true, ruleName: rule.name, results };
  }

  return { matched: false, results: [] };
}

// ── Serializer ──────────────────────────────────────────────

export function serializeRule(r: any) {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    conditions: r.conditions || {},
    actions: r.actions || [],
    priority: r.priority,
    isActive: r.isActive,
    runCount: r.runCount,
    lastRunAt: r.lastRunAt,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}
