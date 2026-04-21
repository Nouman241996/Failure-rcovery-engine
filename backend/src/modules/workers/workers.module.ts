import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { StepType } from '@prisma/client';
import { ServiceHealthModule } from '../service-health/service-health.module';
import { AuditModule } from '../audit/audit.module';
import { RecoveryModule } from '../recovery/recovery.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { WorkflowWorker } from './workflow-worker.service';
import {
  LlmCallHandler,
  SimulatedStepHandlerFactory,
  StepHandlerRegistry,
  ToolInvokeHandler,
} from './handlers';

/**
 * Wires every step handler into the shared `StepHandlerRegistry` on boot.
 * Native handlers (LLM_CALL, TOOL_INVOKE) are injected directly. Legacy
 * domain types are adapted through `SimulatedStepHandlerFactory` so demo
 * behaviour is preserved without bespoke handler classes.
 */
const LEGACY_STEP_TYPES: StepType[] = [
  StepType.RESERVE_INVENTORY,
  StepType.PROCESS_PAYMENT,
  StepType.SEND_EMAIL,
  StepType.GENERATE_INVOICE,
  StepType.SYNC_CRM,
  StepType.NOTIFY_WEBHOOK,
  StepType.CUSTOM,
];

@Module({
  imports: [ConfigModule, ServiceHealthModule, AuditModule, RecoveryModule, WebhooksModule],
  providers: [
    StepHandlerRegistry,
    SimulatedStepHandlerFactory,
    LlmCallHandler,
    ToolInvokeHandler,
    WorkflowWorker,
  ],
  exports: [WorkflowWorker],
})
export class WorkersModule implements OnModuleInit {
  constructor(
    private readonly registry: StepHandlerRegistry,
    private readonly simulated: SimulatedStepHandlerFactory,
    private readonly llm: LlmCallHandler,
    private readonly tool: ToolInvokeHandler,
  ) {}

  onModuleInit(): void {
    this.registry.register(this.llm);
    this.registry.register(this.tool);
    for (const type of LEGACY_STEP_TYPES) {
      this.registry.register(this.simulated.create(type));
    }
  }
}
