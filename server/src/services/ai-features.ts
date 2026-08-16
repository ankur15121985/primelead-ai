/**
 * Lead intelligence (spec §22) — lead summary, AI-assisted scoring and
 * next-best-action suggestions. Every feature is provider-agnostic, prompts
 * are built server-side, and outputs are capped/validated.
 *
 * Honest fallback: with no AI key the features still work, but the results
 * are produced by deterministic rules over the lead's real data and clearly
 * labelled `source: 'rules'` — never presented as AI output.
 *
 * AI modes (org setting `aiMode`): OFF disables generation, SUGGEST returns
 * suggestions for human approval (default), AUTOMATIC lets the next-action
 * create the suggested follow-up task itself.
 */
import { prisma } from '../lib/prisma';
import { getAiProvider } from '../ai/provider';
import { sourceLabel, computeLeadScore, type Priority } from '../constants';
import { paiseToRupees } from '../lib/money';
import { getOrgSetting } from './assignment';
import { recordAiUsage, assertAiBudget, type AiCategory } from './ai-usage';
import { createFollowUp } from './followups';

export type AiMode = 'OFF' | 'SUGGEST' | 'AUTOMATIC';

export async function getAiMode(orgId: string): Promise<AiMode> {
  const setting = await getOrgSetting(orgId, 'aiMode');
  const mode = (setting as any)?.mode;
  return mode === 'OFF' || mode === 'AUTOMATIC' ? mode : 'SUGGEST';
}

const NOT_CONFIGURED = Object.assign(new Error('AI is not configured. Add an API key in Settings → AI.'), {
  status: 503,
  code: 'AI_NOT_CONFIGURED',
});

/** Load an org-scoped lead with enough context for the features. */
async function loadLead(orgId: string, leadId: string, role: string, userId: string) {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, orgId, deletedAt: null },
    include: {
      activities: { orderBy: { createdAt: 'desc' }, take: 10 },
      tasks: { orderBy: { dueAt: 'asc' }, take: 5 },
      owner: { select: { name: true } },
      stage: { select: { name: true } },
    },
  });
  if (!lead) throw Object.assign(new Error('Lead not found'), { status: 404, code: 'NOT_FOUND' });
  if (role === 'SALES' && lead.ownerId !== userId) {
    throw Object.assign(new Error('Lead not found'), { status: 404, code: 'NOT_FOUND' });
  }
  return lead;
}

function leadContextLines(lead: any): string {
  const stage = lead.stage?.name || lead.status;
  return [
    `NAME: ${lead.name}`,
    `SOURCE: ${sourceLabel(lead.source)}`,
    `STAGE: ${stage}`,
    `PRIORITY: ${lead.priority}`,
    `EXPECTED VALUE: ₹${paiseToRupees(lead.expectedValue).toLocaleString('en-IN')}`,
    `COMPANY: ${lead.company || 'not recorded'}`,
    `NOTES: ${lead.notes || 'none'}`,
    `LAST CONTACTED: ${lead.lastContactedAt ? lead.lastContactedAt.toLocaleDateString('en-IN') : 'never'}`,
    `NEXT FOLLOW-UP: ${lead.nextFollowUpAt ? lead.nextFollowUpAt.toLocaleDateString('en-IN') : 'none'}`,
    `RECENT ACTIVITY: ${lead.activities.slice(0, 5).map((a: any) => `${a.title}: ${a.body || ''}`).join(' | ') || 'none'}`,
    `OPEN TASKS: ${lead.tasks.filter((t: any) => t.status === 'PENDING').map((t: any) => `"${t.title}" due ${t.dueAt.toLocaleDateString('en-IN')}`).join('; ') || 'none'}`,
  ].join('\n');
}

