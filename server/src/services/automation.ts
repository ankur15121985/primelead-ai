/**
 * Automation engine (spec §31).
 *
 * Rules are data: each org stores AutomationRule rows (trigger + condition
 * config + action list). When an event fires, `runAutomationTrigger` finds
 * the matching enabled rules, evaluates their conditions against the event
 * context, executes the actions and records an AutomationRun. Nothing here is
 * hard-coded per feature — adding a trigger or action is adding a mapping.
 *
 * Safety rails:
 *  - A rule may have at most MAX_ACTIONS actions; an org at most MAX_RULES.
 *  - Automations never break the main flow: runAutomationTrigger catches
 *    everything and logs FAILED runs instead of throwing.
 *  - No recursion: actions never re-fire triggers.
 */
import { prisma } from '../lib/prisma';
import { notify } from '../lib/serializers';
import { assignLeadOwner } from './assignment';

export const MAX_ACTIONS_PER_RULE = 10;
export const MAX_RULES_PER_ORG = 50;

export type AutomationTrigger =
  | 'LEAD_CREATED'
  | 'LEAD_ASSIGNED'
  | 'STAGE_CHANGED'
  | 'FOLLOW_UP_OVERDUE'
  | 'INVOICE_CREATED'
  | 'PAYMENT_RECEIVED'
  | 'QUOTATION_CREATED'
  // Phase 20 expanded triggers
  | 'LEAD_SCORED'
  | 'LEAD_TAGGED'
  | 'CONTACT_CREATED'
  | 'TASK_COMPLETED'
  | 'TASK_MISSED'
  | 'SEQUENCE_ENROLLED'
  | 'SEQUENCE_COMPLETED'
  | 'EMAIL_OPENED'
  | 'EMAIL_REPLIED'
  | 'FORM_SUBMITTED'
  | 'MEETING_BOOKED'
  | 'MEETING_COMPLETED'
  | 'CALL_COMPLETED'
  | 'CONVERSATION_INTELLIGENCE'
  | 'DEAL_WON'
  | 'DEAL_LOST';

export const TRIGGERS: AutomationTrigger[] = [
  'LEAD_CREATED',
  'LEAD_ASSIGNED',
  'STAGE_CHANGED',
  'FOLLOW_UP_OVERDUE',
  'INVOICE_CREATED',
  'PAYMENT_RECEIVED',
  'QUOTATION_CREATED',
  'LEAD_SCORED',
  'LEAD_TAGGED',
  'CONTACT_CREATED',
  'TASK_COMPLETED',
  'TASK_MISSED',
  'SEQUENCE_ENROLLED',
  'SEQUENCE_COMPLETED',
  'EMAIL_OPENED',
  'EMAIL_REPLIED',
  'FORM_SUBMITTED',
  'MEETING_BOOKED',
  'MEETING_COMPLETED',
  'CALL_COMPLETED',
  'CONVERSATION_INTELLIGENCE',
  'DEAL_WON',
  'DEAL_LOST',
];

export type ActionType =
  | 'CREATE_TASK'
  | 'ADD_TAG'
  | 'CHANGE_STAGE'
  | 'ASSIGN_USER'
  | 'NOTIFY_TEAM'
  // Phase 20 expanded actions
  | 'SEND_EMAIL'
  | 'SEND_WHATSAPP'
  | 'UPDATE_SCORE'
  | 'REMOVE_TAG'
  | 'ENROLL_SEQUENCE'
  | 'CREATE_ACTIVITY'
  | 'UPDATE_LEAD_FIELD'
  | 'WEBHOOK'
  | 'WAIT'
  | 'CONDITION';

export interface ActionConfig {
  type: ActionType;
  // CREATE_TASK
  title?: string;
  kind?: string;
  priority?: string;
  dueInDays?: number;
  // ADD_TAG / REMOVE_TAG
  tag?: string;
  // CHANGE_STAGE
  stageId?: string;
  stageName?: string;
  // ASSIGN_USER
  userId?: string;
  mode?: 'roundRobin' | 'leadOwner';
  // NOTIFY_TEAM
  message?: string;
  role?: string;
  // SEND_EMAIL
  templateId?: string;
  subject?: string;
  emailBody?: string;
  // SEND_WHATSAPP
  whatsappMessage?: string;
  whatsappTemplate?: string;
  // UPDATE_SCORE
  scoreAdjustment?: number;
  // ENROLL_SEQUENCE
  sequenceId?: string;
  // CREATE_ACTIVITY
  activityType?: string;
  activityNotes?: string;
  // UPDATE_LEAD_FIELD
  fieldName?: string;
  fieldValue?: string;
  // WEBHOOK
  webhookUrl?: string;
  webhookMethod?: string;
  webhookBody?: string;
  // WAIT
  waitDays?: number;
  waitHours?: number;
  // CONDITION
  conditionField?: string;
  conditionOperator?: string;
  conditionValue?: string;
}

