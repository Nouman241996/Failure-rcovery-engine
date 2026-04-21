import { FailureType, StepType } from '@prisma/client';

/**
 * Pure helpers used by the recovery engine. Side-effect free so they're easy
 * to unit-test.
 */

export function classifyFailure(error: Error): FailureType {
  const msg = error.message.toLowerCase();
  const name = error.name.toLowerCase();

  if (msg.includes('timeout') || msg.includes('timed out') || name.includes('timeout')) {
    return FailureType.TIMEOUT;
  }
  if (
    msg.includes('network') ||
    msg.includes('econnrefused') ||
    msg.includes('enotfound') ||
    msg.includes('socket')
  ) {
    return FailureType.NETWORK_ERROR;
  }
  if (
    msg.includes('service') ||
    msg.includes('unavailable') ||
    msg.includes('503') ||
    msg.includes('502')
  ) {
    return FailureType.EXTERNAL_SERVICE_FAILURE;
  }
  if (msg.includes('validation') || msg.includes('invalid') || msg.includes('required')) {
    return FailureType.VALIDATION_ERROR;
  }
  return FailureType.UNKNOWN;
}

export function calcBackoff(
  attempt: number,
  baseDelayMs: number,
  multiplier: number,
  maxMs = 60_000,
): number {
  const delay = baseDelayMs * Math.pow(multiplier, attempt - 1);
  // Symmetric ±10% jitter.
  const jitter = delay * 0.1 * (Math.random() * 2 - 1);
  return Math.round(Math.min(delay + jitter, maxMs));
}

/**
 * Simulated step executor. Replace with real service clients in production:
 *   src/modules/workers/handlers/<step-type>.handler.ts
 */
export async function simulateStepExecution(
  stepType: StepType,
  attempt: number,
  serviceStatuses: Record<string, string>,
  context?: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  await new Promise((resolve) => setTimeout(resolve, 50 + Math.random() * 100));

  const service = getServiceForStep(stepType);
  const serviceStatus = serviceStatuses[service] ?? 'HEALTHY';

  if (serviceStatus === 'DOWN') {
    const err = new Error(`${service} service is unavailable`);
    err.name = 'ExternalServiceError';
    throw err;
  }

  const failureRates: Partial<Record<StepType, number>> = {
    RESERVE_INVENTORY: attempt === 1 ? 0.3 : 0.1,
    PROCESS_PAYMENT: attempt === 1 ? 0.5 : 0.2,
    SEND_EMAIL: attempt === 1 ? 0.4 : 0.15,
    GENERATE_INVOICE: attempt === 1 ? 0.2 : 0.05,
    SYNC_CRM: attempt === 1 ? 0.25 : 0.1,
    NOTIFY_WEBHOOK: attempt === 1 ? 0.3 : 0.1,
    CUSTOM: 0.1,
  };

  const baseRate = failureRates[stepType] ?? 0.1;
  const rate =
    serviceStatus === 'DEGRADED'
      ? Math.min(baseRate * 2, 0.9)
      : baseRate;

  if (Math.random() < rate) {
    const errorTypes = getErrorTypesForStep(stepType);
    const errorMsg = errorTypes[Math.floor(Math.random() * errorTypes.length)];
    const err = new Error(errorMsg);
    err.name = getErrorNameForMsg(errorMsg);
    throw err;
  }

  return { success: true, stepType, completedAt: new Date().toISOString(), context };
}

function getServiceForStep(stepType: StepType): string {
  return (
    {
      RESERVE_INVENTORY: 'inventory',
      PROCESS_PAYMENT: 'payment',
      SEND_EMAIL: 'email',
      GENERATE_INVOICE: 'invoice',
      SYNC_CRM: 'crm',
      NOTIFY_WEBHOOK: 'webhook',
      CUSTOM: 'custom',
      LLM_CALL: 'llm',
      TOOL_INVOKE: 'tool',
      HUMAN_APPROVAL: 'approval',
      EMBED: 'embed',
      VECTOR_SEARCH: 'vector',
    } as Record<StepType, string>
  )[stepType];
}

function getErrorTypesForStep(stepType: StepType): string[] {
  const errMap: Partial<Record<StepType, string[]>> = {
    PROCESS_PAYMENT: [
      'Payment gateway timeout',
      'Payment provider network error',
      'Payment service unavailable',
    ],
    SEND_EMAIL: [
      'Email service timeout',
      'SMTP network error',
      'Email service unavailable',
    ],
    RESERVE_INVENTORY: [
      'Inventory service timeout',
      'Stock validation failed: insufficient quantity',
      'Inventory network error',
    ],
    GENERATE_INVOICE: [
      'Invoice service timeout',
      'Invoice generation failed: invalid data',
    ],
    SYNC_CRM: ['CRM service unavailable', 'CRM network error'],
    NOTIFY_WEBHOOK: ['Webhook endpoint timeout', 'Webhook network error'],
    CUSTOM: ['Custom step failed'],
  };
  return errMap[stepType] ?? ['Unknown error'];
}

function getErrorNameForMsg(msg: string): string {
  if (msg.includes('timeout')) return 'TimeoutError';
  if (msg.includes('network') || msg.includes('SMTP')) return 'NetworkError';
  if (msg.includes('unavailable')) return 'ExternalServiceError';
  if (msg.includes('validation') || msg.includes('invalid') || msg.includes('insufficient')) {
    return 'ValidationError';
  }
  return 'Error';
}
