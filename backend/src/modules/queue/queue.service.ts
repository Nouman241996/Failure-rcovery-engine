import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { JobsOptions, Queue } from 'bullmq';
import IORedis from 'ioredis';
import { REDIS_CLIENT, QUEUE_NAMES } from './queue.constants';

export interface WorkflowJobData {
  jobId: string;
  tenantId: string;
  workflowId: string;
  payload?: Record<string, unknown>;
}

@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private readonly workflowQueue: Queue<WorkflowJobData>;
  private readonly deadLetterQueue: Queue<WorkflowJobData>;

  constructor(@Inject(REDIS_CLIENT) private readonly redis: IORedis) {
    this.workflowQueue = new Queue<WorkflowJobData>(QUEUE_NAMES.WORKFLOW, {
      connection: this.redis,
      defaultJobOptions: {
        removeOnComplete: { count: 1000 },
        removeOnFail: false,
        attempts: 1,
      },
    });

    this.deadLetterQueue = new Queue<WorkflowJobData>(QUEUE_NAMES.DEAD_LETTER, {
      connection: this.redis,
      defaultJobOptions: { removeOnComplete: false, removeOnFail: false },
    });
  }

  async onModuleDestroy() {
    await Promise.all([this.workflowQueue.close(), this.deadLetterQueue.close()]);
  }

  async enqueueWorkflow(data: WorkflowJobData, opts?: JobsOptions): Promise<string> {
    const job = await this.workflowQueue.add('execute', data, opts);
    this.logger.log(`Enqueued workflow job ${data.jobId} → bull id ${job.id}`);
    return job.id ?? data.jobId;
  }

  async moveToDeadLetter(data: WorkflowJobData): Promise<void> {
    await this.deadLetterQueue.add('dead-letter', data);
    this.logger.warn(`Moved job ${data.jobId} to dead-letter queue`);
  }

  async retryFromDeadLetter(bullJobId: string): Promise<void> {
    const job = await this.deadLetterQueue.getJob(bullJobId);
    if (!job) throw new Error(`Dead letter job ${bullJobId} not found`);
    await this.workflowQueue.add('execute', job.data);
    await job.remove();
    this.logger.log(`Retried dead-letter job ${bullJobId}`);
  }

  getDeadLetterJobs() {
    return this.deadLetterQueue.getJobs(['waiting', 'delayed', 'failed']);
  }
}