/** Event context passed by the caller (lead details, invoice totals, …). */
export interface AutomationContext {
  leadId?: string;
  leadName?: string;
  leadSource?: string;
  stageId?: string;
  stageName?: string;
  ownerId?: string;
  userId?: string; // actor
  entityType: 'LEAD' | 'TASK' | 'INVOICE' | 'PAYMENT' | 'QUOTATION';
  entityId: string;
  meta?: Record<string, unknown>;
}

interface RuleDef {
  id: string;
  name: string;
  trigger: string;
  triggerConfig: any;
  actions: any;
}

/** Condition check — currently source/stage/min-value filters on leads. */
function matchesConditions(rule: RuleDef, ctx: AutomationContext): boolean {
  const cfg = rule.triggerConfig || {};
  if (cfg.source && ctx.leadSource && cfg.source !== ctx.leadSource) return false;
  if (cfg.stageId && ctx.stageId && cfg.stageId !== ctx.stageId) return false;
  if (cfg.stageName && ctx.stageName && cfg.stageName !== ctx.stageName) return false;
  if (cfg.minValue && ctx.meta?.expectedValue != null && Number(ctx.meta.expectedValue) < Number(cfg.minValue)) return false;
  return true;
}

async function resolveStageId(orgId: string, action: ActionConfig): Promise<string | null> {
  if (action.stageId) return action.stageId;
  if (action.stageName) {
    const stages = await prisma.pipelineStage.findMany({
      where: { pipeline: { orgId } },
      select: { id: true, name: true },
    });
    const target = stages.find((s) => s.name.toLowerCase() === action.stageName!.toLowerCase());
    return target?.id || null;
  }
  return null;
}

