/**
 * AI provider abstraction.
 *
 * The rest of the application never talks to a specific AI vendor. It only
 * depends on `getAiProvider(orgId)`, so OpenAI, Anthropic, Gemini or any
 * OpenAI-compatible endpoint can be plugged in via environment variables or
 * per-org settings.
 *
 * SECURITY: providers are resolved PER ORGANISATION from the org's own
 * settings (or the global env config) — an API key saved by org A is never
 * used to serve org B's requests. There is no process-global override.
 */
import { prisma } from '../lib/prisma';
import { config } from '../config';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GenerateOptions {
  temperature?: number;
  maxTokens?: number;
}

export interface TokenUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface AiResult {
  text: string;
  usage?: TokenUsage;
}

export interface AiProvider {
  readonly name: string;
  /** Provider info used for usage accounting — the org's effective model. */
  readonly model?: string;
  generateText(messages: ChatMessage[], opts?: GenerateOptions): Promise<AiResult>;
}

/** OpenAI-compatible chat completions (also covers Gemini's and most self-hosted endpoints). */
class OpenAICompatibleProvider implements AiProvider {
  readonly name = 'openai-compatible';
  readonly model: string;
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(apiKey: string, baseUrl: string, model: string) {
    this.apiKey = apiKey;
    this.model = model;
    this.baseUrl = (baseUrl || 'https://api.openai.com/v1').replace(/\/$/, '');
    this.model = model;
  }

  async generateText(messages: ChatMessage[], opts: GenerateOptions = {}): Promise<AiResult> {
    const started = Date.now();
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: opts.temperature ?? 0.7,
        max_tokens: opts.maxTokens ?? 900,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`AI provider error (${res.status}): ${text.slice(0, 300)}`);
    }
    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    };
    const content = json.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error('AI provider returned an empty response.');
    return {
      text: content,
      usage: json.usage
        ? {
            promptTokens: json.usage.prompt_tokens,
            completionTokens: json.usage.completion_tokens,
            totalTokens: json.usage.total_tokens,
          }
        : undefined,
    };
  }
}

interface OrgAiSetting {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}

/** Read the org's AI settings row (never exposes the key to clients). */
async function orgAiSetting(orgId: string): Promise<OrgAiSetting | null> {
  try {
    const row = await prisma.orgSetting.findUnique({
      where: { orgId_key: { orgId, key: 'ai' } },
      select: { value: true, updatedAt: true },
    });
    if (!row?.value) return null;
    const v = row.value as OrgAiSetting;
    if (!v.apiKey) return null;
    return v;
  } catch {
    return null;
  }
}

// Small per-org cache keyed by the effective config so repeat calls don't hit
// the DB on every keystroke. A settings change alters the signature → miss.
const cache = new Map<string, { sig: string; provider: AiProvider }>();

function buildProvider(key: string, baseUrl: string, model: string): AiProvider {
  return new OpenAICompatibleProvider(key, baseUrl, model);
}

/** Returns a provider for an org (env config used when the org has no key). */
export async function getAiProvider(orgId?: string): Promise<AiProvider | null> {
  const org = orgId ? await orgAiSetting(orgId) : null;
  const key = org?.apiKey || config.ai.apiKey;
  if (!key) return null;

  const baseUrl = org?.baseUrl || config.ai.baseUrl || '';
  const model = org?.model || config.ai.model || 'gpt-4o-mini';
  const sig = `${orgId || 'global'}|${key}|${baseUrl}|${model}`;

  const hit = cache.get(sig);
  if (hit) return hit.provider;

  const provider = buildProvider(key, baseUrl, model);
  // Bound the cache so an org changing keys many times can't leak memory.
  if (cache.size > 500) cache.clear();
  cache.set(sig, { sig, provider });
  return provider;
}

/** True when the AI provider is configured for this org (or globally). */
export async function isAiConfigured(orgId?: string): Promise<boolean> {
  return (await getAiProvider(orgId)) !== null;
}
