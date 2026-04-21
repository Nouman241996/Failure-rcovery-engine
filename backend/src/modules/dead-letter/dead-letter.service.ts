import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AuditAction, JobStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class DeadLetterService {
  private readonly logger = new Logger(DeadLetterService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
    private readonly audit: AuditService,
  ) {}

  async list(tenantId: string) {
    const bullJobs = await this.queue.getDeadLetterJobs();
    const enriched = await Promise.all(
      bullJobs
        .filter((bj) => !bj.data.tenantId || bj.data.tenantId === tenantId)
        .map(async (bj) => {
          const dbJob = await this.prisma.job.findFirst({
            where: { id: bj.data.jobId, tenantId },
            include: {
              workflow: { select: { name: true } },
              _count: { select: { incidents: true } },
            },
          });
          return { bullJobId: bj.id, data: bj.data, dbJob };
        }),
    );
    return enriched.filter((e) => e.dbJob !== null);
  }

  async retry(tenantId: string, bullJobId: string) {
    const bullJobs = await this.queue.getDeadLetterJobs();
    const target = bullJobs.find((bj) => bj.id === bullJobId);
    if (!target) throw new NotFoundException(`Dead-letter job ${bullJobId} not found`);
    if (target.data.tenantId && target.data.tenantId !== tenantId) {
      throw new NotFoundException(`Dead-letter job ${bullJobId} not found`);
    }

    await this.queue.retryFromDeadLetter(bullJobId);
    await this.prisma.job.updateMany({
      where: { id: target.data.jobId, tenantId },
      data: { status: JobStatus.PENDING },
    });
    await this.audit.log({
      tenantId,
      jobId: target.data.jobId,
      action: AuditAction.MANUAL_RETRY,
      message: 'Job manually retried from dead-letter queue',
    });
    return { message: 'Job re-queued for processing' };
  }
}
