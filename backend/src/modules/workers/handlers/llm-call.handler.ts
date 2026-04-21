import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StepType } from '@prisma/client';
import { StepHandler, StepExecutionInput, StepResult } from './step-handler.interface';
import { interpolate } from './template';
import type { AppEnv } from '../../../common/config/env';

type Provider = 'openai' | 'anthropic' | 'mock';

interface LlmConfig {
  provider?: Provider;
  model?: string;
  systemPrompt?: string;
  userPromptTemplate?: string;
  temperature?: number;
  maxTokens?: number;
  /** Ordered list of fallback models used by the SWITCH_MODEL recovery. */
  fallbackModels?: string[];
}

interface LlmResponse {
  text: string;
  model: string;
  provider: Provider;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
}

/**
 * Per-1K-token prices (USD). Kept in code so tenants get deterministic cost
 * telemetry without an external config dep. Update as provider pricing shifts.
 */
const PRICING: Record<string, { in: number; out: number }> = {
  'gpt-4o':               { in: 0.0050, out: 0.0150 },
  'gpt-4o-mini':          { in: 0.00015, out: 0.0006 },
  'gpt-3.5-turbo':        { in: 0.0005, out: 0.0015 },
  'claude-3-5-sonnet':    { in: 0.0030, out: 0.0150 },
  'claude-3-5-haiku':     { in: 0.0008, out: 0.0040 },
  'claude-3-haiku':       { in: 0.00025, out: 0.00125 },
};

/**
 * LLM_CALL step handler.
 *
 * Config shape (WorkflowStep.config):
 *   {
 *     "provider": "openai" | "anthropic" | "mock",
 *     "model": "gpt-4o-mini",
 *     "systemPrompt": "You are a helpful assistant.",
 *     "userPromptTemplate": "Summarize: {{payload.text}}",
 *     "temperature": 0.7,
 *     "maxTokens": 512,
 *     "fallbackModels": ["gpt-3.5-turbo", "claude-3-haiku"]
 *   }
 *
 * Recovery integration:
 *   - `recoveryHint.overrideModel` (set by SWITCH_MODEL) takes precedence over
 *     `config.model` for the current attempt.
 *   - `recoveryHint.reduceContext` truncates the interpolated user prompt to
 *     the first 2000 characters.
 *
 * Providers:
 *   - `mock` — no API key required; deterministic canned completion used in
 *     the demo workflow and tests. Returns deterministic token counts so
 *     dashboards show real-looking cost numbers.
 *   - `openai` / `anthropic` — direct `fetch` calls, no SDK. Requires
 *     `OPENAI_API_KEY` / `ANTHROPIC_API_KEY`.
 */
@Injectable()
export class LlmCallHandler implements StepHandler {
  readonly type = StepType.LLM_CALL;
  private readonly logger = new Logger(LlmCallHandler.name);

  constructor(private readonly config: ConfigService<AppEnv, true>) {}

  async execute(input: StepExecutionInput): Promise<StepResult> {
    const cfg = (input.config ?? {}) as LlmConfig;
    const provider: Provider =
      cfg.provider ??
      (this.config.get('DEFAULT_LLM_PROVIDER', { infer: true }) as Provider) ??
      'mock';
    const model =
      input.recoveryHint?.overrideModel ??
      cfg.model ??
      this.config.get('DEFAULT_LLM_MODEL', { infer: true }) ??
      'mock-small';

    const context = { payload: input.payload, config: cfg };
    let prompt = interpolate(cfg.userPromptTemplate ?? '', context);
    if (input.recoveryHint?.reduceContext && prompt.length > 2000) {
      prompt = prompt.slice(0, 2000) + '... [truncated]';
    }
    if (!prompt) {
      throw new Error('LLM_CALL: userPromptTemplate is required');
    }

    const response = await this.dispatch(provider, {
      model,
      systemPrompt: cfg.systemPrompt,
      userPrompt: prompt,
      temperature: cfg.temperature ?? 0.7,
      maxTokens: cfg.maxTokens ?? 512,
    });

    this.logger.log(
      `LLM_CALL ${provider}/${model} — ${response.promptTokens}+${response.completionTokens} tok ($${response.costUsd.toFixed(6)})`,
    );

    return {
      result: {
        text: response.text,
        provider: response.provider,
        attempt: input.attempt,
      },
      telemetry: {
        model: response.model,
        promptTokens: response.promptTokens,
        completionTokens: response.completionTokens,
        costUsd: response.costUsd,
      },
    };
  }

