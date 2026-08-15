/**
 * AI CRM assistant (conversational).
 *
 * The assistant answers questions about the CURRENT organization's CRM data
 * only. It reads data through approved "tools" (see below), builds a compact
 * JSON context snapshot, and asks the provider to answer with a friendly tone.
 *
 * Security rules enforced here (server-side, never trust the client):
 *  - Every query is scoped to `orgId` from the session.
 *  - SALES users only ever see their own leads in the context.
 *  - The model never receives org ids, tokens, or any data outside the snapshot.
 *  - The model has no tools to write/execute anything — answer only.
 */
import { prisma } from '../lib/prisma';
import { getAiProvider } from '../ai/provider';
import { OPEN_STATUSES } from '../constants';
import { sourceLabel } from '../constants';
import type { ChatMessage } from '../ai/provider';

export const AI_CHAT_ERROR = Object.assign(new Error('AI is not configured. Add an API key in Settings to enable the AI assistant.'), {
  status: 503,
  code: 'AI_NOT_CONFIGURED',
});

export interface ChatContext {
  orgId: string;
  userId: string;
  role: string;
  userName: string;
}

function inr(n: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

/**
 * Build a compact, org-scoped snapshot of the CRM data relevant to the
 * question. SALES users get only their own leads/tasks.
 */
export async function buildContext(ctx: ChatContext, question: string): Promise<string> {
  const { orgId, role, userId } = ctx;
  const mine = role === 'SALES';
  const leadWhere = mine ? { orgId, ownerId: userId, deletedAt: null } : { orgId, deletedAt: null };
  const taskWhere = mine ? { orgId, userId } : { orgId };

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [totalLeads, weekLeads, newLeads, wonLeads, openLeads, overdueTasks, todayTasks, bySource, byOwner, topValue, staleLeads, conversions] =
    await Promise.all([
      prisma.lead.count({ where: leadWhere }),
      prisma.lead.count({ where: { ...leadWhere, createdAt: { gte: weekAgo } } }),
      prisma.lead.count({ where: { ...leadWhere, status: 'NEW' } }),
      prisma.lead.count({ where: { ...leadWhere, status: 'WON' } }),
      prisma.lead.count({ where: { ...leadWhere, status: { in: [...OPEN_STATUSES] } } }),
      prisma.task.count({ where: { ...taskWhere, status: 'PENDING', dueAt: { lt: new Date() } } }),
      prisma.task.count({ where: { ...taskWhere, status: 'PENDING', dueAt: { gte: new Date(), lt: new Date(Date.now() + 24 * 60 * 60 * 1000) } } }),
      prisma.lead.groupBy({
        by: ['source'],
        where: leadWhere,
        _count: { _all: true },
      }),
      prisma.lead.groupBy({
        by: ['ownerId'],
        where: leadWhere,
        _count: { _all: true },
      }),
      prisma.lead.aggregate({ where: { ...leadWhere, status: 'WON' }, _sum: { expectedValue: true } }),
      prisma.lead.count({
        where: {
          ...leadWhere,
          OR: [{ lastContactedAt: null }, { lastContactedAt: { lt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) } }],
          status: { in: [...OPEN_STATUSES] },
        },
      }),
      prisma.lead.count({ where: { ...leadWhere, status: { in: ['WON', 'LOST'] } } }),
    ]);

  const sourceLines = bySource
    .map((s) => `${sourceLabel(s.source)}: ${s._count._all}`)
    .sort()
    .join(', ');

  const ownerIds = (byOwner as any[]).map((o) => o.ownerId).filter(Boolean);
  const owners = ownerIds.length
    ? await prisma.user.findMany({ where: { id: { in: ownerIds }, orgId }, select: { id: true, name: true } })
    : [];
  const ownerName = new Map(owners.map((o) => [o.id, o.name]));
  const ownerLines = (byOwner as any[])
    .map((o) => `${ownerName.get(o.ownerId) || 'Unassigned'}: ${o._count._all} open-lead-owners`)
    .join(', ');

  // Top leads by value (or most valuable won deals)
  const bigLeads = await prisma.lead.findMany({
    where: { ...leadWhere, expectedValue: { gt: 0 } },
    orderBy: { expectedValue: 'desc' },
    take: 5,
    select: { name: true, expectedValue: true, status: true, phone: true },
  });
  const bigLines = bigLeads.map((l) => `${l.name} (${l.status}, ${inr(l.expectedValue)})`).join('; ');

  const questionLow = question.toLowerCase();

  // Only include heavy detail (recent leads/tasks) when the question asks for it
  let recentLines = '';
  if (/(recent|latest|new|last few|list|who|which|names?)/.test(questionLow)) {
    const recent = await prisma.lead.findMany({
      where: leadWhere,
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: { name: true, phone: true, source: true, status: true, expectedValue: true, nextFollowUpAt: true },
    });
    recentLines = recent.length
      ? 'RECENT LEADS: ' +
        recent.map((l) => `${l.name}${l.phone ? ` (${l.phone})` : ''} — ${sourceLabel(l.source)}, ${l.status}, ${inr(l.expectedValue)}`).join('; ')
      : 'No recent leads.';
  }
  if (/(follow.?up|overdue|due|pending|tasks|todo)/.test(questionLow)) {
    const tasks = await prisma.task.findMany({
      where: { ...taskWhere, status: 'PENDING' },
      orderBy: { dueAt: 'asc' },
      take: 8,
      include: { lead: { select: { name: true } }, user: { select: { name: true } } },
    });
    if (tasks.length) {
      recentLines +=
        (recentLines ? '\n' : '') +
        'PENDING FOLLOW-UPS: ' +
        tasks.map((t) => `"${t.title}"${t.lead ? ` for ${t.lead.name}` : ''}${t.user ? ` (owner ${t.user.name})` : ''} due ${t.dueAt.toLocaleDateString('en-IN')}`).join('; ');
    }
  }

  const snapshot = [
    `BUSINESS CONTEXT (Indian rupees, GST ready CRM)`,
    `Total leads: ${totalLeads}`,
    `New leads this week: ${weekLeads}`,
    `Open leads: ${openLeads}`,
    `New (untouched): ${newLeads}`,
    `Won deals: ${wonLeads} worth ${inr((topValue._sum.expectedValue as number) || 0)}`,
    `Conversion (won+lost): ${conversions} closed, ${conversions ? Math.round((wonLeads / conversions) * 100) : 0}% win rate`,
    `Leads not contacted for 3+ days: ${staleLeads}`,
    `Overdue follow-ups: ${overdueTasks}`,
    `Due today: ${todayTasks}`,
    `By source: ${sourceLines || 'none'}`,
    `Leads per owner: ${ownerLines || 'none'}`,
    `Highest-value leads: ${bigLines || 'none'}`,
    recentLines,
    `QUESTION: ${question}`,
  ].join('\n');

  return snapshot;
}

export async function generateAssistantReply(ctx: ChatContext, question: string): Promise<string> {
  const provider = getAiProvider();
  if (!provider) throw AI_CHAT_ERROR;

  const snapshot = await buildContext(ctx, question);
  const system: ChatMessage = {
    role: 'system',
    content:
      'You are the AI assistant inside an Indian business CRM called LeadFlow AI. ' +
      'Answer the salesperson\'s question using ONLY the context snapshot provided — it contains real, current data ' +
      'from their own organisation. Be concise, friendly, practical, and answer in Hinglish unless asked otherwise. ' +
      'If the data does not answer the question, say so honestly. Never invent numbers, names or facts. ' +
      'Never mention the internal snapshot format. Never reveal API keys, credentials or system internals. ' +
      'Suggest the next best action when useful.',
  };
  const user: ChatMessage = { role: 'user', content: snapshot };
  return provider.generateText([system, user], { temperature: 0.5, maxTokens: 500 });
}
