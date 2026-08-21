/**
 * Meeting Intelligence (Phase 12, spec §44-45).
 *
 * Pre-meeting:
 *  - Company/contact research summary
 *  - Previous interactions
 *  - Open deals
 *  - Suggested questions
 *
 * Post-meeting:
 *  - Summary (AI-generated or rule-based)
 *  - Action items
 *  - Follow-up tasks
 *  - Deal risk assessment
 *  - Sentiment analysis
 */
import { prisma } from '../lib/prisma';
import { getAiProvider } from '../ai/provider';
import { recordAiUsage, assertAiBudget } from './ai-usage';
import type { ChatMessage } from '../ai/provider';

// ── Pre-Meeting Prep ────────────────────────────────────────

export async function generateMeetingPrep(
  orgId: string,
  meetingId: string,
  userId?: string
): Promise<{ prep: any; fromCache: boolean }> {
  // Check for cached prep
  const existing = await prisma.meetingPrep.findFirst({ where: { orgId, meetingId } });
  if (existing) return { prep: existing, fromCache: true };

  const meeting = await prisma.meeting.findFirst({
    where: { id: meetingId, orgId },
    include: { lead: { include: { activities: { orderBy: { createdAt: 'desc' }, take: 10 } } } },
  });
  if (!meeting) throw Object.assign(new Error('Meeting not found'), { status: 404 });

  await assertAiBudget(orgId);

  const provider = await getAiProvider(orgId);
  if (provider) {
    try {
      const prep = await aiGeneratePrep(orgId, meeting, provider, userId);
      return { prep, fromCache: false };
    } catch {
      // Fall through to rule-based
    }
  }

  const prep = await ruleBasedPrep(orgId, meeting, userId);
  return { prep, fromCache: false };
}

async function aiGeneratePrep(orgId: string, meeting: any, provider: any, userId?: string) {
  const lead = meeting.lead;
  const context = [
    `MEETING: ${meeting.title}`,
    `TYPE: ${meeting.meetingType}`,
    `DATE: ${meeting.startAt?.toLocaleDateString('en-IN')}`,
    `DURATION: ${meeting.durationMinutes} minutes`,
    lead ? `\nLEAD: ${lead.name}` : '',
    lead?.company ? `COMPANY: ${lead.company}` : '',
    lead?.email ? `EMAIL: ${lead.email}` : '',
    lead?.phone ? `PHONE: ${lead.phone}` : '',
    lead?.notes ? `NOTES: ${lead.notes.slice(0, 300)}` : '',
    lead?.activities?.length ? `\nRECENT ACTIVITIES:\n${lead.activities.map((a: any) => `- ${a.title}: ${a.body || ''}`).join('\n')}` : '',
  ].filter(Boolean).join('\n');

  const system: ChatMessage = {
    role: 'system',
    content: `You are a sales meeting prep assistant. Generate a structured meeting preparation document.
Return JSON:
{
  "companyOverview": "Brief company overview based on available data",
  "contactProfile": "Key info about the contact",
  "previousInteractions": [{"type": "call|email|meeting", "date": "date", "summary": "what happened"}],
  "suggestedQuestions": [{"question": "...", "reason": "why ask this"}],
  "talkingPoints": ["point 1", "point 2"]
}
Use only the provided data. Never fabricate information.`,
  };

  const user: ChatMessage = { role: 'user', content: context };
  const started = Date.now();
  const result = await provider.generateText([system, user], { temperature: 0.3, maxTokens: 1200 });

  await recordAiUsage({ orgId, userId, category: 'OTHER', provider: provider.name, model: provider.model || null, usage: result.usage, latencyMs: Date.now() - started });

  let parsed: any;
  try {
    const jsonMatch = result.text.match(/\{[\s\S]*\}/);
    parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
  } catch {
    parsed = {};
  }

  const prep = await prisma.meetingPrep.create({
    data: {
      orgId,
      meetingId: meeting.id,
      contactId: meeting.contactId || lead?.id || null,
      companyId: null,
      companyOverview: parsed.companyOverview || null,
      contactProfile: parsed.contactProfile || null,
      previousInteractions: parsed.previousInteractions || null,
      suggestedQuestions: parsed.suggestedQuestions || null,
      talkingPoints: parsed.talkingPoints || null,
      tokensUsed: result.usage?.totalTokens || 0,
      provider: provider.name,
      model: provider.model || null,
    },
  });

  return prep;
}

