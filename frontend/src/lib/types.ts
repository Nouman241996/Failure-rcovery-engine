export type JobStatus =
  | 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'RETRYING' | 'CANCELLED';

export type StepStatus =
  | 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'SKIPPED' | 'COMPENSATED';

export type StepType =
  | 'RESERVE_INVENTORY' | 'PROCESS_PAYMENT' | 'SEND_EMAIL'
  | 'GENERATE_INVOICE' | 'SYNC_CRM' | 'NOTIFY_WEBHOOK' | 'CUSTOM';

export type FailureType =
  | 'TIMEOUT' | 'NETWORK_ERROR' | 'EXTERNAL_SERVICE_FAILURE'
  | 'VALIDATION_ERROR' | 'UNKNOWN';

export type RecoveryStrategy =
  | 'RETRY' | 'RETRY_WITH_DELAY' | 'FALLBACK' | 'SKIP'
  | 'COMPENSATE' | 'ESCALATE' | 'DEAD_LETTER';

export type ServiceStatus = 'HEALTHY' | 'DEGRADED' | 'DOWN';

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  steps: WorkflowStep[];
  createdAt: string;
}

export interface WorkflowStep {
  id: string;
  name: string;
  type: StepType;
  order: number;
  isCritical: boolean;
  recoveryPolicy?: RecoveryPolicy | null;
}

export interface RecoveryPolicy {
  id: string;
  strategy: RecoveryStrategy;
  maxRetries: number;
  retryDelayMs: number;
  backoffMultiplier: number;
  fallbackService?: string | null;
  timeoutMs: number;
}

export interface Job {
  id: string;
  workflowId: string;
  workflow?: { id: string; name: string };
  status: JobStatus;
  payload?: Record<string, unknown>;
  steps: JobStep[];
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  _count?: { incidents: number };
}

export interface JobStep {
  id: string;
  status: StepStatus;
  attempts: number;
  error?: string;
  failureType?: FailureType;
  result?: Record<string, unknown>;
  startedAt?: string;
  completedAt?: string;
  workflowStep: WorkflowStep;
  incidents?: Incident[];
}

export interface Incident {
  id: string;
  jobId: string;
  failureType: FailureType;
  message: string;
  resolved: boolean;
  escalated: boolean;
  retryCount: number;
  recoveryAttempts: RecoveryAttempt[];
  job?: { id: string; status: JobStatus; workflow?: { name: string } };
  jobStep?: { workflowStep?: { name: string; type: StepType } };
  createdAt: string;
}

export interface RecoveryAttempt {
  id: string;
  strategy: RecoveryStrategy;
  success: boolean;
  error?: string;
  durationMs?: number;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  jobId?: string;
  action: string;
  message: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface ServiceHealth {
  id: string;
  name: string;
  status: ServiceStatus;
  updatedAt: string;
}

export interface DeadLetterEntry {
  bullJobId: string;
  data: { jobId: string; workflowId: string };
  dbJob?: Job & { workflow?: { name: string } } | null;
}

export interface JobStats {
  total: number;
  failed: number;
  completed: number;
  retrying: number;
  running: number;
  pending: number;
  successRate: number;
}
