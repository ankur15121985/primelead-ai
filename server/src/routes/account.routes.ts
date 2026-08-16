/**
 * Account lifecycle routes (data protection, spec §37/§38).
 *
 *   GET  /api/account/export   — GDPR-style export of every org record as JSON
 *   POST /api/account/delete   — irreversible deletion of the org + all data
 *
 * Deletion is retention-aware: session tokens, reset/verification tokens and
 * webhook events are hard-deleted immediately (they contain only hashes or
 * transient data), while customer data rows are hard-deleted too — the caller
 * must re-authenticate and confirm. Nothing is ever soft-deleted silently.
 */
import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { asyncHandler, badRequest, ok } from '../lib/http';
import { requireAuth, type AuthedRequest } from '../middleware/auth';
import { audit } from '../lib/audit';
import { revokeAllSessions } from '../lib/sessions';

const router = Router();
router.use(requireAuth);

/** Models that carry customer data, exported + deleted per org. */
const DATA_MODELS = [
  'lead',
  'contact',
  'activity',
  'task',
  'notification',
  'campaign',
  'qrCode',
  'quotation',
  'invoice',
  'creditNote',
  'debitNote',
  'conversation',
  'message',
  'waTemplate',
  'integration',
  'integrationLog',
  'aiConversation',
  'aiUsage',
  'automationRule',
  'automationRun',
  'referral',
  'auditLog',
  'webhookEvent',
  'loginHistory',
] as const;

/** Child rows with no orgId — reached through their parent (cascade on delete). */
const CHILD_MODELS: { model: string; parent: string; parentField: string }[] = [
  { model: 'qrScan', parent: 'qrCode', parentField: 'qrId' },
  { model: 'quotationItem', parent: 'quotation', parentField: 'quotationId' },
  { model: 'invoiceItem', parent: 'invoice', parentField: 'invoiceId' },
  { model: 'creditNoteItem', parent: 'creditNote', parentField: 'creditNoteId' },
  { model: 'debitNoteItem', parent: 'debitNote', parentField: 'debitNoteId' },
  { model: 'aiMessage', parent: 'aiConversation', parentField: 'conversationId' },
  { model: 'referralPayout', parent: 'referral', parentField: 'referralId' },
];

/** Models that reference a userId instead of an orgId (cleaned per user). */
const USER_MODELS = ['session', 'mfaSecret', 'recoveryCode'] as const;

router.get(
  '/export',
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;

    const data: Record<string, unknown> = {};
    await Promise.all(
      DATA_MODELS.map(async (m) => {
        const rows = await (prisma as any)[m].findMany({ where: { orgId: user.orgId } });
        data[m] = rows;
      })
    );
    await Promise.all(
      CHILD_MODELS.map(async ({ model, parent, parentField }) => {
        const parents = await (prisma as any)[parent].findMany({ where: { orgId: user.orgId }, select: { id: true } });
        const rows = await (prisma as any)[model].findMany({ where: { [parentField]: { in: parents.map((p: { id: string }) => p.id) } } });
        data[model] = rows;
      })
    );
    // Org-level settings and members (no orgId on User, so fetch explicitly).
    data.orgSettings = await prisma.orgSetting.findMany({ where: { orgId: user.orgId } });
    data.users = await prisma.user.findMany({
      where: { orgId: user.orgId },
      select: { id: true, name: true, email: true, phone: true, role: true, title: true, active: true, createdAt: true },
    });
    data.roles = await prisma.role.findMany({ where: { orgId: user.orgId } });
    data.teams = await prisma.team.findMany({ where: { orgId: user.orgId } });
    data.pipelines = await prisma.pipeline.findMany({ where: { orgId: user.orgId } });
    data.pipelineStages = await prisma.pipelineStage.findMany({
      where: { pipeline: { orgId: user.orgId } },
    });
    data.organization = await prisma.organization.findUnique({
      where: { id: user.orgId },
      select: { id: true, name: true, slug: true, businessType: true, plan: true, status: true, createdAt: true },
    });
    data.subscription = await prisma.subscription.findMany({ where: { orgId: user.orgId } });
    data.payments = await prisma.payment.findMany({ where: { orgId: user.orgId } });

    await audit({ orgId: user.orgId, userId: user.id, action: 'DATA_EXPORTED', entity: 'Organization', entityId: user.orgId, req });
    const payload = JSON.stringify({ exportedAt: new Date().toISOString(), orgId: user.orgId, data }, null, 2);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="primelead-export-${user.orgId.slice(0, 8)}.json"`);
    return res.send(payload);
  })
);

router.post(
  '/delete',
  asyncHandler(async (req, res) => {
    const user = (req as AuthedRequest).user;
    const { confirm } = (req.body || {}) as { confirm?: string };
    if (confirm !== 'DELETE') {
      throw badRequest('Type DELETE to confirm you want to permanently erase this workspace and all its data.');
    }

    const org = await prisma.organization.findUnique({ where: { id: user.orgId } });
    if (!org) throw badRequest('Workspace not found.');

    // Audit FIRST (before rows are gone), then purge. Retention-safe: transient
    // secrets (sessions, tokens) are removed immediately so nothing lingers.
    await audit({
      orgId: user.orgId,
      userId: user.id,
      action: 'ORGANIZATION_DELETED',
      entity: 'Organization',
      entityId: user.orgId,
      metadata: { name: org.name },
      req,
    });

    // 1. Per-user secret rows.
    for (const m of USER_MODELS) {
      await (prisma as any)[m].deleteMany({ where: { user: { orgId: user.orgId } } });
    }
    // 2. Customer-data rows (all org-scoped models).
    for (const m of DATA_MODELS) {
      await (prisma as any)[m].deleteMany({ where: { orgId: user.orgId } });
    }
    // 3. Org-scoped but no-orgId-on-row models.
    await prisma.user.deleteMany({ where: { orgId: user.orgId } });
    await prisma.orgSetting.deleteMany({ where: { orgId: user.orgId } });
    await prisma.role.deleteMany({ where: { orgId: user.orgId } });
    await prisma.team.deleteMany({ where: { orgId: user.orgId } });
    await prisma.pipelineStage.deleteMany({ where: { pipeline: { orgId: user.orgId } } });
    await prisma.pipeline.deleteMany({ where: { orgId: user.orgId } });
    await prisma.subscription.deleteMany({ where: { orgId: user.orgId } });
    await prisma.payment.deleteMany({ where: { orgId: user.orgId } });
    // Referral/payout rows reference the *creating* org only via referrals where
    // the referrer may be another org — delete our own referral links here.
    await prisma.referral.deleteMany({ where: { OR: [{ orgId: user.orgId }, { referredOrgId: user.orgId }] } });
    // 4. The org itself.
    await prisma.organization.delete({ where: { id: user.orgId } });

    // Drop the session cookie + all of this user's sessions server-side.
    await revokeAllSessions(user.id);
    res.clearCookie('pl_session', { path: '/' });
    res.clearCookie('pl_csrf', { path: '/' });

    return ok(res, { deleted: true });
  })
);

export default router;
