import { Injectable } from '@nestjs/common';
import { Prisma, Job, JobStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface ListJobsFilter {
  tenantId: string;
  status?: JobStatus;
  workflowId?: string;
  take?: number;
  skip?: number;
}

const DETAIL_INCLUDE = {
  workflow: true,
  steps: {
    include: {
      workflowStep: { include: { recoveryPolicy: true } },
      incidents: { include: { recoveryAttempts: true } },
    },
    orderBy: { createdAt: 'asc' },
  },
  incidents: { orderBy: { createdAt: 'desc' } },
  auditLogs: { orderBy: { createdAt: 'asc' } },
} satisfies Prisma.JobInclude;

const LIST_INCLUDE = {
  workflow: { select: { id: true, name: true } },
  steps: {
    include: { workflowStep: true },
    orderBy: { createdAt: 'asc' },
  },
  _count: { select: { incidents: true } },
} satisfies Prisma.JobInclude;

/**
 * Persistence boundary for jobs. Services depend on this; tests can mock it.
 * All queries are tenant-scoped — a missing tenantId is a programming bug.
 */
@Injectable()
export class JobRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Atomically create a job + its initial step rows. Returns the inserted
   * job with its `bullJobId` field still null — the caller must populate it
   * after enqueueing.
   */
  async createWithSteps(args: {
    tenantId: string;
    workflowId: string;
    payload?: Record<string, unknown>;
    callbackUrl?: string;
    workflowStepIds: string[];
  }) {
    const { tenantId, workflowId, payload, callbackUrl, workflowStepIds } = args;
    return this.prisma.job.create({
      data: {
        tenantId,
        workflowId,
        callbackUrl,
        status: JobStatus.PENDING,
        payload: (payload ?? {}) as Prisma.InputJsonValue,
        steps: {
          create: workflowStepIds.map((id) => ({
            workflowStepId: id,
            status: 'PENDING',
          })),
        },
      },
      include: { steps: true, workflow: { select: { name: true } } },
    });
  }

  attachBullJobId(jobId: string, bullJobId: string) {
    return this.prisma.job.update({
      where: { id: jobId },
      data: { bullJobId },
    });
  }

  list(filter: ListJobsFilter): Promise<Job[]> {
    return this.prisma.job.findMany({
      where: {
        tenantId: filter.tenantId,
        ...(filter.status ? { status: filter.status } : {}),
        ...(filter.workflowId ? { workflowId: filter.workflowId } : {}),
      },
      include: LIST_INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: filter.take ?? 100,
      skip: filter.skip ?? 0,
    });
  }

  findOne(tenantId: string, id: string) {
    return this.prisma.job.findFirst({
      where: { id, tenantId },
      include: DETAIL_INCLUDE,
    });
  }

  /** Internal worker lookup — bypasses tenant scoping intentionally. */
  findOneInternal(id: string) {
    return this.prisma.job.findUnique({ where: { id }, include: DETAIL_INCLUDE });
  }

  updateStatus(tenantId: string, id: string, status: JobStatus) {
    return this.prisma.job.updateMany({
      where: { id, tenantId },
      data: { status, ...(status === JobStatus.CANCELLED ? {} : {}) },
    });
  }

  countByStatus(tenantId: string) {
    return this.prisma.job.groupBy({
      by: ['status'],
      where: { tenantId },
      _count: { _all: true },
    });
  }
}