async function ruleBasedPrep(orgId: string, meeting: any, userId?: string) {
  const lead = meeting.lead;
  const activities = lead?.activities || [];

  const previousInteractions = activities.slice(0, 5).map((a: any) => ({
    type: a.title?.toLowerCase().includes('call') ? 'call' : a.title?.toLowerCase().includes('email') ? 'email' : 'activity',
    date: a.createdAt?.toISOString().slice(0, 10),
    summary: `${a.title}: ${(a.body || '').slice(0, 100)}`,
  }));

  const suggestedQuestions = [
    { question: 'What are your biggest challenges right now?', reason: 'Open-ended to uncover pain points' },
    { question: 'What does your ideal solution look like?', reason: 'Understand requirements and expectations' },
    { question: 'Who else is involved in this decision?', reason: 'Identify all stakeholders' },
  ];

  if (lead?.company) {
    suggestedQuestions.push({
      question: `How has ${lead.company} been growing recently?`,
      reason: 'Shows research and genuine interest',
    });
  }

  const prep = await prisma.meetingPrep.create({
    data: {
      orgId,
      meetingId: meeting.id,
      contactId: meeting.contactId || lead?.id || null,
      companyOverview: lead?.company ? `${lead.company} — lead source: ${lead.source || 'unknown'}.` : null,
      contactProfile: lead ? `${lead.name}${lead.email ? ` (${lead.email})` : ''}${lead.phone ? ` | ${lead.phone}` : ''}` : null,
      previousInteractions: previousInteractions.length > 0 ? previousInteractions : null,
      suggestedQuestions,
      talkingPoints: [
        'Review recent activities before the meeting',
        'Confirm agenda at the start',
        'Listen for pain points before pitching',
      ],
      tokensUsed: 0,
      provider: 'rules',
      model: null,
    },
  });

  return prep;
}

// ── Post-Meeting Summary ────────────────────────────────────

export async function completeMeeting(
  orgId: string,
  meetingId: string,
  data: {
    summary?: string;
    actionItems?: Array<{ action: string; assignee?: string; dueDate?: string }>;
    followUpTasks?: Array<{ title: string; type: string; dueDate?: string }>;
    dealRisk?: string;
    dealRiskReason?: string;
    sentiment?: string;
  },
  userId?: string
) {
  const meeting = await prisma.meeting.findFirst({ where: { id: meetingId, orgId } });
  if (!meeting) throw Object.assign(new Error('Meeting not found'), { status: 404 });

  // Update meeting
  await prisma.meeting.update({
    where: { id: meetingId },
    data: {
      status: 'COMPLETED',
      summary: data.summary || meeting.summary || null,
      actionItems: data.actionItems || meeting.actionItems || undefined,
    },
  });

  // Update or create meeting prep with post-meeting data
  const existingPrep = await prisma.meetingPrep.findFirst({ where: { orgId, meetingId } });
  if (existingPrep) {
    await prisma.meetingPrep.update({
      where: { id: existingPrep.id },
      data: {
        summary: data.summary || undefined,
        actionItems: data.actionItems || undefined,
        followUpTasks: data.followUpTasks || undefined,
        dealRisk: data.dealRisk || undefined,
        dealRiskReason: data.dealRiskReason || undefined,
        sentiment: data.sentiment || undefined,
      },
    });
  } else {
    await prisma.meetingPrep.create({
      data: {
        orgId,
        meetingId,
        summary: data.summary || null,
        actionItems: data.actionItems || undefined,
        followUpTasks: data.followUpTasks || undefined,
        dealRisk: data.dealRisk || null,
        dealRiskReason: data.dealRiskReason || null,
        sentiment: data.sentiment || null,
      },
    });
  }

  // Create follow-up tasks
  if (data.followUpTasks) {
    for (const task of data.followUpTasks) {
      await prisma.task.create({
        data: {
          orgId,
          leadId: meeting.leadId || undefined,
          userId: userId || '',
          title: task.title,
          kind: task.type || 'FOLLOW_UP',
          priority: 'MEDIUM',
          dueAt: task.dueDate ? new Date(task.dueDate) : new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
    }
  }

  return { success: true };
}

// ── Get Meeting Prep ────────────────────────────────────────

export async function getMeetingPrep(orgId: string, meetingId: string) {
  const prep = await prisma.meetingPrep.findFirst({ where: { orgId, meetingId } });
  return prep || null;
}

export async function getAllPreps(orgId: string, filters: { contactId?: string; companyId?: string; limit?: number }) {
  const where: Record<string, unknown> = { orgId };
  if (filters.contactId) where.contactId = filters.contactId;
  if (filters.companyId) where.companyId = filters.companyId;

  return prisma.meetingPrep.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: filters.limit || 20,
  });
}
