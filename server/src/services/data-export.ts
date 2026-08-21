/**
 * Phase 13 — Data export, retention policies, and data access requests.
 *
 * Handles GDPR right-to-access, right-to-deletion, data portability,
 * retention policies with auto-expiry, and audited export jobs.
 */
import { prisma } from '../lib/prisma';

/* ── Export Jobs ─────────────────────────────────────────────── */

export interface ExportJobInput {
  entityType: string;
  format?: string;
  filters?: Record<string, unknown>;
}

export async function createExportJob(orgId: string, userId: string, input: ExportJobInput, ipAddress?: string) {
  // Rate limit: max 5 active export jobs per user
  const activeCount = await prisma.exportJob.count({
    where: { orgId, userId, status: { in: ['PENDING', 'PROCESSING'] } },
  });
  if (activeCount >= 5) {
    throw Object.assign(new Error('Too many active export jobs. Wait for existing exports to complete.'), {
      status: 429,
      code: 'EXPORT_RATE_LIMIT',
    });
  }

  return prisma.exportJob.create({
    data: {
      orgId,
      userId,
      entityType: input.entityType,
      format: input.format || 'CSV',
      filters: (input.filters as any) || undefined,
      ipAddress: ipAddress || null,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    },
  });
}

export async function updateExportJob(id: string, data: {
  status?: string;
  recordCount?: number;
  fileUrl?: string;
  fileSize?: number;
  error?: string;
  downloadCount?: number;
}) {
  return prisma.exportJob.update({ where: { id }, data });
}

export async function getExportJobs(orgId: string, userId?: string) {
  return prisma.exportJob.findMany({
    where: {
      orgId,
      ...(userId ? { userId } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
}

export async function getExportStats(orgId: string) {
  const [total, byType, byStatus] = await Promise.all([
    prisma.exportJob.count({ where: { orgId } }),
    prisma.exportJob.groupBy({ by: ['entityType'], where: { orgId }, _count: { _all: true } }),
    prisma.exportJob.groupBy({ by: ['status'], where: { orgId }, _count: { _all: true } }),
  ]);

  return {
    total,
    byType: byType.map((r) => ({ type: r.entityType, count: r._count._all })),
    byStatus: byStatus.map((r) => ({ status: r.status, count: r._count._all })),
  };
}

/* ── Retention Policies ─────────────────────────────────────── */

export interface RetentionPolicyInput {
  name: string;
  description?: string;
  entityType: string;
  retentionDays: number;
  autoDelete?: boolean;
  actionBeforeDelete?: string;
  notifyBeforeDelete?: boolean;
  notifyEmail?: string;
  notifyDaysBefore?: number;
}

export async function createRetentionPolicy(orgId: string, input: RetentionPolicyInput) {
  return prisma.retentionPolicy.create({
    data: {
      orgId,
      name: input.name,
      description: input.description || null,
      entityType: input.entityType,
      retentionDays: input.retentionDays,
      autoDelete: input.autoDelete || false,
      actionBeforeDelete: input.actionBeforeDelete || null,
      notifyBeforeDelete: input.notifyBeforeDelete || false,
      notifyEmail: input.notifyEmail || null,
      notifyDaysBefore: input.notifyDaysBefore || null,
    },
  });
}

export async function getRetentionPolicies(orgId: string) {
  return prisma.retentionPolicy.findMany({
    where: { orgId },
    orderBy: { createdAt: 'asc' },
  });
}

export async function updateRetentionPolicy(orgId: string, id: string, data: Partial<RetentionPolicyInput>) {
  return prisma.retentionPolicy.update({
    where: { id },
    data,
  });
}

export async function deleteRetentionPolicy(orgId: string, id: string) {
  return prisma.retentionPolicy.delete({ where: { id } });
}

export async function executeRetentionPolicy(orgId: string, policyId: string) {
  const policy = await prisma.retentionPolicy.findFirst({ where: { id: policyId, orgId } });
  if (!policy) throw Object.assign(new Error('Policy not found.'), { status: 404 });
  if (!policy.isActive) return { deleted: 0, message: 'Policy is inactive.' };

  const cutoffDate = new Date(Date.now() - policy.retentionDays * 24 * 60 * 60 * 1000);
  let deleted = 0;

  // Execute based on entity type
  const deleteFn = async (model: any) => {
    const result = await model.deleteMany({
      where: {
        orgId,
        createdAt: { lt: cutoffDate },
      },
    });
    return result.count;
  };

  switch (policy.entityType) {
    case 'ACTIVITY':
      deleted = await deleteFn(prisma.activity);
      break;
    case 'FORM_SUBMISSION':
      deleted = await deleteFn(prisma.formSubmission);
      break;
    case 'INTEGRATION_LOG':
      deleted = await deleteFn(prisma.integrationLog);
      break;
    case 'CONVERSATION':
      deleted = await prisma.conversation.deleteMany({
        where: { orgId, createdAt: { lt: cutoffDate } },
      }).then((r) => r.count);
      break;
    default:
      return { deleted: 0, message: `Unsupported entity type: ${policy.entityType}` };
  }

  await prisma.retentionPolicy.update({
    where: { id: policyId },
    data: { lastRunAt: new Date(), recordsDeleted: { increment: deleted } },
  });

  return { deleted, entityType: policy.entityType };
}

/* ── Data Access Requests (GDPR) ────────────────────────────── */

export interface DataAccessRequestInput {
  type: string;
  userId?: string;
  contactEmail?: string;
  contactId?: string;
  description?: string;
}

export async function createDataAccessRequest(orgId: string, input: DataAccessRequestInput, ipAddress?: string) {
  // GDPR: 30 days deadline
  const deadline = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  return prisma.dataAccessRequest.create({
    data: {
      orgId,
      userId: input.userId || null,
      contactEmail: input.contactEmail || null,
      contactId: input.contactId || null,
      type: input.type,
      description: input.description || null,
      deadlineAt: deadline,
      ipAddress: ipAddress || null,
    },
  });
}

export async function getDataAccessRequests(orgId: string, status?: string) {
  return prisma.dataAccessRequest.findMany({
    where: {
      orgId,
      ...(status ? { status } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
}

export async function completeDataAccessRequest(orgId: string, id: string, data: {
  status: string;
  responseNotes?: string;
  dataProvided?: boolean;
  dataDeleted?: boolean;
  dataAnonymized?: boolean;
  completedBy: string;
}) {
  return prisma.dataAccessRequest.update({
    where: { id },
    data: {
      status: data.status,
      responseNotes: data.responseNotes || null,
      dataProvided: data.dataProvided || false,
      dataDeleted: data.dataDeleted || false,
      dataAnonymized: data.dataAnonymized || false,
      completedAt: new Date(),
      completedBy: data.completedBy,
    },
  });
}

export async function getDataAccessStats(orgId: string) {
  const [total, overdue, byType, byStatus] = await Promise.all([
    prisma.dataAccessRequest.count({ where: { orgId } }),
    prisma.dataAccessRequest.count({
      where: {
        orgId,
        status: { in: ['PENDING', 'IN_PROGRESS'] },
        deadlineAt: { lt: new Date() },
      },
    }),
    prisma.dataAccessRequest.groupBy({ by: ['type'], where: { orgId }, _count: { _all: true } }),
    prisma.dataAccessRequest.groupBy({ by: ['status'], where: { orgId }, _count: { _all: true } }),
  ]);

  return {
    total,
    overdue,
    byType: byType.map((r) => ({ type: r.type, count: r._count._all })),
    byStatus: byStatus.map((r) => ({ status: r.status, count: r._count._all })),
  };
}
