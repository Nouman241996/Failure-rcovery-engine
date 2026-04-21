import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StepType } from '@prisma/client';
import { StepHandler, StepExecutionInput, StepResult } from './step-handler.interface';
import { interpolate } from './template';
import type { AppEnv } from '../../../common/config/env';

interface ToolConfig {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  /** Body template — supports `{{payload.x}}` interpolation. */
  bodyTemplate?: unknown;
  /** Per-call timeout in ms (overrides TOOL_TIMEOUT_MS). */
  timeoutMs?: number;
}

/**
 * TOOL_INVOKE step handler.
 *
 * Calls any HTTPS endpoint with optional templated body/headers — the
 * "function-calling" primitive for AI agents. Response body (if JSON) is
 * stored on JobStep.result and becomes available to downstream steps via
 * `payload` context (by convention: `payload.steps["<stepName>"]`).
 *
 * Non-2xx responses are thrown so the recovery layer can pick a strategy
 * (RETRY, FALLBACK, SWITCH_MODEL for agent tool failures, etc).
 */
@Injectable()
export class ToolInvokeHandler implements StepHandler {
  readonly type = StepType.TOOL_INVOKE;
  private readonly logger = new Logger(ToolInvokeHandler.name);

  constructor(private readonly config: ConfigService<AppEnv, true>) {}

  async execute(input: StepExecutionInput): Promise<StepResult> {
    const cfg = input.config as unknown as ToolConfig;
    if (!cfg?.url) throw new Error('TOOL_INVOKE: config.url is required');

    const context = { payload: input.payload, config: cfg };
    const url = interpolate(cfg.url, context);
    const headers = interpolate(cfg.headers ?? {}, context);
    const body = cfg.bodyTemplate ? interpolate(cfg.bodyTemplate, context) : undefined;
    const timeoutMs =
      cfg.timeoutMs ?? this.config.get('TOOL_TIMEOUT_MS', { infer: true }) ?? 30_000;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const started = Date.now();
    try {
      const res = await fetch(url, {
        method: cfg.method ?? 'POST',
        headers: {
          'content-type': 'application/json',
          ...(headers as Record<string, string>),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
      const durationMs = Date.now() - started;

      const raw = await res.text();
      let parsed: unknown = raw;
      try {
        parsed = raw ? JSON.parse(raw) : null;
      } catch {
        /* keep raw string */
      }

      if (!res.ok) {
        const err = new Error(
          `TOOL_INVOKE ${cfg.method ?? 'POST'} ${url} → ${res.status}: ${raw.slice(0, 200)}`,
        );
        err.name = res.status >= 500 ? 'ExternalServiceError' : 'ValidationError';
        throw err;
      }

      this.logger.log(`TOOL_INVOKE ${url} → ${res.status} in ${durationMs}ms`);
      return {
        result: {
          status: res.status,
          durationMs,
          body: parsed,
        },
      };
    } finally {
      clearTimeout(timer);
    }
  }
}
