import { StepType } from '@prisma/client';

/**
 * Hint passed from the recovery layer into the next attempt. Allows AI-specific
 * strategies like SWITCH_MODEL to influence how the handler re-runs the step
 * without leaking recovery details into the handler's config.
 */
export interface RecoveryHint {
  overrideModel?: string;
  reduceContext?: boolean;
  modelsTried?: string[];
}

export interface StepExecutionInput {
  tenantId: string;
  jobId: string;
  stepId: string;
  stepType: StepType;
  stepName: string;
  attempt: number;

  /** Per-step configuration authored on WorkflowStep.config. */
  config: Record<string, unknown>;

  /** Job-level payload (caller-supplied on POST /v1/jobs). */
  payload: Record<string, unknown>;

  /** Shared simulated-service health map. */
  serviceStatuses: Record<string, string>;

  recoveryHint?: RecoveryHint;
}

/**
 * Per-step telemetry persisted to JobStep by the worker. Handlers populate
 * what applies to them — LLM_CALL tends to return all fields, SEND_EMAIL none.
 */
export interface StepTelemetry {
  model?: string;
  promptTokens?: number;
  completionTokens?: number;
  costUsd?: number;
}

export interface StepResult {
  /** The result payload stored as JSON on JobStep.result. */
  result?: Record<string, unknown>;
  telemetry?: StepTelemetry;
}

/**
 * A single unit of execution. Success = resolve; failure = throw.
 * Handlers must be stateless — the worker manages retries, the recovery
 * service applies strategies.
 */
export interface StepHandler {
  readonly type: StepType;
  execute(input: StepExecutionInput): Promise<StepResult>;
}

export const STEP_HANDLER = Symbol('STEP_HANDLER');