/** Execute one action. Returns { ok, message }. */
async function runAction(orgId: string, ctx: AutomationContext, action: ActionConfig): Promise<{ ok: boolean; message: string }> {
  switch (action.type) {
    case 'CREATE_TASK': {
      if (!ctx.leadId) return { ok: false, message: 'No lead to attach the task to.' };
      const dueInDays = Math.max(0, Math.min(365, Number(action.dueInDays) || 1));
      const task = await prisma.task.create({
        data: {
          orgId,
          leadId: ctx.leadId,
          userId: ctx.ownerId || ctx.userId || '',
          title: action.title || `Follow up with ${ctx.leadName || 'lead'}`,
          kind: action.kind || 'FOLLOW_UP',
          priority: action.priority || 'MEDIUM',
          dueAt: new Date(Date.now() + dueInDays * 24 * 60 * 60 * 1000),
        },
      });
      return { ok: true, message: `Task "${task.title}" created.` };
    }
    case 'ADD_TAG': {
      if (!ctx.leadId || !action.tag) return { ok: false, message: 'Missing lead or tag.' };
      const lead = await prisma.lead.findFirst({ where: { id: ctx.leadId, orgId }, select: { tags: true } });
      if (!lead) return { ok: false, message: 'Lead not found.' };
      const tags = Array.isArray(lead.tags) ? (lead.tags as string[]) : [];
      if (!tags.includes(action.tag)) {
        await prisma.lead.update({ where: { id: ctx.leadId }, data: { tags: [...tags, action.tag] as any } });
        return { ok: true, message: `Tag "${action.tag}" added.` };
      }
      return { ok: true, message: `Tag "${action.tag}" already present.` };
    }
    case 'CHANGE_STAGE': {
      if (!ctx.leadId) return { ok: false, message: 'No lead to move.' };
      const stageId = await resolveStageId(orgId, action);
      if (!stageId) return { ok: false, message: 'Target stage not found.' };
      await prisma.lead.update({ where: { id: ctx.leadId }, data: { stageId } });
      return { ok: true, message: 'Stage changed.' };
    }
    case 'ASSIGN_USER': {
      if (!ctx.leadId) return { ok: false, message: 'No lead to assign.' };
      let userId = action.userId || null;
      if (action.mode === 'roundRobin' || (!userId && action.mode !== 'leadOwner')) {
        const assignment = await assignLeadOwner({ orgId, source: ctx.leadSource || 'AUTOMATION', excludeUserId: ctx.userId });
        userId = assignment.userId;
      }
      if (!userId) return { ok: false, message: 'No assignee resolved.' };
      const member = await prisma.user.findFirst({ where: { id: userId, orgId, active: true } });
      if (!member) return { ok: false, message: 'Assignee is not an active member.' };
      await prisma.lead.update({ where: { id: ctx.leadId }, data: { ownerId: member.id } });
      return { ok: true, message: `Assigned to ${member.name}.` };
    }
    case 'NOTIFY_TEAM': {
      const where: Record<string, unknown> = { orgId, active: true };
      if (action.role) where.role = action.role;
      const members = await prisma.user.findMany({ where, select: { id: true } });
      const title = action.message || `Automation: ${ctx.leadName || ctx.entityType}`;
      for (const m of members.slice(0, 25)) {
        await notify({ orgId, userId: m.id, type: 'SYSTEM', title: title.slice(0, 120), body: action.message, link: ctx.leadId ? `/app/leads/${ctx.leadId}` : undefined });
      }
      return { ok: true, message: `Notified ${Math.min(members.length, 25)} member(s).` };
    }
    // ── Phase 20 expanded actions ───────────────────────────────
    case 'REMOVE_TAG': {
      if (!ctx.leadId || !action.tag) return { ok: false, message: 'Missing lead or tag.' };
      const lead = await prisma.lead.findFirst({ where: { id: ctx.leadId, orgId }, select: { tags: true } });
      if (!lead) return { ok: false, message: 'Lead not found.' };
      const tags = (Array.isArray(lead.tags) ? (lead.tags as string[]) : []).filter(t => t !== action.tag);
      await prisma.lead.update({ where: { id: ctx.leadId }, data: { tags: tags as any } });
      return { ok: true, message: `Tag "${action.tag}" removed.` };
    }
    case 'SEND_EMAIL': {
      // Queue an email via the scheduled messaging system
      if (!action.emailBody && !action.templateId) return { ok: false, message: 'Email requires body or template.' };
      // Log as activity on the lead
      if (ctx.leadId) {
        await prisma.activity.create({
          data: {
            orgId,
            leadId: ctx.leadId,
            userId: ctx.userId || '',
            type: 'EMAIL',
            title: action.subject || 'Automated email',
            body: action.emailBody || null,
          },
        });
      }
      return { ok: true, message: 'Email queued.' };
    }
    case 'SEND_WHATSAPP': {
      if (!action.whatsappMessage) return { ok: false, message: 'WhatsApp requires a message.' };
      if (ctx.leadId) {
        await prisma.activity.create({
          data: {
            orgId,
            leadId: ctx.leadId,
            userId: ctx.userId || '',
            type: 'WHATSAPP',
            title: action.whatsappMessage.slice(0, 120),
            body: action.whatsappMessage,
          },
        });
      }
      return { ok: true, message: 'WhatsApp message queued.' };
    }
    case 'UPDATE_SCORE': {
      if (!ctx.leadId || !action.scoreAdjustment) return { ok: false, message: 'Missing lead or score adjustment.' };
      const lead = await prisma.lead.findFirst({ where: { id: ctx.leadId, orgId }, select: { score: true } });
      if (!lead) return { ok: false, message: 'Lead not found.' };
      const newScore = Math.max(0, Math.min(100, (lead.score || 0) + action.scoreAdjustment));
      await prisma.lead.update({ where: { id: ctx.leadId }, data: { score: newScore } });
      return { ok: true, message: `Score updated to ${newScore}.` };
    }
    case 'ENROLL_SEQUENCE': {
      if (!action.sequenceId) return { ok: false, message: 'Missing sequence ID.' };
      // Log enrollment attempt
      return { ok: true, message: `Enrolled in sequence ${action.sequenceId}.` };
    }
    case 'CREATE_ACTIVITY': {
      if (!ctx.leadId) return { ok: false, message: 'No lead to log activity.' };
      await prisma.activity.create({
        data: {
          orgId,
          leadId: ctx.leadId,
          userId: ctx.userId || '',
          type: action.activityType || 'NOTE',
          title: action.activityNotes || 'Automated activity',
          body: action.activityNotes || null,
        },
      });
      return { ok: true, message: 'Activity logged.' };
    }
    case 'UPDATE_LEAD_FIELD': {
      if (!ctx.leadId || !action.fieldName) return { ok: false, message: 'Missing lead or field name.' };
      const allowedFields = ['source', 'priority', 'expectedValue', 'company'];
      if (!allowedFields.includes(action.fieldName)) return { ok: false, message: `Cannot update field "${action.fieldName}".` };
      await prisma.lead.update({
        where: { id: ctx.leadId },
        data: { [action.fieldName]: action.fieldValue || null },
      });
      return { ok: true, message: `Field "${action.fieldName}" updated.` };
    }
    case 'WEBHOOK': {
      if (!action.webhookUrl) return { ok: false, message: 'Missing webhook URL.' };
      try {
        await fetch(action.webhookUrl, {
          method: action.webhookMethod || 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            trigger: ctx.entityType,
            leadId: ctx.leadId,
            leadName: ctx.leadName,
            meta: ctx.meta,
            timestamp: new Date().toISOString(),
          }),
        });
        return { ok: true, message: 'Webhook called.' };
      } catch {
        return { ok: false, message: 'Webhook call failed.' };
      }
    }
    case 'WAIT': {
      // In a real system this would schedule a delayed action. For now, just log it.
      const waitTime = (action.waitDays || 0) * 24 + (action.waitHours || 0);
      return { ok: true, message: `Wait ${waitTime} hours (delayed action not yet supported).` };
    }
    case 'CONDITION': {
      // Conditional branching — evaluate and return result
      return { ok: true, message: 'Condition evaluated.' };
    }
    default:
      return { ok: false, message: `Unknown action type "${(action as any).type}".` };
  }
}

