/**
 * Phase 13 — Compliance center routes.
 *
 * GET    /api/compliance/consent           — list consent records
 * POST   /api/compliance/consent           — record consent
 * GET    /api/compliance/consent/check     — check if contact has valid consent
 * GET    /api/compliance/suppression       — list suppressed entries
 * POST   /api/compliance/suppression       — add suppression
 * DELETE /api/compliance/suppression/:id   — remove suppression
 * GET    /api/compliance/suppression/stats — suppression stats
 * POST   /api/compliance/suppression/bulk-check — bulk check suppression
 * GET    /api/compliance/retention         — list retention policies
 * POST   /api/compliance/retention         — create policy
 * PATCH  /api/compliance/retention/:id     — update policy
 * DELETE /api/compliance/retention/:id     — delete policy
 * POST   /api/compliance/retention/:id/run — execute policy
 * GET    /api/compliance/data-requests     — list data access requests
 * POST   /api/compliance/data-requests     — create data access request
 * PATCH  /api/compliance/data-requests/:id — complete request
 * GET    /api/compliance/data-requests/stats — stats
 * GET    /api/compliance/dashboard         — full compliance dashboard
 */
import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, badRequest, ok, validate } from '../lib/http';
import { requireAuth, requirePermission, type AuthedRequest } from '../middleware/auth';
import { audit } from '../lib/audit';
import {
  recordConsent,
  getConsentHistory,
  hasValidConsent,
  addSuppression,
  getSuppressions,
  removeSuppression,
  getSuppressionStats,
  filterSuppressedContacts,
} from '../services/consent';
import {
  getRetentionPolicies,
  createRetentionPolicy,
  updateRetentionPolicy,
  deleteRetentionPolicy,
  executeRetentionPolicy,
  createDataAccessRequest,
  getDataAccessRequests,
  completeDataAccessRequest,
  getDataAccessStats,
} from '../services/data-export';
import { prisma } from '../lib/prisma';

const router = Router();
router.use(requireAuth);

// ── Consent ──────────────────────────────────────────────────

const consentSchema = z.object({
  contactId: z.string().optional(),
  companyId: z.string().optional(),
  type: z.enum(['MARKETING_EMAIL', 'MARKETING_SMS', 'MARKETING_CALL', 'DATA_PROCESSING', 'DATA_SHARING', 'COOKIES', 'THIRD_PARTY']),
  status: z.enum(['GRANTED', 'DENIED', 'WITHDRAWN']),
  source: z.string().optional(),
  sourceRef: z.string().optional(),
  evidence: z.string().optional(),
  lawfulBasis: z.string().optional(),
  version: z.string().optional(),
});

router.get('/consent', requirePermission('contacts.view'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const contactId = String(req.query.contactId || '');
  const records = await getConsentHistory(user.orgId, contactId || undefined);
  return ok(res, { records });
}));

router.post('/consent', requirePermission('contacts.manage'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const input = validate(consentSchema, req.body);
  const record = await recordConsent(user.orgId, {
    ...input,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });
  await audit({
    orgId: user.orgId,
    userId: user.id,
    action: 'CONSENT_RECORDED',
    entity: 'ConsentRecord',
    entityId: record.id,
    metadata: { type: input.type, status: input.status, contactId: input.contactId },
    req,
  });
  return ok(res, { record }, 201);
}));

router.get('/consent/check', requirePermission('contacts.view'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const contactId = String(req.query.contactId || '');
  const type = String(req.query.type || '');
  if (!contactId || !type) throw badRequest('contactId and type are required.');
  const valid = await hasValidConsent(user.orgId, contactId, type);
  return ok(res, { hasConsent: valid });
}));

// ── Suppression ──────────────────────────────────────────────

const suppressionSchema = z.object({
  type: z.enum(['EMAIL', 'EMAIL_DOMAIN', 'PHONE', 'IP', 'CONTACT', 'DOMAIN']),
  value: z.string().min(1),
  contactId: z.string().optional(),
  companyId: z.string().optional(),
  reason: z.enum(['UNSUBSCRIBE', 'BOUNCE', 'SPAM_COMPLAINT', 'MANUAL', 'REGULATION', 'DOMAIN_BLOCK']),
  reasonDetail: z.string().optional(),
  isGlobal: z.boolean().optional(),
  expiresAt: z.string().datetime().optional(),
});

router.get('/suppression', requirePermission('contacts.view'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const type = String(req.query.type || '');
  const entries = await getSuppressions(user.orgId, type || undefined);
  return ok(res, { entries });
}));

router.post('/suppression', requirePermission('contacts.manage'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const input = validate(suppressionSchema, req.body);
  const entry = await addSuppression(user.orgId, {
    ...input,
    source: 'MANUAL',
    expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
  });
  await audit({
    orgId: user.orgId,
    userId: user.id,
    action: 'SUPPRESSION_ADDED',
    entity: 'SuppressionEntry',
    entityId: entry.id,
    metadata: { type: input.type, value: input.value, reason: input.reason },
    req,
  });
  return ok(res, { entry }, 201);
}));

router.delete('/suppression/:id', requirePermission('contacts.manage'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const entry = await removeSuppression(user.orgId, req.params.id, user.id);
  await audit({
    orgId: user.orgId,
    userId: user.id,
    action: 'SUPPRESSION_REMOVED',
    entity: 'SuppressionEntry',
    entityId: req.params.id,
    req,
  });
  return ok(res, { entry });
}));

router.get('/suppression/stats', requirePermission('contacts.view'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const stats = await getSuppressionStats(user.orgId);
  return ok(res, stats);
}));

const bulkCheckSchema = z.object({
  type: z.enum(['EMAIL', 'PHONE']),
  values: z.array(z.string()).min(1).max(1000),
});

