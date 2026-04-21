import { cn } from '@/lib/utils';
import type { JobStatus, StepStatus, ServiceStatus, FailureType, RecoveryStrategy } from '@/lib/types';

const jobStatusColors: Record<JobStatus, string> = {
  PENDING:   'bg-muted/20 text-muted',
  RUNNING:   'bg-accent-soft text-accent',
  COMPLETED: 'bg-success-soft text-success',
  FAILED:    'bg-danger-soft text-danger',
  RETRYING:  'bg-warning-soft text-warning',
  CANCELLED: 'bg-muted/20 text-muted',
};

const stepStatusColors: Record<StepStatus, string> = {
  PENDING:     'bg-muted/20 text-muted',
  RUNNING:     'bg-accent-soft text-accent',
  COMPLETED:   'bg-success-soft text-success',
  FAILED:      'bg-danger-soft text-danger',
  SKIPPED:     'bg-warning-soft text-warning',
  COMPENSATED: 'bg-purple-500/20 text-purple-400',
};

const serviceColors: Record<ServiceStatus, string> = {
  HEALTHY:  'bg-success-soft text-success',
  DEGRADED: 'bg-warning-soft text-warning',
  DOWN:     'bg-danger-soft text-danger',
};

export function StatusBadge({ status }: { status: JobStatus }) {
  return <span className={cn('badge', jobStatusColors[status])}>{status}</span>;
}

export function StepBadge({ status }: { status: StepStatus }) {
  return <span className={cn('badge', stepStatusColors[status])}>{status}</span>;
}

export function ServiceBadge({ status }: { status: ServiceStatus }) {
  return <span className={cn('badge', serviceColors[status])}>{status}</span>;
}

export function FailureBadge({ type }: { type: FailureType }) {
  return <span className="badge bg-danger-soft text-danger">{type.replace(/_/g, ' ')}</span>;
}

export function StrategyBadge({ strategy, success }: { strategy: RecoveryStrategy; success?: boolean }) {
  const color = success === false ? 'bg-danger-soft text-danger' : 'bg-accent-soft text-accent';
  return <span className={cn('badge', color)}>{strategy.replace(/_/g, ' ')}</span>;
}
