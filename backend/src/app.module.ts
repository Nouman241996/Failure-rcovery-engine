import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import loadEnv from './common/config/env';
import { PrismaModule } from './prisma/prisma.module';
import { QueueModule } from './modules/queue/queue.module';
import { WorkflowsModule } from './modules/workflows/workflows.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { RecoveryModule } from './modules/recovery/recovery.module';
import { IncidentsModule } from './modules/incidents/incidents.module';
import { AuditModule } from './modules/audit/audit.module';
import { ServiceHealthModule } from './modules/service-health/service-health.module';
import { DeadLetterModule } from './modules/dead-letter/dead-letter.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { AuthModule } from './common/auth/auth.module';
import { MetricsModule } from './common/metrics/metrics.module';
import { HealthModule } from './common/health/health.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { HttpLoggingInterceptor } from './common/interceptors/http-logging.interceptor';
import { RequestContextMiddleware } from './common/context/request-context.middleware';
import { IdempotencyModule } from './common/idempotency/idempotency.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [loadEnv],
      cache: true,
    }),
    ThrottlerModule.forRootAsync({
      useFactory: () => [
        {
          ttl: Number(process.env.RATE_LIMIT_TTL_MS ?? 60_000),
          limit: Number(process.env.RATE_LIMIT_MAX ?? 120),
        },
      ],
    }),
    PrismaModule,
    MetricsModule,
    AuthModule,
    IdempotencyModule,
    QueueModule,
    HealthModule,
    TenantsModule,
    WorkflowsModule,
    JobsModule,
    RecoveryModule,
    IncidentsModule,
    AuditModule,
    ServiceHealthModule,
    DeadLetterModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: HttpLoggingInterceptor },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