router.post('/suppression/bulk-check', requirePermission('contacts.view'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const input = validate(bulkCheckSchema, req.body);
  const result = await filterSuppressedContacts(user.orgId, input.type, input.values);
  return ok(res, result);
}));

// ── Retention Policies ───────────────────────────────────────

const retentionSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  entityType: z.enum(['CONTACT', 'COMPANY', 'LEAD', 'CONVERSATION', 'CALL_RECORDING', 'FORM_SUBMISSION', 'ACTIVITY', 'AUDIT_LOG', 'ALL']),
  retentionDays: z.number().int().min(1),
  autoDelete: z.boolean().optional(),
  actionBeforeDelete: z.string().optional(),
  notifyBeforeDelete: z.boolean().optional(),
  notifyEmail: z.string().email().optional(),
  notifyDaysBefore: z.number().int().optional(),
});

router.get('/retention', requirePermission('settings.manage'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const policies = await getRetentionPolicies(user.orgId);
  return ok(res, { policies });
}));

router.post('/retention', requirePermission('settings.manage'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const input = validate(retentionSchema, req.body);
  const policy = await createRetentionPolicy(user.orgId, input);
  await audit({
    orgId: user.orgId,
    userId: user.id,
    action: 'RETENTION_POLICY_CREATED',
    entity: 'RetentionPolicy',
    entityId: policy.id,
    metadata: { name: input.name, entityType: input.entityType, retentionDays: input.retentionDays },
    req,
  });
  return ok(res, { policy }, 201);
}));

router.patch('/retention/:id', requirePermission('settings.manage'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const input = validate(retentionSchema.partial(), req.body);
  const policy = await updateRetentionPolicy(user.orgId, req.params.id, input);
  return ok(res, { policy });
}));

router.delete('/retention/:id', requirePermission('settings.manage'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  await deleteRetentionPolicy(user.orgId, req.params.id);
  return ok(res, { deleted: true });
}));

router.post('/retention/:id/run', requirePermission('settings.manage'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const result = await executeRetentionPolicy(user.orgId, req.params.id);
  await audit({
    orgId: user.orgId,
    userId: user.id,
    action: 'RETENTION_POLICY_EXECUTED',
    entity: 'RetentionPolicy',
    entityId: req.params.id,
    metadata: result,
    req,
  });
  return ok(res, result);
}));

// ── Data Access Requests ─────────────────────────────────────

const dataRequestSchema = z.object({
  type: z.enum(['ACCESS', 'DELETION', 'RECTIFICATION', 'PORTABILITY', 'RESTRICTION', 'OBJECTION']),
  userId: z.string().optional(),
  contactEmail: z.string().email().optional(),
  contactId: z.string().optional(),
  description: z.string().optional(),
});

router.get('/data-requests', requirePermission('settings.manage'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const status = String(req.query.status || '');
  const requests = await getDataAccessRequests(user.orgId, status || undefined);
  return ok(res, { requests });
}));

router.post('/data-requests', requirePermission('settings.manage'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const input = validate(dataRequestSchema, req.body);
  const request = await createDataAccessRequest(user.orgId, input, req.ip);
  await audit({
    orgId: user.orgId,
    userId: user.id,
    action: 'DATA_REQUEST_CREATED',
    entity: 'DataAccessRequest',
    entityId: request.id,
    metadata: { type: input.type, contactEmail: input.contactEmail },
    req,
  });
  return ok(res, { request }, 201);
}));

const completeRequestSchema = z.object({
  status: z.enum(['COMPLETED', 'DENIED']),
  responseNotes: z.string().optional(),
  dataProvided: z.boolean().optional(),
  dataDeleted: z.boolean().optional(),
  dataAnonymized: z.boolean().optional(),
});

router.patch('/data-requests/:id', requirePermission('settings.manage'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const input = validate(completeRequestSchema, req.body);
  const request = await completeDataAccessRequest(user.orgId, req.params.id, {
    ...input,
    completedBy: user.id,
  });
  await audit({
    orgId: user.orgId,
    userId: user.id,
    action: 'DATA_REQUEST_COMPLETED',
    entity: 'DataAccessRequest',
    entityId: req.params.id,
    metadata: { status: input.status },
    req,
  });
  return ok(res, { request });
}));

router.get('/data-requests/stats', requirePermission('settings.manage'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;
  const stats = await getDataAccessStats(user.orgId);
  return ok(res, stats);
}));

// ── Compliance Dashboard ─────────────────────────────────────

router.get('/dashboard', requirePermission('settings.manage'), asyncHandler(async (req, res) => {
  const user = (req as AuthedRequest).user;

  const [consentCount, suppressionCount, dataRequests, retentionPolicies, recentConsents] = await Promise.all([
    prisma.consentRecord.count({ where: { orgId: user.orgId } }),
    prisma.suppressionEntry.count({ where: { orgId: user.orgId, removedAt: null } }),
    getDataAccessStats(user.orgId),
    getRetentionPolicies(user.orgId),
    prisma.consentRecord.findMany({
      where: { orgId: user.orgId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
  ]);

  const overdueRequests = await prisma.dataAccessRequest.count({
    where: {
      orgId: user.orgId,
      status: { in: ['PENDING', 'IN_PROGRESS'] },
      deadlineAt: { lt: new Date() },
    },
  });

  return ok(res, {
    summary: {
      totalConsents: consentCount,
      totalSuppressions: suppressionCount,
      overdueDataRequests: overdueRequests,
      activeRetentionPolicies: retentionPolicies.filter((p) => p.isActive).length,
    },
    dataRequests,
    retentionPolicies,
    recentConsents,
  });
}));

export default router;
