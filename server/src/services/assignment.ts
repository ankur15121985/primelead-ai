/**
 * Automatic lead assignment.
 *
 * Priority order:
 *   1. Source-based rule (org setting `sourceAssignments`: { WEBSITE: "userId", ... })
 *   2. Least-open-leads (count open leads per active salesperson; ties broken round-robin)
 *
 * Returns the assigned user (or null when no active salesperson exists).
 */
import { prisma } from '../lib/prisma';
import { OPEN_STATUSES } from '../constants';

export async function getOrgSetting(orgId: string, key: string): Promise<Record<string, unknown> | null> {
  const row = await prisma.orgSetting.findUnique({
    where: { orgId_key: { orgId, key } },
  });
  return (row?.value as Record<string, unknown> | null) ?? null;
}

export async function setOrgSetting(orgId: string, key: string, value: unknown): Promise<void> {
  await prisma.orgSetting.upsert({
    where: { orgId_key: { orgId, key } },
    create: { orgId, key, value: value as any },
    update: { value: value as any },
  });
}

interface AssignmentContext {
  orgId: string;
  source?: string | null;
  excludeUserId?: string | null;
}

export async function assignLeadOwner(ctx: AssignmentContext): Promise<{ userId: string | null; mode: string }> {
  // 1. Source-based rule
  if (ctx.source) {
    const rules = (await getOrgSetting(ctx.orgId, 'sourceAssignments')) as Record<string, string> | null;
    const ruleUserId = rules?.[ctx.source];
    if (ruleUserId) {
      const ruleUser = await prisma.user.findFirst({
        where: { id: ruleUserId, orgId: ctx.orgId, active: true },
      });
      if (ruleUser) return { userId: ruleUser.id, mode: 'source' };
    }
  }

  // 2. Least-open-leads with round-robin tie-break
  const candidates = await prisma.user.findMany({
    where: { orgId: ctx.orgId, active: true, role: 'SALES' },
    orderBy: [{ lastAssignmentAt: 'asc' }],
  });
  if (ctx.excludeUserId) {
    // still allow others
  }
  if (candidates.length === 0) return { userId: null, mode: 'none' };

  const openCounts = (await (prisma.lead.groupBy as any)({
    by: ['ownerId'],
    where: { orgId: ctx.orgId, status: { in: [...OPEN_STATUSES] }, deletedAt: null },
    _count: { _all: true },
  })) as Array<{ ownerId: string | null; _count: { _all: number } }>;
  const countMap = new Map(openCounts.map((c) => [c.ownerId, c._count._all]));
  const sorted = [...candidates].sort((a, b) => {
    const ca = countMap.get(a.id) ?? 0;
    const cb = countMap.get(b.id) ?? 0;
    if (ca !== cb) return ca - cb;
    // round-robin tie-break: the salesperson who was assigned least recently wins
    return (a.lastAssignmentAt?.getTime() ?? 0) - (b.lastAssignmentAt?.getTime() ?? 0);
  });
  const pick = sorted[0];
  await prisma.user.update({ where: { id: pick.id }, data: { lastAssignmentAt: new Date() } });
  return { userId: pick.id, mode: 'least-open' };
}

/** Record an ASSIGNMENT activity + notification + audit when a lead's owner changes. */
export async function recordAssignment(ctx: {
  orgId: string;
  leadId: string;
  leadName: string;
  newOwnerId: string | null;
  oldOwnerId?: string | null;
  actorId?: string;
  mode?: string;
}): Promise<void> {
  await prisma.activity.create({
    data: {
      orgId: ctx.orgId,
      leadId: ctx.leadId,
      userId: ctx.actorId || null,
      type: 'ASSIGNMENT',
      title: ctx.newOwnerId ? 'Lead assigned' : 'Lead unassigned',
      body: ctx.newOwnerId ? `Assigned to a salesperson${ctx.mode ? ` (${ctx.mode})` : ''}.` : 'Owner removed.',
      metadata: { newOwnerId: ctx.newOwnerId, oldOwnerId: ctx.oldOwnerId, mode: ctx.mode },
    },
  });
  if (ctx.newOwnerId) {
    const { notify } = await import('../lib/serializers');
    await notify({
      orgId: ctx.orgId,
      userId: ctx.newOwnerId,
      type: 'LEAD_ASSIGNED',
      title: 'New lead assigned to you',
      body: `${ctx.leadName} has been assigned to you.`,
      link: `/app/leads/${ctx.leadId}`,
    });
  }
}
