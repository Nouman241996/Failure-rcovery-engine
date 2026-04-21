import { Global, Module } from '@nestjs/common';
import {
  PrometheusModule,
  makeCounterProvider,
  makeHistogramProvider,
  makeGaugeProvider,
} from '@willsoto/nestjs-prometheus';

export const METRIC_NAMES = {
  jobsCreated: 'fre_jobs_created_total',
  jobsCompleted: 'fre_jobs_completed_total',
  jobsFailed: 'fre_jobs_failed_total',
  recoveryAttempts: 'fre_recovery_attempts_total',
  webhookDeliveries: 'fre_webhook_deliveries_total',
  jobDuration: 'fre_job_duration_seconds',
  inFlightJobs: 'fre_inflight_jobs',
} as const;

const metricProviders = [
  makeCounterProvider({
    name: METRIC_NAMES.jobsCreated,
    help: 'Total jobs created',
    labelNames: ['tenant', 'workflow'],
  }),
  makeCounterProvider({
    name: METRIC_NAMES.jobsCompleted,
    help: 'Total jobs completed successfully',
    labelNames: ['tenant', 'workflow'],
  }),
  makeCounterProvider({
    name: METRIC_NAMES.jobsFailed,
    help: 'Total jobs failed (after recovery exhausted)',
    labelNames: ['tenant', 'workflow'],
  }),
  makeCounterProvider({
    name: METRIC_NAMES.recoveryAttempts,
    help: 'Total recovery attempts',
    labelNames: ['strategy', 'success'],
  }),
  makeCounterProvider({
    name: METRIC_NAMES.webhookDeliveries,
    help: 'Total webhook delivery attempts',
    labelNames: ['status'],
  }),
  makeHistogramProvider({
    name: METRIC_NAMES.jobDuration,
    help: 'Job execution duration (seconds)',
    labelNames: ['tenant', 'workflow', 'status'],
    buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60, 300],
  }),
  makeGaugeProvider({
    name: METRIC_NAMES.inFlightJobs,
    help: 'Currently executing jobs',
  }),
];

@Global()
@Module({
  imports: [
    PrometheusModule.register({
      defaultMetrics: { enabled: true, config: {} },
    }),
  ],
  providers: metricProviders,
  exports: [PrometheusModule, ...metricProviders],
})
export class MetricsModule {}
