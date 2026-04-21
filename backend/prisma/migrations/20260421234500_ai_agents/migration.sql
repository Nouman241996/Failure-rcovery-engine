-- AlterEnum — new audit actions for AI-agent events
ALTER TYPE "AuditAction" ADD VALUE 'APPROVAL_REQUESTED';
ALTER TYPE "AuditAction" ADD VALUE 'APPROVAL_GRANTED';
ALTER TYPE "AuditAction" ADD VALUE 'APPROVAL_DENIED';
ALTER TYPE "AuditAction" ADD VALUE 'MODEL_SWITCHED';
ALTER TYPE "AuditAction" ADD VALUE 'CONTEXT_REDUCED';

-- AlterEnum — new recovery strategies
ALTER TYPE "RecoveryStrategy" ADD VALUE 'SWITCH_MODEL';
ALTER TYPE "RecoveryStrategy" ADD VALUE 'REDUCE_CONTEXT';
ALTER TYPE "RecoveryStrategy" ADD VALUE 'PAUSE_FOR_HUMAN';

-- AlterEnum — new step status
ALTER TYPE "StepStatus" ADD VALUE 'WAITING_APPROVAL';

-- AlterEnum — AI primitive step types
ALTER TYPE "StepType" ADD VALUE 'LLM_CALL';
ALTER TYPE "StepType" ADD VALUE 'TOOL_INVOKE';
ALTER TYPE "StepType" ADD VALUE 'HUMAN_APPROVAL';
ALTER TYPE "StepType" ADD VALUE 'EMBED';
ALTER TYPE "StepType" ADD VALUE 'VECTOR_SEARCH';

-- AlterTable — per-step telemetry + approval coordination
ALTER TABLE "job_steps"
  ADD COLUMN "approvalToken"    TEXT,
  ADD COLUMN "approvedAt"       TIMESTAMP(3),
  ADD COLUMN "approvedBy"       TEXT,
  ADD COLUMN "completionTokens" INTEGER,
  ADD COLUMN "costUsd"          DECIMAL(12,6),
  ADD COLUMN "model"            TEXT,
  ADD COLUMN "promptTokens"     INTEGER;

-- CreateIndex — token lookup for POST /v1/approvals/:token
CREATE UNIQUE INDEX "job_steps_approvalToken_key" ON "job_steps"("approvalToken");