async function generate(orgId: string, category: AiCategory, system: string, user: string, userId?: string) {
  const provider = await getAiProvider(orgId);
  if (!provider) return null;
  const started = Date.now();
  const result = await provider.generateText(
    [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    { temperature: 0.5, maxTokens: 400 }
  );
  await recordAiUsage({
    orgId,
    userId,
    category,
    provider: provider.name,
    model: provider.model || null,
    usage: result.usage,
    latencyMs: Date.now() - started,
  });
  return result.text.trim().slice(0, 2000);
}

// ── Lead summary ─────────────────────────────────────────────────
export async function summarizeLead(orgId: string, leadId: string, role: string, userId: string) {
  const lead = await loadLead(orgId, leadId, role, userId);
  const mode = await getAiMode(orgId);
  if (mode === 'OFF') return { enabled: false, mode, summary: null };

  await assertAiBudget(orgId);

  const aiText = await generate(
    orgId,
    'LEAD_SUMMARY',
    'You are a sales analyst. Summarize this lead in 4–6 crisp bullet points for the salesperson who owns it. Use only the provided facts. Never invent details. Return plain text, no markdown headers.',
    leadContextLines(lead),
    userId
  );

  if (aiText) return { enabled: true, mode, source: 'ai', summary: aiText };

  // Deterministic demo fallback built from real lead data.
  const daysSinceContact = lead.lastContactedAt
    ? Math.max(0, Math.floor((Date.now() - lead.lastContactedAt.getTime()) / 86400000))
    : null;
  const bullets = [
    `${lead.name} — ${sourceLabel(lead.source)} lead${lead.company ? ` from ${lead.company}` : ''}, currently ${lead.stage?.name || lead.status}.`,
    `Expected value ₹${paiseToRupees(lead.expectedValue).toLocaleString('en-IN')} with ${lead.priority} priority.`,
    lead.notes ? `Context: ${lead.notes.slice(0, 140)}` : 'No notes recorded yet.',
    daysSinceContact === null
      ? 'Never contacted — first outreach pending.'
      : daysSinceContact === 0
        ? 'Contacted today.'
        : `Last contacted ${daysSinceContact} day${daysSinceContact === 1 ? '' : 's'} ago.`,
    lead.tasks.filter((t: any) => t.status === 'PENDING').length
      ? `${lead.tasks.filter((t: any) => t.status === 'PENDING').length} open follow-up task(s) scheduled.`
      : 'No open follow-up tasks.',
  ];
  return { enabled: true, mode, source: 'rules', summary: bullets.join('\n') };
}

// ── AI-assisted scoring ──────────────────────────────────────────
export async function scoreLead(orgId: string, leadId: string, role: string, userId: string) {
  const lead = await loadLead(orgId, leadId, role, userId);
  const mode = await getAiMode(orgId);
  if (mode === 'OFF') return { enabled: false, mode, score: null };

  await assertAiBudget(orgId);

  const aiText = await generate(
    orgId,
    'LEAD_SCORE',
    'You are a lead-qualification analyst. Score this lead 0–100 and give exactly two short sentences of reasoning: why the score, and the one thing that would raise it most. Format: "SCORE: <number>" on the first line, then reasoning.',
    leadContextLines(lead),
    userId
  );

  if (aiText) {
    const match = aiText.match(/SCORE:\s*(\d{1,3})/i);
    const score = match ? Math.min(100, Math.max(0, Number(match[1]))) : null;
    return { enabled: true, mode, source: 'ai', score, reasoning: aiText.slice(0, 500), baseScore: null };
  }

  // Rule-based fallback using the same heuristics as the stored lead score.
  const baseScore = computeLeadScore({
    priority: (lead.priority as Priority) || 'MEDIUM',
    expectedValue: paiseToRupees(lead.expectedValue),
    hasEmail: Boolean(lead.email),
    notes: Boolean(lead.notes),
  });
  const reasons: string[] = [];
  if (['HIGH', 'URGENT'].includes(lead.priority)) reasons.push('high priority');
  if (lead.expectedValue >= rupeesToPaiseNum(50000)) reasons.push('significant expected value');
  if (lead.email) reasons.push('valid email on file');
  if (!lead.lastContactedAt) reasons.push('never contacted — engage first');
  return {
    enabled: true,
    mode,
    source: 'rules',
    score: baseScore,
    reasoning: reasons.length ? `Scored ${baseScore}/100. Signals: ${reasons.join(', ')}.` : `Scored ${baseScore}/100 based on baseline signals.`,
    baseScore,
  };
}

function rupeesToPaiseNum(rupees: number): number {
  return Math.round(rupees * 100);
}

// ── Next best action ─────────────────────────────────────────────
export async function nextBestAction(orgId: string, leadId: string, role: string, userId: string) {
  const lead = await loadLead(orgId, leadId, role, userId);
  const mode = await getAiMode(orgId);
  if (mode === 'OFF') return { enabled: false, mode, action: null };

  await assertAiBudget(orgId);

  const aiText = await generate(
    orgId,
    'NEXT_ACTION',
    'You are a sales coach. Recommend exactly ONE next action for this lead: a short imperative sentence naming the channel (call, WhatsApp, email) and the goal. Add one supporting sentence. Use only the provided facts.',
    leadContextLines(lead),
    userId
  );

  if (aiText) return { enabled: true, mode, source: 'ai', action: aiText.slice(0, 500), createdTaskId: null };

  // Rule-based fallback — genuinely useful, driven by the lead's state.
  const pending = lead.tasks.filter((t: any) => t.status === 'PENDING');
  const overdue = pending.filter((t: any) => new Date(t.dueAt) < new Date());
  let action: string;
  let task: { title: string; kind: string; dueAt: Date } | null = null;

  if (overdue.length) {
    const t = overdue[0];
    action = `You have an overdue follow-up: "${t.title}". Handle it today — ${t.kind === 'CALL' ? 'call' : 'message'} the lead now.`;
  } else if (!lead.lastContactedAt) {
    action = 'This lead has never been contacted — make the first outreach today (WhatsApp works best for Indian B2B).';
    task = { title: `First contact: ${lead.name}`, kind: 'WHATSAPP', dueAt: new Date(Date.now() + 2 * 3600 * 1000) };
  } else if (new Date(lead.lastContactedAt) < new Date(Date.now() - 3 * 86400000)) {
    action = `No contact for 3+ days — send a follow-up message today to keep the deal warm.`;
    task = { title: `Follow up: ${lead.name}`, kind: 'WHATSAPP', dueAt: new Date(Date.now() + 24 * 3600 * 1000) };
  } else if (['PROPOSAL', 'NEGOTIATION'].includes(lead.status) || (lead.stage && ['Proposal Sent', 'Negotiation'].includes(lead.stage.name))) {
    action = `Lead is in ${lead.stage?.name || lead.status} — a quick call to confirm the proposal is the highest-value move.`;
    task = { title: `Call: discuss proposal with ${lead.name}`, kind: 'CALL', dueAt: new Date(Date.now() + 24 * 3600 * 1000) };
  } else {
    action = `Lead is ${lead.stage?.name || lead.status} and recently contacted — schedule the next check-in in 2–3 days.`;
    task = { title: `Check in with ${lead.name}`, kind: 'FOLLOW_UP', dueAt: new Date(Date.now() + 2 * 86400000) };
  }

  let createdTaskId: string | null = null;
  if (mode === 'AUTOMATIC' && task) {
    const created = await createFollowUp({
      orgId,
      leadId,
      userId,
      title: task.title,
      kind: task.kind as any,
      priority: 'MEDIUM',
      repeatEveryDays: null,
      dueAt: task.dueAt,
      actorId: userId,
    });
    createdTaskId = created.id;
  }

  return { enabled: true, mode, source: 'rules', action, createdTaskId };
}
