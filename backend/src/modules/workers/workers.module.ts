import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServiceHealthModule } from '../service-health/service-health.module';
import { AuditModule } from '../audit/audit.module';
import { RecoveryModule } from '../recovery/recovery.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { WorkflowWorker } from './workflow-worker.service';

@Module({
  imports: [ConfigModule, ServiceHealthModule, AuditModule, RecoveryModule, WebhooksModule],
  providers: [WorkflowWorker],
  exports: [WorkflowWorker],
})
export class WorkersModule {}
