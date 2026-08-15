/**
 * Follow-up engine.
 *
 * Every active lead should have a next action. This service owns task
 * creation, completion, and the overdue sync that flips PENDING → MISSED
 * and raises FOLLOW_UP_OVERDUE notifications exactly once per task.
 */
import { prisma } from '../lib/prisma';
import { notify } from '../lib/serializers';
import { TASK_KINDS, type TaskKind } from '../constants';

export interface CreateFollowUpInput {
  orgId: string;
  leadId?: string | null;
  userId: string;
  title: string;
  kind?: TaskKind;
  dueAt: Date;
  notes?: string;
  actorId?: string;
}

export async function createFollowUp(input: CreateFollowUpInput): Promise<void> {
  const kind = input.kind || 'FOLLOW_UP';
  await prisma.task.create({
    data: {
      orgId: input.orgId,
      leadId: input.leadId || null,
      userId: input.userId,
      title: input.title,
      kind,
      dueAt: input.dueAt,
      notes: input.notes,
    },
  });
  // Reflect the next follow-up on the lead for dashboard filtering.
  if (input.leadId) {
    const lead = await prisma.lead.findFirst({
      where: { id: input.leadId, orgId: input.orgId },
      select: { nextFollowUpAt: true },
    });
    if (!lead || !lead.nextFollowUpAt || input.dueAt < lead.nextFollowUpAt) {
      await prisma.lead.update({
        where: { id: input.leadId },
        data: { nextFollowUpAt: input.dueAt },
      });
    }
  }
  await prisma.activity.create({
    data: {
      orgId: input.orgId,
      leadId: input.leadId || null,
      userId: input.actorId || input.userId,
      type: 'FOLLOW_UP',
      title: 'Follow-up scheduled',
      body: `${input.title} — ${input.dueAt.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}`,
      metadata: { dueAt: input.dueAt.toISOString() },
    },
  });
}

export async function completeFollowUp(taskId: string, orgId: string, actorId: string): Promise<void> {
  const task = await prisma.task.findFirst({ where: { id: taskId, orgId } });
  if (!task) throw Object.assign(new Error('Task not found'), { status: 404 });
  await prisma.task.update({
    where: { id: taskId },
    data: { status: 'DONE', completedAt: new Date() },
  });
  await prisma.activity.create({
    data: {
      orgId,
      leadId: task.leadId,
      userId: actorId,
      type: 'FOLLOW_UP',
      title: 'Follow-up completed',
      body: task.title,
    },
  });
}

export interface OverdueResult {
  missed: number;
  notified: number;
}

/**
 * Mark overdue PENDING tasks as MISSED and notify the owner once each.
 * Called periodically by the server and on demand by the app.
 */
export async function syncOverdue(orgId: string): Promise<OverdueResult> {
  const now = new Date();
  const overdue = await prisma.task.findMany({
    where: { orgId, status: 'PENDING', dueAt: { lt: now } },
    include: { lead: true },
  });
  let missed = 0;
  let notified = 0;
  for (const task of overdue) {
    await prisma.task.update({ where: { id: task.id }, data: { status: 'MISSED' } });
    missed++;
    if (!task.overdueNotifiedAt) {
      await prisma.task.update({ where: { id: task.id }, data: { overdueNotifiedAt: now } });
      await notify({
        orgId,
        userId: task.userId,
        type: 'FOLLOW_UP_OVERDUE',
        title: 'Follow-up overdue',
        body: task.lead ? `${task.lead.name} — ${task.title}` : task.title,
        link: task.leadId ? `/app/leads/${task.leadId}` : '/app/tasks',
      });
      notified++;
    }
  }
  return { missed, notified };
}

/** Group a task list into views: overdue / today / upcoming / done. */
export function bucketTasks(tasks: Array<{ status: string; dueAt: Date }>) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);

  return {
    overdue: tasks.filter((t) => t.status === 'PENDING' && t.dueAt < now),
    today: tasks.filter((t) => t.status === 'PENDING' && t.dueAt >= now && t.dueAt < endOfToday),
    upcoming: tasks.filter((t) => t.status === 'PENDING' && t.dueAt >= endOfToday),
    done: tasks.filter((t) => t.status === 'DONE'),
    missed: tasks.filter((t) => t.status === 'MISSED'),
  };
}
