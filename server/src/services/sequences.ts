import { prisma } from '../lib/prisma';
import { notFound } from '../lib/http';

export interface CreateSequenceInput {
  orgId: string;
  name: string;
  description?: string | null;
  steps: {
    type: string;
    order: number;
    subject?: string | null;
    body?: string | null;
    waitDays?: number | null;
    waitHours?: number | null;
    conditionType?: string | null;
    conditionValue?: string | null;
    aiPrompt?: string | null;
    aiAction?: string | null;
  }[];
}

export async function createSequence(input: CreateSequenceInput) {
  const sequence = await (prisma as any).sequence.create({
    data: {
      orgId: input.orgId,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      steps: {
        create: input.steps.map((s) => ({
          orgId: input.orgId,
          order: s.order,
          type: s.type,
          subject: s.subject?.trim() || null,
          body: s.body?.trim() || null,
          waitDays: s.waitDays ?? null,
          waitHours: s.waitHours ?? null,
          conditionType: s.conditionType || null,
          conditionValue: s.conditionValue || null,
          aiPrompt: s.aiPrompt?.trim() || null,
          aiAction: s.aiAction || null,
        })),
      },
    },
    include: { steps: { orderBy: { order: 'asc' } } },
  });
  return sequence;
}

export async function updateSequence(id: string, orgId: string, data: { name?: string; description?: string | null; status?: string }) {
  const existing = await (prisma as any).sequence.findFirst({ where: { id, orgId } });
  if (!existing) throw notFound('Sequence not found');
  return (prisma as any).sequence.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name.trim() }),
      ...(data.description !== undefined && { description: data.description?.trim() || null }),
      ...(data.status !== undefined && { status: data.status }),
    },
  });
}

export async function deleteSequence(id: string, orgId: string) {
  const existing = await (prisma as any).sequence.findFirst({ where: { id, orgId } });
  if (!existing) throw notFound('Sequence not found');
  await (prisma as any).sequence.delete({ where: { id } });
  return { deleted: true };
}

export async function getSequence(id: string, orgId: string) {
  const sequence = await (prisma as any).sequence.findFirst({
    where: { id, orgId },
    include: { steps: { orderBy: { order: 'asc' } } },
  });
  if (!sequence) throw notFound('Sequence not found');
  return sequence;
}

export async function listSequences(orgId: string) {
  return (prisma as any).sequence.findMany({
    where: { orgId },
    orderBy: { updatedAt: 'desc' },
    include: { _count: { select: { enrollments: true } } },
  });
}

// ── Enrollment ──────────────────────────────────────────────

export async function enrollContacts(sequenceId: string, orgId: string, contacts: { email: string; leadId?: string; contactId?: string }[]) {
  const sequence = await getSequence(sequenceId, orgId);
  if (sequence.status === 'DRAFT') throw new Error('Cannot enroll in a draft sequence');

  let enrolled = 0;
  let skipped = 0;

  for (const c of contacts) {
    try {
      const firstStep = sequence.steps.find((s: any) => s.type === 'EMAIL');
      const nextActionAt = firstStep ? calculateNextAction(new Date(), 0) : null;

      await (prisma as any).sequenceEnrollment.create({
        data: {
          orgId,
          sequenceId,
          contactId: c.contactId || null,
          leadId: c.leadId || null,
          email: c.email.toLowerCase().trim(),
          status: 'ENROLLED',
          currentStep: 0,
          nextActionAt,
        },
      });
      enrolled++;
    } catch {
      skipped++; // duplicate
    }
  }

  await (prisma as any).sequence.update({
    where: { id: sequenceId },
    data: { totalEnrolled: { increment: enrolled } },
  });

  return { enrolled, skipped };
}

export async function getSequenceEnrollments(sequenceId: string, orgId: string) {
  return (prisma as any).sequenceEnrollment.findMany({
    where: { sequenceId, orgId },
    orderBy: { enrolledAt: 'desc' },
    take: 200,
  });
}

export async function unenrollContact(enrollmentId: string, orgId: string) {
  const existing = await (prisma as any).sequenceEnrollment.findFirst({ where: { id: enrollmentId, orgId } });
  if (!existing) throw notFound('Enrollment not found');
  await (prisma as any).sequenceEnrollment.update({
    where: { id: enrollmentId },
    data: { status: 'STOPPED' },
  });
  return { stopped: true };
}

// ── Step Execution ──────────────────────────────────────────

function calculateNextAction(currentDate: Date, waitDays: number, waitHours: number = 0): Date {
  const next = new Date(currentDate);
  next.setDate(next.getDate() + (waitDays || 0));
  next.setHours(next.getHours() + (waitHours || 0));
  return next;
}

/**
 * Advance enrollment to the next step.
 */
