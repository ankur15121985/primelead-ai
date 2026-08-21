/**
 * AI Research & Recommendations routes (Phase 10).
 *
 *   GET    /api/ai-research/reports                  — list reports
 *   POST   /api/ai-research/company/:companyId        — research a company
 *   POST   /api/ai-research/contact/:contactId        — research a contact
 *   DELETE /api/ai-research/reports/:id                — delete a report
 *   GET    /api/ai-recommendations                     — list recommendations
 *   POST   /api/ai-recommendations/generate            — generate new recommendations
 *   POST   /api/ai-recommendations/:id/accept          — accept a recommendation
 *   POST   /api/ai-recommendations/:id/dismiss         — dismiss a recommendation
 *   GET    /api/ai-usage/users                         — per-user AI usage breakdown
 *   GET    /api/ai-usage/my                            — current user AI usage
 */
import { Router } from 'express';
import { asyncHandler, badRequest, notFound, ok } from '../lib/http';
import { requireAuth, requirePermission, type AuthedRequest } from '../middleware/auth';
import { audit } from '../lib/audit';
import {
  researchCompany, researchContact, getResearchReports, deleteResearchReport,
} from '../services/ai-research';
import {
  generateRecommendations, getRecommendations, acceptRecommendation,
  dismissRecommendation, getUserAiUsage, getAllUsersAiUsage,
} from '../services/ai-recommendations';

const router = Router();
router.use(requireAuth);

// ── Research Reports ────────────────────────────────────────

router.get(
  '/reports',
  requirePermission('ai.use'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const reports = await getResearchReports(user.orgId, {
      reportType: (req.query.type as string) || undefined,
      companyId: (req.query.companyId as string) || undefined,
      contactId: (req.query.contactId as string) || undefined,
      limit: Number(req.query.limit) || 20,
    });
    return ok(res, { reports });
  })
);

router.post(
  '/company/:companyId',
  requirePermission('ai.use'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const { report, fromCache } = await researchCompany(user.orgId, req.params.companyId, user.id);
    await audit({ orgId: user.orgId, userId: user.id, action: 'AI_RESEARCH_COMPANY', entity: 'Company', entityId: req.params.companyId, req });
    return ok(res, { report, fromCache });
  })
);

router.post(
  '/contact/:contactId',
  requirePermission('ai.use'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const { report, fromCache } = await researchContact(user.orgId, req.params.contactId, user.id);
    await audit({ orgId: user.orgId, userId: user.id, action: 'AI_RESEARCH_CONTACT', entity: 'CompanyContact', entityId: req.params.contactId, req });
    return ok(res, { report, fromCache });
  })
);

router.delete(
  '/reports/:id',
  requirePermission('ai.use'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    await deleteResearchReport(user.orgId, req.params.id);
    return ok(res, { deleted: true });
  })
);

// ── Recommendations ─────────────────────────────────────────

router.get(
  '/',
  requirePermission('ai.use'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const recs = await getRecommendations(user.orgId, user.id, {
      type: (req.query.type as string) || undefined,
      status: (req.query.status as string) || undefined,
      limit: Number(req.query.limit) || 20,
    });
    return ok(res, { recommendations: recs });
  })
);

router.post(
  '/generate',
  requirePermission('ai.use'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const recs = await generateRecommendations(user.orgId, user.id, (req.body as any)?.type, Number((req.body as any)?.limit) || 10);
    await audit({ orgId: user.orgId, userId: user.id, action: 'AI_RECOMMENDATIONS_GENERATED', req });
    return ok(res, { recommendations: recs });
  })
);

router.post(
  '/:id/accept',
  requirePermission('ai.use'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const rec = await acceptRecommendation(user.orgId, req.params.id);
    return ok(res, { recommendation: rec });
  })
);

router.post(
  '/:id/dismiss',
  requirePermission('ai.use'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const rec = await dismissRecommendation(user.orgId, req.params.id);
    return ok(res, { recommendation: rec });
  })
);

// ── Per-User AI Usage ───────────────────────────────────────

router.get(
  '/usage/users',
  requirePermission('admin.view'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const usage = await getAllUsersAiUsage(user.orgId);
    return ok(res, { users: usage });
  })
);

router.get(
  '/usage/my',
  requirePermission('ai.use'),
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const usage = await getUserAiUsage(user.orgId, user.id);
    return ok(res, { usage });
  })
);

export default router;
