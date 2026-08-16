/**
 * Automation engine routes.
 *
 *   GET    /api/automations          — rules + recent runs summary
 *   POST   /api/automations          — create a rule (automation.manage)
 *   PATCH  /api/automations/:id      — rename / retrigger / re-actions / enable
 *   DELETE /api/automations/:id      — delete a rule
 *   POST   /api/automations/:id/run  — manual run against a lead
 *   GET    /api/automations/runs     — recent run log
 */
import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { asyncHandler, badRequest, notFound, ok, validate } from '../lib/http';
import { requireAuth, requirePermission, type AuthedRequest } from '../middleware/auth';
import { automationRuleSchema } from '../validators/schemas';
import { runAutomationTrigger, serializeRule, TRIGGERS } from '../services/automation';
import { audit } from '../lib/audit';

const router = Router();
router.use(requireAuth);

router.get(
  '/',
  requirePermission('automation.view'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const rules = await prisma.automationRule.findMany({ where: { orgId: user.orgId }, orderBy: { createdAt: 'desc' } });
    const runs = await prisma.automationRun.findMany({
      where: { orgId: user.orgId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { rule: { select: { name: true } } },
    });
    return ok(res, {
      rules: rules.map(serializeRule),
      runs: runs.map((r) => ({
        id: r.id,
        trigger: r.trigger,
        ruleName: r.rule?.name || null,
        entityType: r.entityType,
        status: r.status,
        result: r.result,
        createdAt: r.createdAt,
      })),
      triggers: TRIGGERS,
    });
  })
);

router.post(
  '/',
  requirePermission('automation.manage'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const input = validate(automationRuleSchema, req.body);

    const count = await prisma.automationRule.count({ where: { orgId: user.orgId } });
    if (count >= 50) throw badRequest('You have reached the limit of 50 automation rules per workspace.');

    const rule = await prisma.automationRule.create({
      data: {
        orgId: user.orgId,
        name: input.name,
        trigger: input.trigger,
        triggerConfig: input.triggerConfig || undefined,
        actions: input.actions as any,
        enabled: input.enabled !== false,
      },
    });
    await audit({ orgId: user.orgId, userId: user.id, action: 'AUTOMATION_CREATED', entity: 'AutomationRule', entityId: rule.id, metadata: { trigger: rule.trigger }, req });
    return ok(res, { rule: serializeRule(rule) }, 201);
  })
);

router.patch(
  '/:id',
  requirePermission('automation.manage'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const existing = await prisma.automationRule.findFirst({ where: { id: req.params.id, orgId: user.orgId } });
    if (!existing) throw notFound('Automation rule not found');

    const input = validate(automationRuleSchema.partial(), req.body);
    const data: Record<string, unknown> = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.trigger !== undefined) data.trigger = input.trigger;
    if (input.triggerConfig !== undefined) data.triggerConfig = input.triggerConfig;
    if (input.actions !== undefined) data.actions = input.actions;
    if (input.enabled !== undefined) data.enabled = input.enabled;

    const rule = await prisma.automationRule.update({ where: { id: existing.id }, data });
    await audit({ orgId: user.orgId, userId: user.id, action: 'AUTOMATION_UPDATED', entity: 'AutomationRule', entityId: existing.id, req });
    return ok(res, { rule: serializeRule(rule) });
  })
);

router.delete(
  '/:id',
  requirePermission('automation.manage'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const existing = await prisma.automationRule.findFirst({ where: { id: req.params.id, orgId: user.orgId } });
    if (!existing) throw notFound('Automation rule not found');
    await prisma.automationRule.delete({ where: { id: existing.id } });
    await audit({ orgId: user.orgId, userId: user.id, action: 'AUTOMATION_DELETED', entity: 'AutomationRule', entityId: existing.id, req });
    return ok(res, { deleted: true });
  })
);

/** Manual run — immediately evaluate the rule against a lead (or fresh context). */
router.post(
  '/:id/run',
  requirePermission('automation.manage'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const rule = await prisma.automationRule.findFirst({ where: { id: req.params.id, orgId: user.orgId } });
    if (!rule) throw notFound('Automation rule not found');

    let ctx: Parameters<typeof runAutomationTrigger>[2] = { entityType: 'LEAD', entityId: 'manual' };
    const leadId = String((req.body as any)?.leadId || '').trim();
    if (leadId) {
      const lead = await prisma.lead.findFirst({ where: { id: leadId, orgId: user.orgId, deletedAt: null } });
      if (!lead) throw badRequest('Lead not found');
      ctx = {
        leadId: lead.id,
        leadName: lead.name,
        leadSource: lead.source,
        ownerId: lead.ownerId || undefined,
        userId: user.id,
        stageId: lead.stageId || undefined,
        entityType: 'LEAD',
        entityId: lead.id,
      };
    }

    // Evaluate this rule directly (works even while paused — test before enabling).
    await runAutomationTrigger(user.orgId, rule.trigger as any, ctx, rule.id);
    const run = await prisma.automationRun.findFirst({
      where: { orgId: user.orgId, ruleId: rule.id },
      orderBy: { createdAt: 'desc' },
      take: 1,
    });
    return ok(res, { executed: Boolean(run), run });
  })
);

router.get(
  '/runs',
  requirePermission('automation.view'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const runs = await prisma.automationRun.findMany({
      where: { orgId: user.orgId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { rule: { select: { name: true } } },
    });
    return ok(res, {
      runs: runs.map((r) => ({
        id: r.id,
        trigger: r.trigger,
        ruleName: r.rule?.name || null,
        entityType: r.entityType,
        status: r.status,
        result: r.result,
        createdAt: r.createdAt,
      })),
    });
  })
);

export default router;