export async function advanceEnrollment(enrollmentId: string, orgId: string) {
  const enrollment = await (prisma as any).sequenceEnrollment.findFirst({
    where: { id: enrollmentId, orgId },
    include: { sequence: { include: { steps: { orderBy: { order: 'asc' } } } } },
  });
  if (!enrollment) throw notFound('Enrollment not found');

  const steps = enrollment.sequence.steps;
  const nextStepIndex = enrollment.currentStep + 1;

  if (nextStepIndex >= steps.length) {
    // Sequence complete
    await (prisma as any).sequenceEnrollment.update({
      where: { id: enrollmentId },
      data: { status: 'COMPLETED', completedAt: new Date(), nextActionAt: null },
    });
    await (prisma as any).sequence.update({
      where: { id: enrollment.sequenceId },
      data: { totalCompleted: { increment: 1 } },
    });
    return { completed: true };
  }

  const nextStep = steps[nextStepIndex];
  let nextActionAt: Date | null = null;

  if (nextStep.type === 'WAIT') {
    nextActionAt = calculateNextAction(new Date(), nextStep.waitDays || 0, nextStep.waitHours || 0);
  } else if (nextStep.type === 'EMAIL') {
    nextActionAt = new Date(); // ready to send now
  } else {
    nextActionAt = new Date(); // manual tasks are ready immediately
  }

  await (prisma as any).sequenceEnrollment.update({
    where: { id: enrollmentId },
    data: {
      currentStep: nextStepIndex,
      nextActionAt,
      lastActivityAt: new Date(),
    },
  });

  return { advanced: true, nextStep };
}

/**
 * Record an email event (sent, opened, clicked, bounced, replied).
 */
export async function recordEmailEvent(enrollmentId: string, orgId: string, event: {
  stepId: string;
  status: string;
  subject?: string;
  body?: string;
  errorMessage?: string;
}) {
  const enrollment = await (prisma as any).sequenceEnrollment.findFirst({ where: { id: enrollmentId, orgId } });
  if (!enrollment) throw notFound('Enrollment not found');

  const log = await (prisma as any).sequenceEmailLog.create({
    data: {
      orgId,
      enrollmentId,
      stepId: event.stepId,
      status: event.status,
      subject: event.subject || null,
      body: event.body || null,
      errorMessage: event.errorMessage || null,
    },
  });

  // Update enrollment counters
  const update: Record<string, unknown> = { lastActivityAt: new Date() };
  if (event.status === 'REPLIED') {
    update.replies = { increment: 1 };
    update.status = 'REPLIED';
  }
  if (event.status === 'OPENED') update.opens = { increment: 1 };
  if (event.status === 'CLICKED') update.clicks = { increment: 1 };
  if (event.status === 'BOUNCED') {
    update.status = 'BOUNCED';
  }

  await (prisma as any).sequenceEnrollment.update({ where: { id: enrollmentId }, data: update });

  return log;
}

// ── Sequence Stats ──────────────────────────────────────────

export async function getSequenceStats(sequenceId: string, orgId: string) {
  const sequence = await (prisma as any).sequence.findFirst({ where: { id: sequenceId, orgId } });
  if (!sequence) throw notFound('Sequence not found');

  const [totalEnrolled, byStatus, emailLogs] = await Promise.all([
    (prisma as any).sequenceEnrollment.count({ where: { sequenceId } }),
    (prisma as any).sequenceEnrollment.groupBy({ by: ['status'], where: { sequenceId }, _count: true }),
    (prisma as any).sequenceEmailLog.findMany({ where: { orgId, enrollment: { sequenceId } } }),
  ]);

  const totalSent = emailLogs.filter((l: any) => l.status === 'SENT').length;
  const totalOpened = emailLogs.filter((l: any) => l.status === 'OPENED').length;
  const totalClicked = emailLogs.filter((l: any) => l.status === 'CLICKED').length;
  const totalBounced = emailLogs.filter((l: any) => l.status === 'BOUNCED').length;
  const totalReplied = emailLogs.filter((l: any) => l.status === 'REPLIED').length;

  return {
    totalEnrolled,
    byStatus: Object.fromEntries(byStatus.map((s: any) => [s.status, s._count])),
    emails: {
      sent: totalSent,
      opened: totalOpened,
      clicked: totalClicked,
      bounced: totalBounced,
      replied: totalReplied,
      openRate: totalSent > 0 ? Math.round((totalOpened / totalSent) * 100) : 0,
      clickRate: totalSent > 0 ? Math.round((totalClicked / totalSent) * 100) : 0,
      bounceRate: totalSent > 0 ? Math.round((totalBounced / totalSent) * 100) : 0,
      replyRate: totalSent > 0 ? Math.round((totalReplied / totalSent) * 100) : 0,
    },
  };
}
