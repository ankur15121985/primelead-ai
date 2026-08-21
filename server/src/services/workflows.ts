/**
 * Enhanced Workflow Engine (Phase 9, spec §46-48).
 *
 * Extends the existing automation engine with:
 *  - Visual workflow nodes (positions, connections, branches)
 *  - Workflow templates (pre-built, system, or user-created)
 *  - Additional trigger types for the GTM platform
 *  - Branching/conditional logic
 *
 * The existing `fireAutomation()` in automation.ts remains the runtime
 * trigger handler. This module adds the visual builder layer on top.
 */
import { prisma } from '../lib/prisma';

// ── Extended Trigger Types ──────────────────────────────────

export const WORKFLOW_TRIGGERS = [
  // Existing triggers (from automation.ts)
  'LEAD_CREATED',
  'LEAD_ASSIGNED',
  'STAGE_CHANGED',
  'FOLLOW_UP_OVERDUE',
  'INVOICE_CREATED',
  'PAYMENT_RECEIVED',
  'QUOTATION_CREATED',
  // New GTM triggers
  'CONTACT_CREATED',
  'COMPANY_CREATED',
  'LEAD_SCORE_CHANGED',
  'WEBSITE_VISIT',
  'EMAIL_REPLY',
  'EMAIL_BOUNCE',
  'MEETING_BOOKED',
  'MEETING_COMPLETED',
  'DEAL_STAGE_CHANGED',
  'DEAL_CREATED',
  'DEAL_WON',
  'DEAL_LOST',
  'SIGNAL_DETECTED',
  'SEQUENCE_COMPLETED',
  'SEQUENCE_REPLIED',
  'SEQUENCE_BOUNCED',
  'TASK_COMPLETED',
  'TASK_OVERDUE',
  'CALL_COMPLETED',
  'CALL_NO_ANSWER',
] as const;

export type WorkflowTriggerType = (typeof WORKFLOW_TRIGGERS)[number];

// ── Extended Action Types ───────────────────────────────────

export const WORKFLOW_ACTIONS = [
  // Existing actions
  'CREATE_TASK',
  'ADD_TAG',
  'CHANGE_STAGE',
  'ASSIGN_USER',
  'NOTIFY_TEAM',
  // New GTM actions
  'SEND_EMAIL',
  'ENROLL_SEQUENCE',
  'UPDATE_FIELD',
  'NOTIFY_SLACK',
  'WEBHOOK',
  'AI_RESEARCH',
  'CREATE_DEAL',
  'ADD_TO_LIST',
  'REMOVE_FROM_LIST',
  'ENRICH_CONTACT',
  'VERIFY_EMAIL',
  'CREATE_ACTIVITY',
  'WAIT',
  'CONDITION',
] as const;

export type WorkflowActionType = (typeof WORKFLOW_ACTIONS)[number];

// ── Node Types for Visual Builder ───────────────────────────

export const NODE_TYPES = ['TRIGGER', 'CONDITION', 'ACTION', 'DELAY', 'BRANCH', 'AI_ACTION'] as const;
export type WorkflowNodeType = (typeof NODE_TYPES)[number];

// ── CRUD: Workflow Nodes ────────────────────────────────────

export async function createWorkflowNode(
  orgId: string,
  data: {
    ruleId?: string;
    nodeType: WorkflowNodeType;
    label: string;
    config?: Record<string, unknown>;
    positionX?: number;
    positionY?: number;
    connections?: string[];
    branches?: Array<{ label: string; connectionId: string }>;
    enabled?: boolean;
  }
) {
  return prisma.workflowNode.create({
    data: {
      orgId,
      ruleId: data.ruleId || null,
      nodeType: data.nodeType,
      label: data.label,
      config: (data.config as any) || undefined,
      positionX: data.positionX ?? 0,
      positionY: data.positionY ?? 0,
      connections: (data.connections as any) || undefined,
      branches: (data.branches as any) || undefined,
      enabled: data.enabled ?? true,
    },
  });
}

export async function getWorkflowNodes(orgId: string, ruleId?: string) {
  const where: Record<string, unknown> = { orgId };
  if (ruleId) where.ruleId = ruleId;
  return prisma.workflowNode.findMany({
    where,
    orderBy: [{ positionY: 'asc' }, { positionX: 'asc' }],
  });
}

