import {
  Inject,
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AuditAction,
  Job as JobModel,
  JobStatus,
  StepStatus,
} from '@prisma/client';
import { Job as BullJob, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter, Gauge, Histogram } from 'prom-client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { RecoveryService } from '../recovery/recovery.service';
import { QueueService, WorkflowJobData } from '../queue/queue.service';
import { ServiceHealthService } from '../service-health/service-health.service';
import { WebhookService, WebhookEvent } from '../webhooks/webhook.service';
import { REDIS_CLIENT, QUEUE_NAMES } from '../queue/queue.constants';
import { classifyFailure, simulateStepExecution } from '../recovery/recovery.utils';
import { METRIC_NAMES } from '../../common/metrics/metrics.module';
import type { AppEnv } from '../../common/config/env';

/**
 * BullMQ-backed worker that drives a `Job` through its `WorkflowStep`s.
 *
 * Flow per job:
 *   1. Mark `RUNNING`, emit `JOB_STARTED`.
 *   2. For each step (ordered by creation): run handler → on failure ask
 *      `RecoveryService` to apply the configured strategy → loop until the
 *      step succeeds, is skipped, or exhausts retries.
 *   3. If a critical step exhausts recovery, mark `FAILED`, dead-letter the
 *      job and stop. Otherwise mark `COMPLETED`.
 *   4. Dispatch a webhook on terminal status (best-effort, isolated).
 *
 * The worker is cooperative: it polls `Job.status` between steps to honour
 * cancellation requests issued via the API.
 */