  private dispatch(
    provider: Provider,
    args: {
      model: string;
      systemPrompt?: string;
      userPrompt: string;
      temperature: number;
      maxTokens: number;
    },
  ): Promise<LlmResponse> {
    switch (provider) {
      case 'mock':
        return this.mock(args);
      case 'openai':
        return this.openai(args);
      case 'anthropic':
        return this.anthropic(args);
      default: {
        const err = new Error(`Unknown LLM provider: ${provider}`);
        err.name = 'ValidationError';
        return Promise.reject(err);
      }
    }
  }

  // ── Providers ─────────────────────────────────────────────────────────────

  private async mock(args: {
    model: string;
    userPrompt: string;
  }): Promise<LlmResponse> {
    // Deterministic but flaky on first attempt so recovery can kick in.
    await new Promise((r) => setTimeout(r, 100 + Math.random() * 150));
    const shouldFail = args.model === 'mock-flaky' && Math.random() < 0.6;
    if (shouldFail) {
      const err = new Error('Mock provider: simulated rate limit');
      err.name = 'RateLimitError';
      throw err;
    }
    const promptTokens = Math.ceil(args.userPrompt.length / 4);
    const completionTokens = 64;
    return {
      text: `[mock completion for "${args.userPrompt.slice(0, 40)}..."]`,
      model: args.model,
      provider: 'mock',
      promptTokens,
      completionTokens,
      costUsd: estimateCost(args.model, promptTokens, completionTokens),
    };
  }

  private async openai(args: {
    model: string;
    systemPrompt?: string;
    userPrompt: string;
    temperature: number;
    maxTokens: number;
  }): Promise<LlmResponse> {
    const key = this.config.get('OPENAI_API_KEY', { infer: true });
    if (!key) throw new Error('LLM_CALL: OPENAI_API_KEY not configured');

    const messages: { role: string; content: string }[] = [];
    if (args.systemPrompt) messages.push({ role: 'system', content: args.systemPrompt });
    messages.push({ role: 'user', content: args.userPrompt });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60_000);
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: args.model,
          messages,
          temperature: args.temperature,
          max_tokens: args.maxTokens,
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const body = await res.text();
        const err = new Error(`OpenAI ${res.status}: ${body.slice(0, 200)}`);
        err.name = res.status === 429 ? 'RateLimitError' : 'ExternalServiceError';
        throw err;
      }
      const data = (await res.json()) as {
        choices: { message: { content: string } }[];
        usage?: { prompt_tokens: number; completion_tokens: number };
      };
      const prompt = data.usage?.prompt_tokens ?? 0;
      const completion = data.usage?.completion_tokens ?? 0;
      return {
        text: data.choices[0]?.message?.content ?? '',
        model: args.model,
        provider: 'openai',
        promptTokens: prompt,
        completionTokens: completion,
        costUsd: estimateCost(args.model, prompt, completion),
      };
    } finally {
      clearTimeout(timer);
    }
  }

  private async anthropic(args: {
    model: string;
    systemPrompt?: string;
    userPrompt: string;
    temperature: number;
    maxTokens: number;
  }): Promise<LlmResponse> {
    const key = this.config.get('ANTHROPIC_API_KEY', { infer: true });
    if (!key) throw new Error('LLM_CALL: ANTHROPIC_API_KEY not configured');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60_000);
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: args.model,
          max_tokens: args.maxTokens,
          temperature: args.temperature,
          system: args.systemPrompt,
          messages: [{ role: 'user', content: args.userPrompt }],
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const body = await res.text();
        const err = new Error(`Anthropic ${res.status}: ${body.slice(0, 200)}`);
        err.name = res.status === 429 ? 'RateLimitError' : 'ExternalServiceError';
        throw err;
      }
      const data = (await res.json()) as {
        content: { text: string }[];
        usage?: { input_tokens: number; output_tokens: number };
      };
      const prompt = data.usage?.input_tokens ?? 0;
      const completion = data.usage?.output_tokens ?? 0;
      return {
        text: data.content.map((c) => c.text).join(''),
        model: args.model,
        provider: 'anthropic',
        promptTokens: prompt,
        completionTokens: completion,
        costUsd: estimateCost(args.model, prompt, completion),
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

function estimateCost(model: string, promptTokens: number, completionTokens: number): number {
  const entry = PRICING[model];
  if (!entry) return 0;
  return (promptTokens * entry.in + completionTokens * entry.out) / 1000;
}
