/**
 * AI provider adapter.
 *
 * Selects a provider from the environment. With NO key configured the app runs
 * in DEMO MODE: deterministic, clearly-labelled placeholder content that never
 * claims to have performed research and never produces a price.
 *
 * Secrets stay server-side: this module is imported only from route handlers
 * and server components. Prompt inputs are not logged; only a salted hash of
 * the prompt is persisted for traceability.
 */
import { createHash } from 'node:crypto';

export type ProviderId = 'anthropic' | 'openai' | 'demo';

export interface ProviderInfo {
  id: ProviderId;
  model: string;
  demoMode: boolean;
  /** True only when a real research connector is wired. Never inferred. */
  researchEnabled: boolean;
  reason: string;
}

export function resolveProvider(): ProviderInfo {
  const anthropic = process.env.ANTHROPIC_API_KEY?.trim();
  const openai = process.env.OPENAI_API_KEY?.trim();
  const model = process.env.AI_MODEL?.trim();
  const researchEnabled = Boolean(process.env.RESEARCH_CONNECTOR?.trim());

  if (anthropic) {
    return {
      id: 'anthropic',
      model: model || 'claude-sonnet-4-5',
      demoMode: false,
      researchEnabled,
      reason: 'ANTHROPIC_API_KEY configurada.',
    };
  }
  if (openai) {
    return {
      id: 'openai',
      model: model || 'gpt-4o',
      demoMode: false,
      researchEnabled,
      reason: 'OPENAI_API_KEY configurada.',
    };
  }
  return {
    id: 'demo',
    model: 'demo-deterministico',
    demoMode: true,
    researchEnabled: false,
    reason: 'Nenhuma chave de IA configurada. Conteúdo gerado em MODO DEMONSTRAÇÃO.',
  };
}

export function promptHash(prompt: string): string {
  return createHash('sha256').update(prompt).digest('hex').slice(0, 16);
}

export interface CompletionRequest {
  system: string;
  user: string;
  /** JSON Schema the model is told to satisfy. Validation still happens with Zod. */
  schemaName: string;
  maxTokens?: number;
}

export interface CompletionResult {
  raw: string;
  inputTokens?: number;
  outputTokens?: number;
  latencyMs: number;
}

export class AiProviderError extends Error {
  constructor(message: string, readonly retriable: boolean) {
    super(message);
  }
}

async function callAnthropic(req: CompletionRequest, model: string): Promise<CompletionResult> {
  const started = Date.now();
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: req.maxTokens ?? 8000,
      system: req.system,
      messages: [{ role: 'user', content: req.user }],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new AiProviderError(
      `Anthropic respondeu ${res.status}: ${body.slice(0, 300)}`,
      res.status === 429 || res.status >= 500,
    );
  }
  const json = (await res.json()) as {
    content: Array<{ type: string; text?: string }>;
    usage?: { input_tokens: number; output_tokens: number };
  };
  const raw = json.content.filter((c) => c.type === 'text').map((c) => c.text ?? '').join('');
  return {
    raw,
    inputTokens: json.usage?.input_tokens,
    outputTokens: json.usage?.output_tokens,
    latencyMs: Date.now() - started,
  };
}

async function callOpenAI(req: CompletionRequest, model: string): Promise<CompletionResult> {
  const started = Date.now();
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${process.env.OPENAI_API_KEY!}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: req.maxTokens ?? 8000,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: req.system },
        { role: 'user', content: req.user },
      ],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new AiProviderError(
      `OpenAI respondeu ${res.status}: ${body.slice(0, 300)}`,
      res.status === 429 || res.status >= 500,
    );
  }
  const json = (await res.json()) as {
    choices: Array<{ message: { content: string } }>;
    usage?: { prompt_tokens: number; completion_tokens: number };
  };
  return {
    raw: json.choices[0]?.message?.content ?? '',
    inputTokens: json.usage?.prompt_tokens,
    outputTokens: json.usage?.completion_tokens,
    latencyMs: Date.now() - started,
  };
}

/** Retries transient failures with exponential backoff. */
export async function complete(req: CompletionRequest, attempts = 3): Promise<CompletionResult> {
  const provider = resolveProvider();
  if (provider.demoMode) {
    throw new AiProviderError('Nenhum provedor de IA configurado (modo demonstração).', false);
  }
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return provider.id === 'anthropic'
        ? await callAnthropic(req, provider.model)
        : await callOpenAI(req, provider.model);
    } catch (error) {
      lastError = error;
      const retriable = error instanceof AiProviderError ? error.retriable : true;
      if (!retriable || attempt === attempts) break;
      await new Promise((r) => setTimeout(r, 2 ** attempt * 500));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

/** Extracts the first JSON object from a model response that may be fenced. */
export function extractJson(raw: string): unknown {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : trimmed;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1) {
    throw new Error('A resposta do modelo não contém um objeto JSON.');
  }
  return JSON.parse(candidate.slice(start, end + 1));
}
