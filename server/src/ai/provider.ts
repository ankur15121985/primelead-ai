/**
 * AI provider abstraction.
 *
 * The rest of the application never talks to a specific AI vendor. It only
 * depends on `generateText()`, so OpenAI, Anthropic, Gemini or any
 * OpenAI-compatible endpoint can be plugged in via environment variables.
 */
import { config } from '../config';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GenerateOptions {
  temperature?: number;
  maxTokens?: number;
}

export interface AiProvider {
  readonly name: string;
  generateText(messages: ChatMessage[], opts?: GenerateOptions): Promise<string>;
}

/** OpenAI-compatible chat completions (also covers Gemini's and most self-hosted endpoints). */
class OpenAICompatibleProvider implements AiProvider {
  readonly name = 'openai-compatible';
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly model: string;

  constructor(apiKey: string, baseUrl: string, model: string) {
    this.apiKey = apiKey;
    this.model = model;
    this.baseUrl = (baseUrl || 'https://api.openai.com/v1').replace(/\/$/, '');
  }

  async generateText(messages: ChatMessage[], opts: GenerateOptions = {}): Promise<string> {
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
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = json.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error('AI provider returned an empty response.');
    return content;
  }
}

let cached: AiProvider | null = null;

/** Per-org override (e.g. an API key saved in org settings). Clears the cache. */
export interface AiOverride {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}

let override: AiOverride | null = null;

export function setAiOverride(o: AiOverride | null): void {
  override = o;
  cached = null;
}

/** Returns a configured provider, or null when no API key is set. */
export function getAiProvider(): AiProvider | null {
  const key = override?.apiKey || config.ai.apiKey;
  if (!key) return null;
  if (cached) return cached;
  cached = new OpenAICompatibleProvider(
    key,
    override?.baseUrl || config.ai.baseUrl,
    override?.model || config.ai.model || 'gpt-4o-mini'
  );
  return cached;
}

/** True when the AI provider is configured and ready. */
export function isAiConfigured(): boolean {
  return Boolean(override?.apiKey || config.ai.apiKey);
}