export async function updateWorkflowNode(
  orgId: string,
  nodeId: string,
  data: {
    label?: string;
    config?: Record<string, unknown>;
    positionX?: number;
    positionY?: number;
    connections?: string[];
    branches?: Array<{ label: string; connectionId: string }>;
    enabled?: boolean;
  }
) {
  const node = await prisma.workflowNode.findFirst({ where: { id: nodeId, orgId } });
  if (!node) throw Object.assign(new Error('Node not found'), { status: 404 });

  return prisma.workflowNode.update({
    where: { id: nodeId },
    data: {
      ...(data.label !== undefined && { label: data.label }),
      ...(data.config !== undefined && { config: data.config as any }),
      ...(data.positionX !== undefined && { positionX: data.positionX }),
      ...(data.positionY !== undefined && { positionY: data.positionY }),
      ...(data.connections !== undefined && { connections: data.connections as any }),
      ...(data.branches !== undefined && { branches: data.branches as any }),
      ...(data.enabled !== undefined && { enabled: data.enabled }),
    },
  });
}

export async function deleteWorkflowNode(orgId: string, nodeId: string) {
  const node = await prisma.workflowNode.findFirst({ where: { id: nodeId, orgId } });
  if (!node) throw Object.assign(new Error('Node not found'), { status: 404 });
  await prisma.workflowNode.delete({ where: { id: nodeId } });
}

// ── CRUD: Workflow Templates ────────────────────────────────

export async function createWorkflowTemplate(
  orgId: string,
  data: {
    name: string;
    description?: string;
    category?: string;
    templateData: Record<string, unknown>;
    isSystem?: boolean;
  }
) {
  return prisma.workflowTemplate.create({
    data: {
      orgId,
      name: data.name,
      description: data.description || null,
      category: data.category || 'GENERAL',
      templateData: data.templateData as any,
      isSystem: data.isSystem ?? false,
    },
  });
}

export async function getWorkflowTemplates(orgId: string, category?: string) {
  const where: Record<string, unknown> = { orgId };
  if (category) where.category = category;
  return prisma.workflowTemplate.findMany({
    where,
    orderBy: { useCount: 'desc' },
  });
}

export async function getWorkflowTemplate(orgId: string, templateId: string) {
  const template = await prisma.workflowTemplate.findFirst({
    where: { id: templateId, orgId },
  });
  if (!template) throw Object.assign(new Error('Template not found'), { status: 404 });
  return template;
}

export async function deleteWorkflowTemplate(orgId: string, templateId: string) {
  const template = await prisma.workflowTemplate.findFirst({
    where: { id: templateId, orgId },
  });
  if (!template) throw Object.assign(new Error('Template not found'), { status: 404 });
  if (template.isSystem) throw Object.assign(new Error('Cannot delete system templates'), { status: 400 });
  await prisma.workflowTemplate.delete({ where: { id: templateId } });
}

/**
 * Instantiate a template: copy its templateData into a new AutomationRule
 * with associated WorkflowNodes.
 */
export async function instantiateTemplate(orgId: string, templateId: string, name: string) {
  const template = await getWorkflowTemplate(orgId, templateId);
  const td = template.templateData as Record<string, unknown>;

  // Create the rule
  const rule = await prisma.automationRule.create({
    data: {
      orgId,
      name,
      trigger: (td.trigger as string) || 'LEAD_CREATED',
      triggerConfig: (td.triggerConfig as any) || undefined,
      actions: (td.actions as any) || [],
      enabled: false,
    },
  });

  // Create associated nodes
  const nodes = (td.nodes as Array<Record<string, unknown>>) || [];
  for (const n of nodes) {
    await prisma.workflowNode.create({
      data: {
        orgId,
        ruleId: rule.id,
        nodeType: (n.nodeType as string) || 'ACTION',
        label: (n.label as string) || 'Untitled',
        config: (n.config as any) || undefined,
        positionX: (n.positionX as number) ?? 0,
        positionY: (n.positionY as number) ?? 0,
        connections: (n.connections as any) || undefined,
        branches: (n.branches as any) || undefined,
      },
    });
  }

  // Increment use count
  await prisma.workflowTemplate.update({
    where: { id: templateId },
    data: { useCount: { increment: 1 } },
  });

  return rule;
}

// ── Helper: Serialize ───────────────────────────────────────

