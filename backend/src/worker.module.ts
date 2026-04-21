import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import loadEnv from './common/config/env';
import { PrismaModule } from './prisma/prisma.module';
import { MetricsModule } from './common/metrics/metrics.module';
import { QueueModule } from './modules/queue/queue.module';
import { AuditModule } from './modules/audit/audit.module';
import { RecoveryModule } from './modules/recovery/recovery.module';
import { ServiceHealthModule } from './modules/service-health/service-health.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { WorkersModule } from './modules/workers/workers.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [loadEnv], cache: true }),
    PrismaModule,
    MetricsModule,
    QueueModule,
    AuditModule,
    RecoveryModule,
    ServiceHealthModule,
    WebhooksModule,
    WorkersModule,
  ],
})
export class WorkerModule {}
