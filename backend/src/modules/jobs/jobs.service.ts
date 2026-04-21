import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction, JobStatus } from '@prisma/client';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter } from 'prom-client';
import { PrismaService } from '../../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import { AuditService } from '../audit/audit.service';
import { JobRepository } from './job.repository';
import { CreateJobDto } from './dto/jobs.dto';
import { METRIC_NAMES } from '../../common/metrics/metrics.module';

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly repo: JobRepository,
    private readonly queue: QueueService,
    private readonly audit: AuditService,
    @InjectMetric(METRIC_NAMES.jobsCreated)
    private readonly jobsCreatedCounter: Counter<string>,
  ) {}

  async create(tenantId: string, dto: CreateJobDto) {
    // 1. Verify the workflow belongs to the tenant.
    const workflow = await this.prisma.workflow.findFirst({
      where: { id: dto.workflowId, tenantId },
      include: { steps: { orderBy: { order: 'asc' }, select: { id: true } } },
    });
    if (!workflow) {
      throw new NotFoundException(`Workflow ${dto.workflowId} not found`);
    }
    if (workflow.steps.length === 0) {
      throw new ConflictException('Workflow has no steps configured');
    }

    // 2. Create job + JobSteps inside a single transaction so we never end up
    //    with a half-created job if the queue insert later fails.
    const job = await this.repo.createWithSteps({
      tenantId,
      workflowId: dto.workflowId,
      payload: dto.payload,
      callbackUrl: dto.callbackUrl,
      workflowStepIds: workflow.steps.map((s) => s.id),
    });

    await this.audit.log({
      tenantId,
      jobId: job.id,
      action: AuditAction.JOB_CREATED,
      message: `Job created for workflow "${job.workflow.name}"`,
      metadata: { workflowId: dto.workflowId, hasCallback: Boolean(dto.callbackUrl) },
    });

    // 3. Enqueue. If this fails the job will sit in PENDING — the operator
    //    can re-enqueue manually. We do not roll back the job row because
    //    callers depend on its id for idempotency.
    try {
      const bullJobId = await this.queue.enqueueWorkflow({
        jobId: job.id,
        tenantId,
        workflowId: dto.workflowId,
        payload: dto.payload,
      });
      await this.repo.attachBullJobId(job.id, bullJobId);
    } catch (err) {
      this.logger.error(
        { err, jobId: job.id },
        'Failed to enqueue job; job left in PENDING for manual retry',
      );
    }

    this.jobsCreatedCounter.inc({ tenant: tenantId, workflow: dto.workflowId });

    return job;
  }

  list(tenantId: string, status?: JobStatus, workflowId?: string) {
    return this.repo.list({ tenantId, status, workflowId });
  }

  async findOne(tenantId: string, id: string) {
    const job = await this.repo.findOne(tenantId, id);
    if (!job) throw new NotFoundException(`Job ${id} not found`);
    return job;
  }

  async cancel(tenantId: string, id: string) {
    const job = await this.findOne(tenantId, id);
    if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(job.status)) {
      throw new ConflictException(`Cannot cancel job in status ${job.status}`);
    }
    await this.repo.updateStatus(tenantId, id, JobStatus.CANCELLED);
    await this.audit.log({
      tenantId,
      jobId: id,
      action: AuditAction.JOB_CANCELLED,
      message: 'Job cancelled by user',
    });
    return { ...job, status: JobStatus.CANCELLED };
  }

  async stats(tenantId: string) {
    const grouped = await this.repo.countByStatus(tenantId);
    const counts: Record<JobStatus, number> = {
      PENDING: 0,
      RUNNING: 0,
      RETRYING: 0,
      COMPLETED: 0,
      FAILED: 0,
      CANCELLED: 0,
    };
    for (const row of grouped) counts[row.status] = row._count._all;
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    const successRate = total > 0 ? Math.round((counts.COMPLETED / total) * 100) : 0;
    return { ...counts, total, successRate };
  }
}