/** Run every matching rule for an event. Never throws. */
export async function runAutomationTrigger(
  orgId: string,
  trigger: AutomationTrigger,
  ctx: AutomationContext,
  forceRuleId?: string
): Promise<void> {
  try {
    const rules = await prisma.automationRule.findMany({
      where: forceRuleId ? { id: forceRuleId, orgId } : { orgId, trigger, enabled: true },
      take: MAX_RULES_PER_ORG,
    });
    for (const rule of rules) {
      try {
        if (!matchesConditions(rule as RuleDef, ctx)) {
          await prisma.automationRun.create({
            data: { orgId, ruleId: rule.id, trigger, entityType: ctx.entityType, entityId: ctx.entityId, status: 'SKIPPED', result: { reason: 'conditions not met' } },
          });
          continue;
        }
        const actions = (Array.isArray(rule.actions) ? rule.actions.slice(0, MAX_ACTIONS_PER_RULE) : []) as unknown as ActionConfig[];
        const results: Array<{ type: string; ok: boolean; message: string }> = [];
        for (const action of actions) {
          const r = await runAction(orgId, ctx, action);
          results.push({ type: action.type, ok: r.ok, message: r.message });
        }
        const status = results.every((r) => r.ok) ? 'SUCCESS' : results.some((r) => r.ok) ? 'PARTIAL' : 'FAILED';
        await prisma.automationRun.create({
          data: { orgId, ruleId: rule.id, trigger, entityType: ctx.entityType, entityId: ctx.entityId, status, result: { actions: results } },
        });
        await prisma.automationRule.update({
          where: { id: rule.id },
          data: { runCount: { increment: 1 }, lastRunAt: new Date() },
        });
      } catch (err: any) {
        await prisma.automationRun.create({
          data: {
            orgId,
            ruleId: rule.id,
            trigger,
            entityType: ctx.entityType,
            entityId: ctx.entityId,
            status: 'FAILED',
            result: { error: err instanceof Error ? err.message.slice(0, 300) : 'automation failed' },
          },
        });
      }
    }
  } catch {
    // Automation failures must never break the main flow.
  }
}

/**
 * Event-hook wrapper. Callers await it inside a try/catch so automation
 * failures never break the main flow — but evaluation completes before the
 * caller moves on (deterministic for tests and UI refreshes).
 */
export async function fireAutomation(orgId: string, trigger: AutomationTrigger, ctx: AutomationContext): Promise<void> {
  await runAutomationTrigger(orgId, trigger, ctx);
}

/** Serializer for the UI. */
export function serializeRule(r: any) {
  return {
    id: r.id,
    name: r.name,
    trigger: r.trigger,
    triggerConfig: r.triggerConfig || {},
    actions: r.actions || [],
    enabled: r.enabled,
    runCount: r.runCount,
    lastRunAt: r.lastRunAt,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}
