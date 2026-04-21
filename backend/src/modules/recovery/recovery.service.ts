import { Injectable, Logger } from '@nestjs/common';
import {
  AuditAction,
  FailureType,
  RecoveryPolicy,
  RecoveryStrategy,
  StepType,
} from '@prisma/client';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter } from 'prom-client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { calcBackoff, simulateStepExecution } from './recovery.utils';
import { METRIC_NAMES } from '../../common/metrics/metrics.module';
import type { RecoveryHint } from '../workers/handlers/step-handler.interface';

export interface StepExecutionContext {
  jobId: string;
  tenantId: string;
  jobStepId: string;
  workflowStepId: string;
  stepType: StepType;
  stepName: string;
  attempt: number;
  policy: RecoveryPolicy | null;
  failureType: FailureType;
  error: Error;
  serviceStatuses: Record<string, string>;
}

export interface RecoveryResult {
  success: boolean;
  strategy: RecoveryStrategy;
  result?: Record<string, unknown>;
  error?: string;
  /**
   * Optional non-terminal hint that influences the next attempt of the same
   * step. Used by AI-agent strategies like SWITCH_MODEL and REDUCE_CONTEXT
   * that don't execute the step themselves.
   */
  hint?: RecoveryHint;
}

@Injectable()
export class RecoveryService {
  private readonly logger = new Logger(RecoveryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @InjectMetric(METRIC_NAMES.recoveryAttempts)
    private readonly recoveryCounter: Counter<string>,
  ) {}

  async execute(ctx: StepExecutionContext): Promise<RecoveryResult> {
    const strategy = this.selectStrategy(ctx);
    const startedAt = Date.now();

    this.logger.log(
      `Recovery: job=${ctx.jobId} step=${ctx.stepName} strategy=${strategy} attempt=${ctx.attempt}`,
    );

    await this.audit.log({
      tenantId: ctx.tenantId,
      jobId: ctx.jobId,
      action: AuditAction.RECOVERY_STARTED,
      message: `Recovery started: strategy=${strategy} for step "${ctx.stepName}"`,
      metadata: { strategy, attempt: ctx.attempt, failureType: ctx.failureType },
    });

    let result: RecoveryResult;
    try {
      result = await this.dispatch(strategy, ctx);
    } catch (err) {
      result = {
        success: false,
        strategy,
        error: err instanceof Error ? err.message : String(err),
      };
    }

    const incidentId = await this.upsertIncident(ctx);

    await this.prisma.recoveryAttempt.create({
      data: {
        incidentId,
        jobStepId: ctx.jobStepId,
        strategy,
        success: result.success,
        error: result.error,
        durationMs: Date.now() - startedAt,
        metadata: { attempt: ctx.attempt, failureType: ctx.failureType },
      },
    });

    this.recoveryCounter.inc({ strategy, success: String(result.success) });

    await this.audit.log({
      tenantId: ctx.tenantId,
      jobId: ctx.jobId,
      action: result.success ? AuditAction.RECOVERY_SUCCEEDED : AuditAction.RECOVERY_FAILED,
      message: `Recovery ${result.success ? 'succeeded' : 'failed'}: strategy=${strategy}`,
      metadata: { strategy, success: result.success, error: result.error },
    });

    return result;
  }

  // ── Strategy selection ────────────────────────────────────────────────────

  private selectStrategy(ctx: StepExecutionContext): RecoveryStrategy {
    const policy = ctx.policy;
    if (!policy) return RecoveryStrategy.ESCALATE;
    if (ctx.attempt > policy.maxRetries) {
      return policy.strategy === RecoveryStrategy.FALLBACK
        ? RecoveryStrategy.FALLBACK
        : RecoveryStrategy.ESCALATE;
    }
    return policy.strategy;
  }

  private dispatch(strategy: RecoveryStrategy, ctx: StepExecutionContext): Promise<RecoveryResult> {
    switch (strategy) {
      case RecoveryStrategy.RETRY:
      case RecoveryStrategy.RETRY_WITH_DELAY:
        return this.handleRetry(ctx, strategy);
      case RecoveryStrategy.FALLBACK:
        return this.handleFallback(ctx);
      case RecoveryStrategy.SKIP:
        return this.handleSkip(ctx);
      case RecoveryStrategy.COMPENSATE:
        return this.handleCompensate(ctx);
      case RecoveryStrategy.ESCALATE:
        return this.handleEscalate(ctx);
      case RecoveryStrategy.SWITCH_MODEL:
        return this.handleSwitchModel(ctx);
      case RecoveryStrategy.REDUCE_CONTEXT:
        return this.handleReduceContext(ctx);
      case RecoveryStrategy.PAUSE_FOR_HUMAN:
        return this.handlePauseForHuman(ctx);
      default:
        return Promise.resolve({ success: false, strategy, error: 'Unknown strategy' });
    }
  }

  // ── AI-agent recovery strategies ──────────────────────────────────────────

  /**
   * Ask the worker to retry the step with a different model. `policy.fallbackService`
   * carries the next model id (we treat it as a model name for LLM_CALL steps).
   * Returns success=false but attaches a `hint` so the outer retry loop picks it up.
   */
  private async handleSwitchModel(ctx: StepExecutionContext): Promise<RecoveryResult> {
    const nextModel = ctx.policy?.fallbackService?.trim();
    if (!nextModel) {
      return {
        success: false,
        strategy: RecoveryStrategy.SWITCH_MODEL,
        error: 'SWITCH_MODEL requires policy.fallbackService',
      };
    }
    return {
      success: false,
      strategy: RecoveryStrategy.SWITCH_MODEL,
      hint: { overrideModel: nextModel },
    };
  }

