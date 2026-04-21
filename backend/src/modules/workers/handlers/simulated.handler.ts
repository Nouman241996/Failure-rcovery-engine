import { Injectable } from '@nestjs/common';
import { StepType } from '@prisma/client';
import { simulateStepExecution } from '../../recovery/recovery.utils';
import { StepHandler, StepExecutionInput, StepResult } from './step-handler.interface';

/**
 * Adapter that maps the existing domain step types (RESERVE_INVENTORY,
 * PROCESS_PAYMENT, SEND_EMAIL, ...) onto the new `StepHandler` contract.
 *
 * Keeps existing demo behaviour unchanged — a single handler registered for
 * each legacy type delegates to the same `simulateStepExecution()` helper
 * the worker used to call directly.
 */
@Injectable()
export class SimulatedStepHandlerFactory {
  create(type: StepType): StepHandler {
    return {
      type,
      async execute(input: StepExecutionInput): Promise<StepResult> {
        const result = await simulateStepExecution(
          type,
          input.attempt,
          input.serviceStatuses,
        );
        return { result };
      },
    };
  }
}
