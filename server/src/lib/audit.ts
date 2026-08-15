import { prisma } from '../lib/prisma';
import type { Request } from 'express';

export interface AuditInput {
  orgId: string;
  userId?: string | null;
  action: string;
  entity?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  req?: Request;
}

/** Record a sensitive action in the audit log (fire-and-forget, never throws). */
export async function audit(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        orgId: input.orgId,
        userId: input.userId || null,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId,
        metadata: (input.metadata as any) || undefined,
        ip: input.req?.ip || input.req?.socket?.remoteAddress || null,
      },
    });
  } catch {
    // Auditing must never break the main flow.
  }
}
