import { Injectable, Logger } from '@nestjs/common';
import { StepType } from '@prisma/client';
import { StepHandler } from './step-handler.interface';

/**
 * Central dispatcher that maps `StepType` → handler. Handlers are resolved
 * via constructor injection. Adding a new handler: implement `StepHandler`,
 * register it in `WorkersModule.providers`, and append it to the registry
 * entries in `WorkflowWorker`.
 */
@Injectable()
export class StepHandlerRegistry {
  private readonly logger = new Logger(StepHandlerRegistry.name);
  private readonly handlers = new Map<StepType, StepHandler>();

  register(handler: StepHandler): void {
    if (this.handlers.has(handler.type)) {
      throw new Error(`Handler for ${handler.type} already registered`);
    }
    this.handlers.set(handler.type, handler);
    this.logger.log(`Registered handler: ${handler.type}`);
  }

  resolve(type: StepType): StepHandler {
    const handler = this.handlers.get(type);
    if (!handler) {
      throw new Error(
        `No handler registered for step type "${type}". ` +
          `Known: ${[...this.handlers.keys()].join(', ') || '<none>'}`,
      );
    }
    return handler;
  }

  has(type: StepType): boolean {
    return this.handlers.has(type);
  }
}
