/**
 * Inbound webhooks — the generic lead-capture pipeline.
 *
 *   POST /api/webhooks/:source
 *     headers: x-webhook-secret: <secret from Integrations page>
 *
 * Known sources (IndiaMART, Facebook/Instagram Lead Ads) run through their
 * adapter: validate → normalize → dedupe → create, with every attempt
 * recorded in IntegrationLog (replay guard by provider event id). Unknown
 * sources use the generic schema. Duplicates answer 409, invalid payloads
 * 422 — never silently dropped.
 */
import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { asyncHandler, ok, unauthorized, validate, conflict, unprocessable } from '../lib/http';
import { webhookLeadSchema } from '../validators/schemas';
import { createLead, findDuplicate } from '../services/leads';
import { webhookLimiter } from '../middleware/rate-limit';
import { getLeadSourceAdapter, processInboundLead } from '../integrations/leadsource';

const router = Router();
router.use(webhookLimiter);

/** Constant-time secret comparison. */
function secretMatches(candidate: string, secret: string): boolean {
  if (candidate.length !== secret.length) return false;
  let same = 0;
  for (let i = 0; i < candidate.length; i++) {
    same |= candidate.charCodeAt(i) ^ secret.charCodeAt(i);
  }
  return same === 0;
}

/** Resolve the tenant + integration row from the source and secret. */
async function resolveTenant(source: string, secret: string) {
  const candidates = await prisma.integration.findMany({ where: { source } });
  if (!secret || candidates.length === 0) return null;
  for (const c of candidates) {
    if (!c.webhookSecret) continue;
    if (secretMatches(secret, c.webhookSecret)) return c;
  }
  return null;
}

async function markSuccess(integrationId: string) {
  await prisma.integration.update({
    where: { id: integrationId },
    data: { lastSyncAt: new Date(), status: 'CONNECTED', errorCount: 0, lastError: null },
  });
}

async function markFailure(integrationId: string, error: string) {
  const integration = await prisma.integration.findUnique({ where: { id: integrationId } });
  if (!integration) return;
  const errorCount = (integration.errorCount || 0) + 1;
  await prisma.integration.update({
    where: { id: integrationId },
    data: {
      lastSyncAt: new Date(),
      errorCount,
      lastError: error.slice(0, 300),
      status: errorCount >= 5 ? 'ERROR' : integration.status,
    },
  });
}

router.post(
  '/:source',
  asyncHandler(async (req, res) => {
    const source = String(req.params.source || '').toUpperCase();
    const secret = String(req.headers['x-webhook-secret'] || req.headers['x-primelead-secret'] || '').trim();

    const integration = await resolveTenant(source, secret);
    if (!integration) throw unauthorized('Invalid webhook secret.');
    if (!integration.enabled) {
      throw unauthorized('This webhook is paused. Enable it on the Integrations page first.');
    }

    const adapter = getLeadSourceAdapter(source);
    const rawBody = req.body;

    if (adapter) {
      const result = await processInboundLead({
        orgId: integration.orgId,
        source,
        integrationId: integration.id,
        adapter,
        raw: rawBody,
      });
      if (result.outcome === 'INVALID') {
        await markFailure(integration.id, result.message || 'invalid payload');
        throw unprocessable(result.message || 'Invalid payload.');
      }
      if (result.outcome === 'DUPLICATE') {
        await markSuccess(integration.id);
        throw conflict(result.message || 'Duplicate lead.');
      }
      await markSuccess(integration.id);
      return ok(res, { received: true, lead: { id: result.leadId }, source }, 201);
    }

    // ── Generic sources (Shopify, Zapier, API, custom) ──────────────
    const input = validate(webhookLeadSchema, rawBody);

    // An externally supplied ownerId must be an active member of THIS org —
    // otherwise a caller could assign leads to users of another tenant.
    let ownerId: string | null | undefined = null;
    if (input.ownerId) {
      const member = await prisma.user.findFirst({
        where: { id: input.ownerId, orgId: integration.orgId, active: true },
      });
      ownerId = member ? member.id : null;
    }

    const dup = await findDuplicate(integration.orgId, input.phone, input.email);
    if (dup) {
      await prisma.integrationLog.create({
        data: { orgId: integration.orgId, integrationId: integration.id, source, status: 'DUPLICATE', message: `Duplicate of existing lead "${dup.name}".` },
      });
      await markSuccess(integration.id);
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

    await prisma.integrationLog.create({
      data: {
        orgId: integration.orgId,
        integrationId: integration.id,
        source,
        status: 'SUCCESS',
        leadId: lead.id,
        message: `Lead "${lead.name}" created.`,
      },
    });
    await markSuccess(integration.id);

    return ok(res, { received: true, lead: { id: lead.id, name: lead.name } }, 201);
  })
);

export default router;
