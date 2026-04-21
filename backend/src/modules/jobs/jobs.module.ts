import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuditModule } from '../audit/audit.module';
import { IdempotencyModule } from '../../common/idempotency/idempotency.module';
import { JobRepository } from './job.repository';
import { JobsService } from './jobs.service';
import { JobsController } from './jobs.controller';

@Module({
  imports: [AuditModule, IdempotencyModule, ConfigModule],
  controllers: [JobsController],
  providers: [JobsService, JobRepository],
  exports: [JobsService, JobRepository],
})
export class JobsModule {}
