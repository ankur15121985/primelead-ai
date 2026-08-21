/**
 * Enhanced Workflow routes (Phase 9).
 *
 *   GET    /api/workflows/triggers         — available trigger types
 *   GET    /api/workflows/actions          — available action types
 *   GET    /api/workflows/nodes            — visual nodes (optionally filtered by ruleId)
 *   POST   /api/workflows/nodes            — create a node
 *   PATCH  /api/workflows/nodes/:id        — update a node
 *   DELETE /api/workflows/nodes/:id        — delete a node
 *   GET    /api/workflows/templates        — templates
 *   POST   /api/workflows/templates        — create template
 *   DELETE /api/workflows/templates/:id    — delete template
 *   POST   /api/workflows/templates/:id/instantiate — create rule from template
 */
import { Router } from 'express';
import { asyncHandler, badRequest, notFound, ok, validate } from '../lib/http';
import { requireAuth, requirePermission, type AuthedRequest } from '../middleware/auth';
import { z } from 'zod';
import {
  WORKFLOW_TRIGGERS, WORKFLOW_ACTIONS, NODE_TYPES,
  createWorkflowNode, getWorkflowNodes, updateWorkflowNode, deleteWorkflowNode,
  createWorkflowTemplate, getWorkflowTemplates, getWorkflowTemplate,
  deleteWorkflowTemplate, instantiateTemplate,
  serializeNode, serializeTemplate,
} from '../services/workflows';
import { audit } from '../lib/audit';

const router = Router();
router.use(requireAuth);

// ── Meta ────────────────────────────────────────────────────

router.get('/triggers', requirePermission('automation.view'), (_req, res) => {
  return ok(res, { triggers: WORKFLOW_TRIGGERS });
});

router.get('/actions', requirePermission('automation.view'), (_req, res) => {
  return ok(res, { actions: WORKFLOW_ACTIONS, nodeTypes: NODE_TYPES });
});

// ── Nodes ───────────────────────────────────────────────────

const nodeSchema = z.object({
  ruleId: z.string().optional(),
  nodeType: z.string(),
  label: z.string().min(1).max(100),
  config: z.record(z.unknown()).optional(),
  positionX: z.number().optional(),
  positionY: z.number().optional(),
  connections: z.array(z.string()).optional(),
  branches: z.array(z.object({ label: z.string(), connectionId: z.string() })).optional(),
  enabled: z.boolean().optional(),
});

router.get('/nodes', requirePermission('automation.view'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const ruleId = (req.query.ruleId as string) || undefined;
  const nodes = await getWorkflowNodes(user.orgId, ruleId);
  return ok(res, { nodes: nodes.map(serializeNode) });
}));

router.post('/nodes', requirePermission('automation.manage'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const input = validate(nodeSchema, req.body) as any;
  const node = await createWorkflowNode(user.orgId, input);
  await audit({ orgId: user.orgId, userId: user.id, action: 'WORKFLOW_NODE_CREATED', entity: 'WorkflowNode', entityId: node.id, req });
  return ok(res, { node: serializeNode(node) }, 201);
}));

router.patch('/nodes/:id', requirePermission('automation.manage'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const input = validate(nodeSchema.partial(), req.body) as any;
  const node = await updateWorkflowNode(user.orgId, req.params.id, input);
  await audit({ orgId: user.orgId, userId: user.id, action: 'WORKFLOW_NODE_UPDATED', entity: 'WorkflowNode', entityId: node.id, req });
  return ok(res, { node: serializeNode(node) });
}));

router.delete('/nodes/:id', requirePermission('automation.manage'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  await deleteWorkflowNode(user.orgId, req.params.id);
  await audit({ orgId: user.orgId, userId: user.id, action: 'WORKFLOW_NODE_DELETED', entity: 'WorkflowNode', entityId: req.params.id, req });
  return ok(res, { deleted: true });
}));

// ── Templates ───────────────────────────────────────────────

const templateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  category: z.string().max(50).optional(),
  templateData: z.record(z.unknown()),
});

router.get('/templates', requirePermission('automation.view'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const category = (req.query.category as string) || undefined;
  const templates = await getWorkflowTemplates(user.orgId, category);
  return ok(res, { templates: templates.map(serializeTemplate) });
}));

router.post('/templates', requirePermission('automation.manage'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const input = validate(templateSchema, req.body);
  const template = await createWorkflowTemplate(user.orgId, input);
  await audit({ orgId: user.orgId, userId: user.id, action: 'WORKFLOW_TEMPLATE_CREATED', entity: 'WorkflowTemplate', entityId: template.id, req });
  return ok(res, { template: serializeTemplate(template) }, 201);
}));

router.delete('/templates/:id', requirePermission('automation.manage'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  await deleteWorkflowTemplate(user.orgId, req.params.id);
  await audit({ orgId: user.orgId, userId: user.id, action: 'WORKFLOW_TEMPLATE_DELETED', entity: 'WorkflowTemplate', entityId: req.params.id, req });
  return ok(res, { deleted: true });
}));

router.post('/templates/:id/instantiate', requirePermission('automation.manage'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const name = String((req.body as any)?.name || '').trim();
  if (!name) throw badRequest('A name is required for the new workflow.');
  const rule = await instantiateTemplate(user.orgId, req.params.id, name);
  await audit({ orgId: user.orgId, userId: user.id, action: 'WORKFLOW_TEMPLATE_INSTANTIATED', entity: 'AutomationRule', entityId: rule.id, metadata: { templateId: req.params.id }, req });
  return ok(res, { rule: { id: rule.id, name: rule.name, trigger: rule.trigger, enabled: rule.enabled } }, 201);
}));

export default router;