export function serializeNode(n: any) {
  return {
    id: n.id,
    ruleId: n.ruleId,
    nodeType: n.nodeType,
    label: n.label,
    config: n.config || {},
    positionX: n.positionX,
    positionY: n.positionY,
    connections: n.connections || [],
    branches: n.branches || [],
    enabled: n.enabled,
    createdAt: n.createdAt,
    updatedAt: n.updatedAt,
  };
}

export function serializeTemplate(t: any) {
  return {
    id: t.id,
    name: t.name,
    description: t.description,
    category: t.category,
    templateData: t.templateData,
    isSystem: t.isSystem,
    useCount: t.useCount,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}

// ── Default System Templates ────────────────────────────────

export const SYSTEM_TEMPLATES: Array<{
  name: string;
  description: string;
  category: string;
  templateData: Record<string, unknown>;
}> = [
  {
    name: 'New Inbound Lead',
    description: 'When a new lead is created, assign owner, create follow-up task, and enrich contact.',
    category: 'INBOUND',
    templateData: {
      trigger: 'LEAD_CREATED',
      triggerConfig: {},
      actions: [
        { type: 'ASSIGN_USER', mode: 'roundRobin' },
        { type: 'CREATE_TASK', title: 'Follow up with new lead', kind: 'FOLLOW_UP', dueInDays: 1 },
        { type: 'ADD_TAG', tag: 'inbound' },
      ],
      nodes: [
        { nodeType: 'TRIGGER', label: 'New Lead Created', config: { trigger: 'LEAD_CREATED' }, positionX: 0, positionY: 0 },
        { nodeType: 'ACTION', label: 'Assign Owner', config: { actionType: 'ASSIGN_USER', mode: 'roundRobin' }, positionX: 0, positionY: 100 },
        { nodeType: 'ACTION', label: 'Create Follow-up', config: { actionType: 'CREATE_TASK', title: 'Follow up with new lead', dueInDays: 1 }, positionX: 0, positionY: 200 },
        { nodeType: 'ACTION', label: 'Tag as Inbound', config: { actionType: 'ADD_TAG', tag: 'inbound' }, positionX: 0, positionY: 300 },
      ],
    },
  },
  {
    name: 'High Intent Lead',
    description: 'When a lead has high score, create deal and notify the team.',
    category: 'SCORING',
    templateData: {
      trigger: 'LEAD_SCORE_CHANGED',
      triggerConfig: { minScore: 80 },
      actions: [
        { type: 'ADD_TAG', tag: 'high-intent' },
        { type: 'CREATE_DEAL', dealName: 'High Intent Deal' },
        { type: 'NOTIFY_TEAM', message: 'New high-intent lead detected!' },
      ],
      nodes: [
        { nodeType: 'TRIGGER', label: 'Lead Score ≥ 80', config: { trigger: 'LEAD_SCORE_CHANGED', minScore: 80 }, positionX: 0, positionY: 0 },
        { nodeType: 'ACTION', label: 'Tag as High Intent', config: { actionType: 'ADD_TAG', tag: 'high-intent' }, positionX: 0, positionY: 100 },
        { nodeType: 'ACTION', label: 'Create Deal', config: { actionType: 'CREATE_DEAL' }, positionX: 0, positionY: 200 },
        { nodeType: 'ACTION', label: 'Notify Team', config: { actionType: 'NOTIFY_TEAM' }, positionX: 0, positionY: 300 },
      ],
    },
  },
  {
    name: 'No Reply Follow-up',
    description: 'When a sequence has no reply after 3 days, create a manual follow-up task.',
    category: 'SEQUENCES',
    templateData: {
      trigger: 'SEQUENCE_COMPLETED',
      triggerConfig: {},
      actions: [
        { type: 'CREATE_TASK', title: 'Manual follow-up — no reply to sequence', kind: 'FOLLOW_UP', dueInDays: 0 },
        { type: 'ADD_TAG', tag: 'needs-manual-followup' },
      ],
      nodes: [
        { nodeType: 'TRIGGER', label: 'Sequence Completed (No Reply)', config: { trigger: 'SEQUENCE_COMPLETED' }, positionX: 0, positionY: 0 },
        { nodeType: 'ACTION', label: 'Create Manual Follow-up', config: { actionType: 'CREATE_TASK', title: 'Manual follow-up — no reply to sequence', dueInDays: 0 }, positionX: 0, positionY: 100 },
        { nodeType: 'ACTION', label: 'Tag Needs Manual Follow-up', config: { actionType: 'ADD_TAG', tag: 'needs-manual-followup' }, positionX: 0, positionY: 200 },
      ],
    },
  },
  {
    name: 'Deal Stalled',
    description: 'When a deal hasn\'t moved in 7 days, alert manager and create re-engagement task.',
    category: 'DEALS',
    templateData: {
      trigger: 'DEAL_STAGE_CHANGED',
      triggerConfig: { stalledDays: 7 },
      actions: [
        { type: 'NOTIFY_TEAM', message: 'Deal has stalled for 7+ days', role: 'MANAGER' },
        { type: 'CREATE_TASK', title: 'Re-engage stalled deal', kind: 'FOLLOW_UP', dueInDays: 0 },
      ],
      nodes: [
        { nodeType: 'TRIGGER', label: 'Deal Stalled 7+ Days', config: { trigger: 'DEAL_STAGE_CHANGED', stalledDays: 7 }, positionX: 0, positionY: 0 },
        { nodeType: 'ACTION', label: 'Alert Manager', config: { actionType: 'NOTIFY_TEAM', role: 'MANAGER' }, positionX: 0, positionY: 100 },
        { nodeType: 'ACTION', label: 'Create Re-engagement Task', config: { actionType: 'CREATE_TASK', title: 'Re-engage stalled deal', dueInDays: 0 }, positionX: 0, positionY: 200 },
      ],
    },
  },
  {
    name: 'New Funding Signal',
    description: 'When a company gets new funding, research and create outreach task.',
    category: 'SIGNALS',
    templateData: {
      trigger: 'SIGNAL_DETECTED',
      triggerConfig: { signalType: 'FUNDING' },
      actions: [
        { type: 'AI_RESEARCH', researchType: 'company' },
        { type: 'CREATE_TASK', title: 'Outreach to newly funded company', kind: 'FOLLOW_UP', dueInDays: 0 },
        { type: 'ADD_TAG', tag: 'funded' },
      ],
      nodes: [
        { nodeType: 'TRIGGER', label: 'Funding Signal Detected', config: { trigger: 'SIGNAL_DETECTED', signalType: 'FUNDING' }, positionX: 0, positionY: 0 },
        { nodeType: 'AI_ACTION', label: 'AI Research Company', config: { actionType: 'AI_RESEARCH', researchType: 'company' }, positionX: 0, positionY: 100 },
        { nodeType: 'ACTION', label: 'Create Outreach Task', config: { actionType: 'CREATE_TASK', title: 'Outreach to newly funded company', dueInDays: 0 }, positionX: 0, positionY: 200 },
        { nodeType: 'ACTION', label: 'Tag as Funded', config: { actionType: 'ADD_TAG', tag: 'funded' }, positionX: 0, positionY: 300 },
      ],
    },
  },
  {
    name: 'New Website Visitor',
    description: 'When a high-value website visit is detected, create lead and enrich.',
    category: 'INBOUND',
    templateData: {
      trigger: 'WEBSITE_VISIT',
      triggerConfig: { minScore: 70 },
      actions: [
        { type: 'ENRICH_CONTACT' },
        { type: 'CREATE_TASK', title: 'Follow up with website visitor', kind: 'FOLLOW_UP', dueInDays: 0 },
        { type: 'ADD_TAG', tag: 'website-visitor' },
      ],
      nodes: [
        { nodeType: 'TRIGGER', label: 'High-Value Website Visit', config: { trigger: 'WEBSITE_VISIT', minScore: 70 }, positionX: 0, positionY: 0 },
        { nodeType: 'ACTION', label: 'Enrich Contact', config: { actionType: 'ENRICH_CONTACT' }, positionX: 0, positionY: 100 },
        { nodeType: 'ACTION', label: 'Create Follow-up Task', config: { actionType: 'CREATE_TASK', title: 'Follow up with website visitor', dueInDays: 0 }, positionX: 0, positionY: 200 },
        { nodeType: 'ACTION', label: 'Tag as Website Visitor', config: { actionType: 'ADD_TAG', tag: 'website-visitor' }, positionX: 0, positionY: 300 },
      ],
    },
  },
];
