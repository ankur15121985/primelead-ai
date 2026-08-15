/**
 * Inbound webhooks — the generic lead-capture pipeline.
 *
 *   POST /api/webhooks/:source
 *     headers: x-webhook-secret: <secret from Integrations page>
 *
 * Pipeline (mirrors the product promise):
 *   1. Verify secret       → 401 if missing/wrong
 *   2. Validate payload    → 422 with friendly message
 *   3. Normalize lead      → source labels, phone/email normalization
 *   4. Detect duplicates   → 409 with duplicate: true
 *   5. Create lead         → auto-assignment + score
 *   6. Activity            → LEAD_CREATED logged
 *   7. Notify salesperson  → NEW_LEAD notification
 *   8. Return success
 */
import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { asyncHandler, badRequest, ok, unauthorized, validate, conflict } from '../lib/http';
import { webhookLeadSchema } from '../validators/schemas';
import { createLead, findDuplicate } from '../services/leads';
import { webhookLimiter } from '../middleware/rate-limit';

const router = Router();
router.use(webhookLimiter);

router.post(
  '/:source',
  asyncHandler(async (req, res) => {
    const source = String(req.params.source || '').toUpperCase();
    // The webhook URL is shared across tenants for the same source, so the
    // tenant is resolved from the secret itself (each org's secret is unique).
    const candidates = await prisma.integration.findMany({ where: { source } });
    const secret = String(req.headers['x-webhook-secret'] || req.headers['x-primelead-secret'] || '').trim();
    if (!secret || candidates.length === 0) throw unauthorized('Invalid webhook secret.');

    let integration: (typeof candidates)[number] | null = null;
    for (const c of candidates) {
      if (!c.webhookSecret) continue;
      if (secret.length !== c.webhookSecret.length) continue;
      let same = 0;
      for (let i = 0; i < secret.length; i++) {
        same |= secret.charCodeAt(i) ^ c.webhookSecret.charCodeAt(i);
      }
      if (same === 0) {
        integration = c;
        break;
      }
    }
    if (!integration) throw unauthorized('Invalid webhook secret.');
    if (!integration.enabled) {
      throw unauthorized('This webhook is paused. Enable it on the Integrations page first.');
    }

    const input = validate(webhookLeadSchema, req.body);

    // An externally supplied ownerId must be an active member of THIS org —
    // otherwise a caller could assign leads to users of another tenant and
    // trigger cross-org notifications. Default to auto-assignment.
    let ownerId: string | null | undefined = null;
    if (input.ownerId) {
      const member = await prisma.user.findFirst({
        where: { id: input.ownerId, orgId: integration.orgId, active: true },
      });
      ownerId = member ? member.id : null;
    }

    // duplicate check first so we can answer 409 without creating anything
    const dup = await findDuplicate(integration.orgId, input.phone, input.email);
    if (dup) {
      throw conflict(`A lead with this phone/email already exists (${dup.name}).`);
    }

    const lead = await createLead({
      orgId: integration.orgId,
      name: input.name,
      phone: input.phone || null,
      email: input.email || null,
      company: input.company || null,
      source: input.source || source,
      campaignName: input.campaignName || null,
      expectedValue: input.expectedValue,
      notes: input.notes || null,
      priority: (input.priority as any) || 'MEDIUM',
      ownerId,
      customFields: input.customFields,
      createdVia: 'webhook',
    });

    await prisma.integration.update({
      where: { id: integration.id },
      data: { lastSyncAt: new Date(), status: 'CONNECTED', enabled: true },
    });

    return ok(res, { received: true, lead: { id: lead.id, name: lead.name } }, 201);
  })
);

export default router;