@Injectable()
export class WorkflowWorker implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(WorkflowWorker.name);
  private worker: Worker<WorkflowJobData> | null = null;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: IORedis,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly recovery: RecoveryService,
    private readonly queue: QueueService,
    private readonly serviceHealth: ServiceHealthService,
    private readonly webhooks: WebhookService,
    private readonly config: ConfigService<AppEnv, true>,
    @InjectMetric(METRIC_NAMES.jobsCompleted) private readonly completedCounter: Counter<string>,
    @InjectMetric(METRIC_NAMES.jobsFailed) private readonly failedCounter: Counter<string>,
    @InjectMetric(METRIC_NAMES.jobDuration) private readonly durationHist: Histogram<string>,
    @InjectMetric(METRIC_NAMES.inFlightJobs) private readonly inFlightGauge: Gauge<string>,
  ) {}

  onModuleInit() {
    const configured = this.config.get('WORKER_CONCURRENCY', { infer: true });
    const concurrency = Number(configured) > 0 ? Number(configured) : 5;
    this.worker = new Worker<WorkflowJobData>(
      QUEUE_NAMES.WORKFLOW,
      (bullJob) => this.processJob(bullJob),
      { connection: this.redis, concurrency },
    );

    this.worker.on('completed', (job) => this.logger.log(`Bull job ${job.id} completed`));
    this.worker.on('failed', (job, err) =>
      this.logger.error(`Bull job ${job?.id} failed: ${err.message}`),
    );

    this.logger.log(`Workflow worker started (concurrency=${concurrency})`);
  }

  async onApplicationShutdown(signal?: string) {
    this.logger.log(`Shutting down worker (signal=${signal ?? 'unknown'})…`);
    await this.worker?.close();
  }

  // ── Core processing ───────────────────────────────────────────────────────

  private async processJob(bullJob: BullJob<WorkflowJobData>): Promise<void> {
    const { jobId } = bullJob.data;
    const startedAt = Date.now();
    this.inFlightGauge.inc();

    try {
      const job = await this.loadJob(jobId);
      if (!job) {
        this.logger.warn(`Job ${jobId} not found — skipping`);
        return;
      }
      if (job.status === JobStatus.CANCELLED) {
        this.logger.warn(`Job ${jobId} cancelled before start — skipping`);
        return;
      }

      await this.markStarted(job);
      const serviceStatuses = await this.serviceHealth.asMap();
      const failed = await this.runSteps(job, serviceStatuses);
      const finalStatus = await this.finalize(job, failed);

      this.recordJobMetrics(job, finalStatus, Date.now() - startedAt);
      await this.notifyTerminalStatus(jobId, finalStatus);
    } finally {
      this.inFlightGauge.dec();
    }
  }

  private async runSteps(
    job: Awaited<ReturnType<WorkflowWorker['loadJob']>> & object,
    serviceStatuses: Record<string, string>,
  ): Promise<boolean> {
    let jobFailed = false;

    for (const step of job.steps) {
      // Cooperative cancellation check.
      const status = await this.currentStatus(job.id);
      if (status === JobStatus.CANCELLED) return false;

      const wfStep = step.workflowStep;
      const policy = wfStep.recoveryPolicy;

      await this.markStepRunning(step.id);
      await this.audit.log({
        tenantId: job.tenantId,
        jobId: job.id,
        action: AuditAction.STEP_STARTED,
        message: `Step "${wfStep.name}" started`,
        metadata: { stepType: wfStep.type, order: wfStep.order },
      });

      const maxAttempts = policy ? policy.maxRetries + 1 : 1;
      const success = await this.executeStepWithRecovery({
        job,
        step,
        wfStep,
        policy,
        maxAttempts,
        serviceStatuses,
      });

      if (success) continue;

      // Step exhausted.
      if (wfStep.isCritical) {
        jobFailed = true;
        await this.prisma.job.update({
          where: { id: job.id },
          data: { status: JobStatus.FAILED, completedAt: new Date() },
        });
        await this.audit.log({
          tenantId: job.tenantId,
          jobId: job.id,
          action: AuditAction.JOB_FAILED,
          message: `Job failed: critical step "${wfStep.name}" could not be recovered`,
        });
        await this.queue.moveToDeadLetter({
          jobId: job.id,
          tenantId: job.tenantId,
          workflowId: job.workflowId,
          payload: (job.payload ?? undefined) as Record<string, unknown> | undefined,
        });
        await this.audit.log({
          tenantId: job.tenantId,
          jobId: job.id,
          action: AuditAction.DEAD_LETTERED,
          message: `Job moved to dead-letter queue after step "${wfStep.name}" failed`,
        });
        break;
      }

      await this.prisma.jobStep.update({
        where: { id: step.id },
        data: { status: StepStatus.SKIPPED },
      });
      await this.audit.log({
        tenantId: job.tenantId,
        jobId: job.id,
        action: AuditAction.STEP_SKIPPED,
        message: `Non-critical step "${wfStep.name}" skipped after exhausting retries`,
      });
    }

    return jobFailed;
  }

  private async executeStepWithRecovery(args: {
    job: { id: string; tenantId: string };
    step: { id: string };
    wfStep: { id: string; name: string; type: import('@prisma/client').StepType };
    policy: import('@prisma/client').RecoveryPolicy | null;
    maxAttempts: number;
    serviceStatuses: Record<string, string>;
  }): Promise<boolean> {
    const { job, step, wfStep, policy, maxAttempts, serviceStatuses } = args;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const result = await simulateStepExecution(wfStep.type, attempt, serviceStatuses);
        await this.prisma.jobStep.update({
          where: { id: step.id },
          data: {
            status: StepStatus.COMPLETED,
            result: result as object,
            completedAt: new Date(),
            attempts: attempt,
          },
        });
        await this.audit.log({
          tenantId: job.tenantId,
          jobId: job.id,
          action: AuditAction.STEP_COMPLETED,
          message: `Step "${wfStep.name}" completed (attempt ${attempt})`,
          metadata: { stepType: wfStep.type, attempt },
        });
        return true;
      } catch (rawErr) {
        const err = rawErr instanceof Error ? rawErr : new Error(String(rawErr));
        const failureType = classifyFailure(err);

        await this.audit.log({
          tenantId: job.tenantId,
          jobId: job.id,
          action: AuditAction.FAILURE_DETECTED,
          message: `Step "${wfStep.name}" failed: ${err.message}`,
          metadata: { stepType: wfStep.type, failureType, attempt, error: err.message },
        });
        await this.prisma.jobStep.update({
          where: { id: step.id },
          data: {
            status: StepStatus.FAILED,
            error: err.message,
            failureType,
            attempts: attempt,
          },
        });
        if (attempt < maxAttempts) {
          await this.prisma.job.update({
            where: { id: job.id },
            data: { status: JobStatus.RETRYING },
          });
        }

        const recovery = await this.recovery.execute({
          jobId: job.id,
          tenantId: job.tenantId,
          jobStepId: step.id,
          workflowStepId: wfStep.id,
          stepType: wfStep.type,
          stepName: wfStep.name,
          attempt,
          policy,
          failureType,
          error: err,
          serviceStatuses,
        });

        if (recovery.success) {
          const finalStatus =
            recovery.strategy === 'SKIP' ? StepStatus.SKIPPED : StepStatus.COMPLETED;
          await this.prisma.jobStep.update({
            where: { id: step.id },
            data: {
              status: finalStatus,
              result: (recovery.result ?? {}) as object,
              completedAt: new Date(),
            },
          });
          return true;
        }
      }
    }

    return false;
  }

  // ── Lifecycle helpers ─────────────────────────────────────────────────────

  private async loadJob(jobId: string) {
    return this.prisma.job.findUnique({
      where: { id: jobId },
      include: {
        workflow: true,
        steps: {
          include: { workflowStep: { include: { recoveryPolicy: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }

  private async markStarted(job: JobModel & { workflow: { name: string } }) {
    await this.prisma.job.update({
      where: { id: job.id },
      data: { status: JobStatus.RUNNING, startedAt: new Date() },
    });
    await this.audit.log({
      tenantId: job.tenantId,
      jobId: job.id,
      action: AuditAction.JOB_STARTED,
      message: `Job started: workflow="${job.workflow.name}"`,
    });
  }

  private async markStepRunning(stepId: string) {
    await this.prisma.jobStep.update({
      where: { id: stepId },
      data: { status: StepStatus.RUNNING, startedAt: new Date(), attempts: 1 },
    });
  }

  private async currentStatus(jobId: string): Promise<JobStatus | undefined> {
    const row = await this.prisma.job.findUnique({
      where: { id: jobId },
      select: { status: true },
    });
    return row?.status;
  }

  private async finalize(
    job: { id: string; tenantId: string },
    jobFailed: boolean,
  ): Promise<JobStatus> {
    if (jobFailed) return JobStatus.FAILED;
    await this.prisma.job.update({
      where: { id: job.id },
      data: { status: JobStatus.COMPLETED, completedAt: new Date() },
    });
    await this.audit.log({
      tenantId: job.tenantId,
      jobId: job.id,
      action: AuditAction.JOB_COMPLETED,
      message: 'Job completed successfully',
    });
    return JobStatus.COMPLETED;
  }

  private async notifyTerminalStatus(jobId: string, status: JobStatus) {
    const job = await this.prisma.job.findUnique({ where: { id: jobId } });
    if (!job) return;
    const event: WebhookEvent | null =
      status === JobStatus.COMPLETED
        ? 'job.completed'
        : status === JobStatus.FAILED
          ? 'job.failed'
          : status === JobStatus.CANCELLED
            ? 'job.cancelled'
            : null;
    if (!event) return;
    try {
      await this.webhooks.dispatch(job, event);
    } catch (err) {
      this.logger.warn(
        `Webhook dispatch swallowed for job=${jobId}: ${(err as Error).message}`,
      );
    }
  }

  private recordJobMetrics(
    job: { tenantId: string; workflowId: string },
    status: JobStatus,
    durationMs: number,
  ) {
    const labels = { tenant: job.tenantId, workflow: job.workflowId };
    if (status === JobStatus.COMPLETED) this.completedCounter.inc(labels);
    if (status === JobStatus.FAILED) this.failedCounter.inc(labels);
    this.durationHist.observe({ ...labels, status }, durationMs / 1000);
  }
}