  /** Trim the prompt on the next attempt — useful for context-length errors. */
  private async handleReduceContext(ctx: StepExecutionContext): Promise<RecoveryResult> {
    void ctx;
    return {
      success: false,
      strategy: RecoveryStrategy.REDUCE_CONTEXT,
      hint: { reduceContext: true },
    };
  }

  /**
   * Phase A: audit-only. A full implementation would suspend the job and
   * expose a resume endpoint keyed by JobStep.approvalToken — that belongs
   * in a dedicated PR because it changes JobStatus semantics.
   */
  private async handlePauseForHuman(ctx: StepExecutionContext): Promise<RecoveryResult> {
    await this.audit.log({
      tenantId: ctx.tenantId,
      jobId: ctx.jobId,
      action: AuditAction.APPROVAL_REQUESTED,
      message: `Step "${ctx.stepName}" awaiting human approval`,
      metadata: { stepType: ctx.stepType, attempt: ctx.attempt },
    });
    return {
      success: false,
      strategy: RecoveryStrategy.PAUSE_FOR_HUMAN,
      error: 'Pause-for-human approval not yet implemented (Phase B)',
    };
  }

  // ── Strategy handlers ─────────────────────────────────────────────────────

  private async handleRetry(
    ctx: StepExecutionContext,
    strategy: RecoveryStrategy,
  ): Promise<RecoveryResult> {
    const policy = ctx.policy!;
    const delay =
      strategy === RecoveryStrategy.RETRY_WITH_DELAY
        ? calcBackoff(ctx.attempt, policy.retryDelayMs, policy.backoffMultiplier)
        : 0;

    if (delay > 0) {
      // Demo cap so the dashboard stays interactive.
      await new Promise((r) => setTimeout(r, Math.min(delay, 5000)));
    }

    try {
      const result = await simulateStepExecution(ctx.stepType, ctx.attempt + 1, ctx.serviceStatuses);
      return { success: true, strategy, result };
    } catch (err) {
      return {
        success: false,
        strategy,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  private async handleFallback(ctx: StepExecutionContext): Promise<RecoveryResult> {
    const fallbackService = ctx.policy?.fallbackService ?? 'backup-provider';
    await new Promise((r) => setTimeout(r, 100 + Math.random() * 200));
    const ok = Math.random() > 0.2;
    if (ok) {
      return {
        success: true,
        strategy: RecoveryStrategy.FALLBACK,
        result: { fallbackService, completedAt: new Date().toISOString() },
      };
    }
    return {
      success: false,
      strategy: RecoveryStrategy.FALLBACK,
      error: `Fallback provider ${fallbackService} also failed`,
    };
  }

  private async handleSkip(ctx: StepExecutionContext): Promise<RecoveryResult> {
    await this.prisma.jobStep.update({
      where: { id: ctx.jobStepId },
      data: { status: 'SKIPPED' },
    });
    return { success: true, strategy: RecoveryStrategy.SKIP, result: { skipped: true } };
  }

  private async handleCompensate(ctx: StepExecutionContext): Promise<RecoveryResult> {
    const previous = await this.prisma.jobStep.findMany({
      where: { jobId: ctx.jobId, status: 'COMPLETED' },
      include: { workflowStep: true },
      orderBy: { createdAt: 'asc' },
    });
    for (const step of previous) {
      await this.prisma.jobStep.update({
        where: { id: step.id },
        data: { status: 'COMPENSATED' },
      });
      await this.audit.log({
        tenantId: ctx.tenantId,
        jobId: ctx.jobId,
        action: AuditAction.STEP_COMPENSATED,
        message: `Step "${step.workflowStep.name}" compensated`,
        metadata: { stepId: step.id, stepType: step.workflowStep.type },
      });
    }
    return {
      success: true,
      strategy: RecoveryStrategy.COMPENSATE,
      result: { compensatedSteps: previous.length },
    };
  }

  private async handleEscalate(ctx: StepExecutionContext): Promise<RecoveryResult> {
    await this.prisma.incident.updateMany({
      where: { jobStepId: ctx.jobStepId, resolved: false },
      data: { escalated: true },
    });
    await this.audit.log({
      tenantId: ctx.tenantId,
      jobId: ctx.jobId,
      action: AuditAction.ESCALATED,
      message: `Step "${ctx.stepName}" escalated for manual review`,
      metadata: { failureType: ctx.failureType, error: ctx.error.message },
    });
    return {
      success: false,
      strategy: RecoveryStrategy.ESCALATE,
      error: 'Escalated for manual review',
    };
  }

  private async upsertIncident(ctx: StepExecutionContext): Promise<string> {
    const open = await this.prisma.incident.findFirst({
      where: { jobStepId: ctx.jobStepId, resolved: false },
    });
    if (open) return open.id;
    const created = await this.prisma.incident.create({
      data: {
        jobId: ctx.jobId,
        jobStepId: ctx.jobStepId,
        failureType: ctx.failureType,
        message: ctx.error.message,
        retryCount: ctx.attempt,
      },
    });
    return created.id;
  }
}
