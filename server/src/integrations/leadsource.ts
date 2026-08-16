/**
 * Lead-source adapter system (spec §9).
 *
 * Every inbound lead source goes through the same five steps, so a new source
 * is a new adapter — never a change to the CRM core:
 *
 *   receiveLead    → authenticate/verify the request (secret check)
 *   validateLead   → reject malformed payloads with a friendly message
 *   normalizeLead  → map provider-specific fields onto the canonical shape
 *   deduplicateLead→ detect existing leads by phone/email within the org
 *   createLead     → the shared service-layer path (limits, assignment, score)
 *
 * `processInboundLead` runs the pipeline and records every attempt in
 * IntegrationLog (success, duplicate, invalid or failure) so integrations
 * have an audit trail and connection health is visible.
 */
import { prisma } from '../lib/prisma';
import { createLead, findDuplicate } from '../services/leads';
import { indiamartAdapter } from './leadsource/indiamart';
import { metaLeadsAdapter } from './leadsource/meta-leads';

/** Canonical lead shape every adapter produces. */
export interface NormalizedLead {
  name: string;
  phone?: string | null;
  email?: string | null;
  company?: string | null;
  notes?: string | null;
  expectedValue?: number;
  priority?: string;
  customFields?: Record<string, string>;
  /** Provider event id used for replay detection, e.g. IndiaMART query id. */
  externalId?: string | null;
}

export interface LeadSourceAdapter {
  source: string;
  /** Validate the raw payload; returns a friendly error message or null. */
  validate(raw: unknown): string | null;
  /** Map the provider payload onto the canonical shape. */
  normalize(raw: unknown): NormalizedLead;
}

export type WebhookOutcome = 'SUCCESS' | 'DUPLICATE' | 'INVALID' | 'FAILED';

export interface ProcessResult {
  outcome: WebhookOutcome;
  leadId?: string;
  message?: string;
}

/** Replay guard — if a provider event id was already ingested, skip it. */
async function isReplay(orgId: string, source: string, externalId?: string | null): Promise<boolean> {
  if (!externalId) return false;
  const existing = await prisma.integrationLog.findFirst({
    where: { orgId, source, externalId, status: 'SUCCESS' },
  });
  return Boolean(existing);
}

/**
 * Run the full inbound pipeline for a lead source and log the attempt.
 * Throws http-style errors for the route to surface (conflict on duplicate).
 */
export async function processInboundLead(opts: {
  orgId: string;
  source: string;
  integrationId?: string | null;
  adapter: LeadSourceAdapter;
  raw: unknown;
}): Promise<ProcessResult> {
  const { orgId, source, integrationId, adapter, raw } = opts;

  const record = (status: WebhookOutcome, extra: Partial<{ leadId: string; message: string; externalId: string; error: string }> = {}) =>
    prisma.integrationLog.create({
      data: {
        orgId,
        integrationId: integrationId || null,
        source,
        status,
        leadId: extra.leadId || null,
        message: extra.message || null,
        externalId: extra.externalId || null,
        error: extra.error || null,
      },
    });

  try {
    const validationError = adapter.validate(raw);
    if (validationError) {
      await record('INVALID', { message: validationError });
      return { outcome: 'INVALID', message: validationError };
    }

    const lead = adapter.normalize(raw);
    if (!lead.name || (!lead.phone && !lead.email)) {
      const msg = 'Payload is missing a name and at least one of phone/email.';
      await record('INVALID', { message: msg });
      return { outcome: 'INVALID', message: msg };
    }

    // Replay protection: identical provider event id → acknowledge, no duplicate work.
    if (await isReplay(orgId, source, lead.externalId)) {
      await record('DUPLICATE', { message: 'Already processed (replay).', externalId: lead.externalId || undefined });
      return { outcome: 'DUPLICATE', message: 'Already received (replay).' };
    }

    const dup = await findDuplicate(orgId, lead.phone, lead.email);
    if (dup) {
      await record('DUPLICATE', { message: `Duplicate of existing lead "${dup.name}".`, externalId: lead.externalId || undefined });
      return { outcome: 'DUPLICATE', message: `A lead with this phone/email already exists (${dup.name}).` };
    }

    const created = await createLead({
      orgId,
      name: lead.name,
      phone: lead.phone,
      email: lead.email,
      company: lead.company || null,
      notes: lead.notes || null,
      expectedValue: lead.expectedValue,
      priority: (lead.priority as any) || 'MEDIUM',
      source,
      customFields: lead.customFields,
      createdVia: 'webhook',
    });

    await record('SUCCESS', { leadId: created.id, message: `Lead "${created.name}" created.`, externalId: lead.externalId || undefined });
    return { outcome: 'SUCCESS', leadId: created.id };
  } catch (err: any) {
    // Duplicate conflicts from the service layer surface as their own outcome.
    if (err?.status === 409) {
      await record('DUPLICATE', { message: err.message, externalId: (adapter.normalize(raw).externalId) || undefined });
      return { outcome: 'DUPLICATE', message: err.message };
    }
    const msg = err instanceof Error ? err.message.slice(0, 300) : 'Unexpected error';
    await record('FAILED', { error: msg });
    throw err;
  }
}

export { indiamartAdapter, metaLeadsAdapter };

/** Simple registry — the webhook route picks an adapter by source. */
const REGISTRY: Record<string, LeadSourceAdapter> = {
  INDIAMART: indiamartAdapter,
  FACEBOOK: metaLeadsAdapter,
  INSTAGRAM: metaLeadsAdapter,
};

export function getLeadSourceAdapter(source: string): LeadSourceAdapter | null {
  return REGISTRY[source.toUpperCase()] || null;
}
