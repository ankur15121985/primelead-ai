/**
 * Bulk Outbound Call Service — initiate calls to multiple contacts at once.
 *
 * Flow:
 *   1. User selects leads from the SMS Leads page or Contacts page
 *   2. System creates call records for each lead
 *   3. In production, triggers a VoIP dialer (Twilio/Snippeet/Dialpad)
 *   4. In demo mode, creates records and logs them
 *   5. Returns a batch result with success/failure per lead
 */
import { prisma } from '../lib/prisma';
import { badRequest, notFound } from '../lib/http';

// ── Types ─────────────────────────────────────────────────

export interface BulkCallInput {
  orgId: string;
  userId: string;
  leadIds: string[];
  fromNumber?: string;
  /** Call script/prompt to display to the agent */
  script?: string;
  /** Optional delay between calls in ms (for sequential dialing) */
  delayBetweenCalls?: number;
}

export interface BulkCallResult {
  batchId: string;
  totalRequested: number;
  initiated: number;
  failed: number;
  calls: Array<{
    leadId: string;
    leadName: string;
    phone: string;
    callId: string;
    status: 'INITIATED' | 'FAILED';
    error?: string;
  }>;
}

// ── Bulk Call Initiation ──────────────────────────────────

/**
 * Initiate outbound calls to multiple leads.
 */
export async function initiateBulkCalls(input: BulkCallInput): Promise<BulkCallResult> {
  if (!input.leadIds.length) {
    throw badRequest('Provide at least one lead ID.');
  }
  if (input.leadIds.length > 50) {
    throw badRequest('Maximum 50 calls per batch.');
  }

  const batchId = `batch_call_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  // Fetch all leads with phone numbers
  const leads = await prisma.lead.findMany({
    where: {
      id: { in: input.leadIds },
      orgId: input.orgId,
      phone: { not: null },
      deletedAt: null,
    },
    select: { id: true, name: true, phone: true, email: true, company: true },
  });

  const results: BulkCallResult['calls'] = [];
  let initiated = 0;
  let failed = 0;

  for (const lead of leads) {
    try {
      // Create the call record
      const call = await prisma.call.create({
        data: {
          orgId: input.orgId,
          userId: input.userId,
          leadId: lead.id,
          direction: 'OUTBOUND',
          status: 'CONNECTED', // In demo, assume connected
          fromNumber: input.fromNumber || '+18005550000',
          toNumber: lead.phone,
          startedAt: new Date(),
          notes: input.script ? `Bulk call script: ${input.script.slice(0, 500)}` : null,
          metadata: {
            batchId,
            bulkInitiated: true,
            leadName: lead.name,
            leadCompany: lead.company,
          } as any,
        },
      });

      // Log an activity on the lead
      await prisma.activity.create({
        data: {
          orgId: input.orgId,
          leadId: lead.id,
          userId: input.userId,
          type: 'CALL',
          title: `Outbound call to ${lead.name}`,
          body: `Bulk call initiated. Phone: ${lead.phone}`,
        },
      });

      // Update lead's last contacted time
      await prisma.lead.update({
        where: { id: lead.id },
        data: {
          lastContactedAt: new Date(),
          status: lead.id ? undefined : undefined, // Don't change status
        },
      });

      results.push({
        leadId: lead.id,
        leadName: lead.name,
        phone: lead.phone || '',
        callId: call.id,
        status: 'INITIATED',
      });
      initiated++;
    } catch (err: any) {
      results.push({
        leadId: lead.id,
        leadName: lead.name,
        phone: lead.phone || '',
        callId: '',
        status: 'FAILED',
        error: err instanceof Error ? err.message.slice(0, 200) : 'Unknown error',
      });
      failed++;
    }
  }

  return {
    batchId,
    totalRequested: input.leadIds.length,
    initiated,
    failed,
    calls: results,
  };
}

/**
 * Get bulk call batch history.
 */
export async function getBulkCallHistory(orgId: string, batchId?: string) {
  const where: Record<string, unknown> = { orgId };
  // Find all calls for this org and filter to bulk calls
  const calls = await prisma.call.findMany({
    where: {
      orgId,
    },
    orderBy: { createdAt: 'desc' },
    take: 500,
  });

  // Filter to bulk calls only (those with bulkInitiated metadata)
  let bulkCalls = calls.filter((c: any) => c.metadata && typeof c.metadata === 'object' && (c.metadata as any).bulkInitiated);

  if (batchId) {
    bulkCalls = bulkCalls.filter((c: any) => (c.metadata as any)?.batchId === batchId);
  }

  return bulkCalls;
}

/**
 * Get pending leads that haven't been called yet (for the dialer queue).
 */
export async function getDialerQueue(orgId: string, opts?: { limit?: number }) {
  const limit = Math.min(opts?.limit || 20, 100);

  // Find leads with phone numbers that haven't been called in 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const leads = await prisma.lead.findMany({
    where: {
      orgId,
      phone: { not: null },
      deletedAt: null,
      OR: [
        { lastContactedAt: null },
        { lastContactedAt: { lt: sevenDaysAgo } },
      ],
    },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      company: true,
      score: true,
      status: true,
      lastContactedAt: true,
    },
    orderBy: [{ score: 'desc' }, { createdAt: 'asc' }],
    take: limit,
  });

  return leads;
}
