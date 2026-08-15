/**
 * AI follow-up writer.
 *
 * Reads the lead's real history (notes, activities, stage, last contact,
 * expected value) and generates a context-aware follow-up message in the
 * requested tone and language. Uses the provider abstraction — no vendor
 * code here.
 */
import { getAiProvider } from '../ai/provider';
import type { ChatMessage } from '../ai/provider';

export type Tone = 'professional' | 'friendly' | 'short' | 'persuasive';
export type Language = 'english' | 'hindi' | 'hinglish';
export type Channel = 'whatsapp' | 'email' | 'call';

interface FollowUpContext {
  customerName: string;
  leadSource: string;
  stage: string;
  priority: string;
  expectedValue: number;
  productService?: string;
  notes: string;
  lastContactDate?: string;
  lastActivity: string;
  activities: string[];
  objective: string;
  channel: Channel;
  tone: Tone;
  language: Language;
}

const TONE_PROMPTS: Record<Tone, string> = {
  professional: 'Use a professional, warm business tone.',
  friendly: 'Use a friendly, casual and personal tone, as a trusted advisor.',
  short: 'Keep it very short — 2 to 3 crisp sentences.',
  persuasive: 'Use a persuasive tone that gently creates urgency without being pushy.',
};

const LANGUAGE_PROMPTS: Record<Language, string> = {
  english: 'Write the message in English.',
  hindi: 'Write the message in Hindi (Devanagari script).',
  hinglish: 'Write the message in Hinglish (Hindi written in Roman script, mixed with English).',
};

/** True when AI is configured for this org (or globally). */
export async function isAiReady(orgId?: string): Promise<boolean> {
  return (await getAiProvider(orgId)) !== null;
}

export async function writeFollowUp(ctx: FollowUpContext, orgId?: string): Promise<{ message: string; subject?: string }> {
  const provider = await getAiProvider(orgId);
  if (!provider) {
    throw Object.assign(new Error('AI is not configured. Add an API key in Settings to enable AI follow-ups.'), {
      status: 503,
      code: 'AI_NOT_CONFIGURED',
    });
  }

  const history = ctx.activities.slice(-8).map((a) => `• ${a}`).join('\n');
  const system: ChatMessage = {
    role: 'system',
    content:
      'You are an expert sales assistant for an Indian business using a CRM. ' +
      'Write a short, natural follow-up message for a salesperson. Never invent facts ' +
      'or details that are not present in the lead history. Never mention the CRM itself. ' +
      'Return only the message text, ready to send.',
  };
  const user: ChatMessage = {
    role: 'user',
    content: `Write a ${ctx.channel} follow-up message.
${TONE_PROMPTS[ctx.tone]}
${LANGUAGE_PROMPTS[ctx.language]}

CUSTOMER: ${ctx.customerName}
LEAD SOURCE: ${ctx.leadSource}
CURRENT STAGE: ${ctx.stage}
PRIORITY: ${ctx.priority}
EXPECTED VALUE: ₹${ctx.expectedValue.toLocaleString('en-IN')}
PRODUCT/SERVICE: ${ctx.productService || 'not specified'}
LAST CONTACT: ${ctx.lastContactDate || 'not recorded'}
RECENT HISTORY:
${history || 'No prior interactions recorded.'}

NEXT OBJECTIVE: ${ctx.objective}

IMPORTANT: Use the customer's name naturally. Keep it under 120 words.`,
  };

  const message = await provider.generateText([system, user], { temperature: 0.7, maxTokens: 350 });
  const subject =
    ctx.channel === 'email'
      ? `Following up — ${ctx.customerName}`.slice(0, 60)
      : undefined;
  return { message, subject };
}
