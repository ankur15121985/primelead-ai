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
  priority?: string;
  repeatEveryDays?: number | null;
  dueAt: Date;
  notes?: string;
  actorId?: string;
}

export async function createFollowUp(input: CreateFollowUpInput): Promise<{ id: string }> {
  const kind = input.kind || 'FOLLOW_UP';
  const task = await prisma.task.create({
    data: {
      orgId: input.orgId,
      leadId: input.leadId || null,
      userId: input.userId,
      title: input.title,
      kind,
      priority: input.priority || 'MEDIUM',
      repeatEveryDays: input.repeatEveryDays || null,
      dueAt: input.dueAt,
      notes: input.notes,
    },
    select: { id: true },
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
  return { id: task.id };
}

export async function completeFollowUp(taskId: string, orgId: string, actorId: string): Promise<void> {
  const task = await prisma.task.findFirst({ where: { id: taskId, orgId } });
  if (!task) throw Object.assign(new Error('Task not found'), { status: 404 });

  // Recurring follow-up: completing it schedules the next occurrence.
  let nextDueAt: Date | null = null;
  if (task.repeatEveryDays) {
    nextDueAt = new Date(task.dueAt.getTime() + task.repeatEveryDays * 24 * 60 * 60 * 1000);
    await prisma.task.create({
      data: {
        orgId,
        leadId: task.leadId,
        userId: task.userId,
        title: task.title,
        kind: task.kind,
        priority: task.priority,
        repeatEveryDays: task.repeatEveryDays,
        dueAt: nextDueAt,
        notes: task.notes,
      },
    });
  }

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
      title: nextDueAt ? 'Recurring follow-up completed' : 'Follow-up completed',
      body: nextDueAt
        ? `${task.title} — next one scheduled for ${nextDueAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`
        : task.title,
      metadata: nextDueAt ? { nextDueAt: nextDueAt.toISOString(), repeatEveryDays: task.repeatEveryDays } : undefined,
    },
  });

  // If the completed task was the lead's current next follow-up, advance the
  // pointer to the earliest remaining pending task (usually the new occurrence).
  if (task.leadId) {
    const lead = await prisma.lead.findFirst({
      where: { id: task.leadId, orgId },
      select: { nextFollowUpAt: true },
    });
    if (lead && lead.nextFollowUpAt && task.dueAt.getTime() <= lead.nextFollowUpAt.getTime()) {
      const nextTask = await prisma.task.findFirst({
        where: { orgId, leadId: task.leadId, status: 'PENDING' },
        orderBy: { dueAt: 'asc' },
        select: { dueAt: true },
      });
      await prisma.lead.update({
        where: { id: task.leadId },
        data: { nextFollowUpAt: nextTask?.dueAt ?? null },
      });
    }
  }
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
