import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Workflow } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateWorkflowDto } from './dto/workflows.dto';

const WORKFLOW_INCLUDE = {
  steps: {
    include: { recoveryPolicy: true },
    orderBy: { order: 'asc' },
  },
} satisfies Prisma.WorkflowInclude;

@Injectable()
export class WorkflowsService {
  constructor(private readonly prisma: PrismaService) {}

  create(tenantId: string, dto: CreateWorkflowDto) {
    // Order uniqueness inside the workflow is enforced by the schema.
    return this.prisma.workflow.create({
      data: {
        tenantId,
        name: dto.name,
        description: dto.description,
        steps: {
          create: dto.steps.map((step) => ({
            name: step.name,
            type: step.type,
            order: step.order,
            isCritical: step.isCritical ?? true,
            config: (step.config ?? {}) as Prisma.InputJsonValue,
            recoveryPolicy: step.recoveryPolicy
              ? { create: step.recoveryPolicy }
              : undefined,
          })),
        },
      },
      include: WORKFLOW_INCLUDE,
    });
  }

  list(tenantId: string): Promise<Workflow[]> {
    return this.prisma.workflow.findMany({
      where: { tenantId },
      include: WORKFLOW_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const wf = await this.prisma.workflow.findFirst({
      where: { id, tenantId },
      include: WORKFLOW_INCLUDE,
    });
    if (!wf) throw new NotFoundException(`Workflow ${id} not found`);
    return wf;
  }

  async remove(tenantId: string, id: string) {
    const result = await this.prisma.workflow.deleteMany({
      where: { id, tenantId },
    });
    if (result.count === 0) {
      throw new NotFoundException(`Workflow ${id} not found`);
    }
  }
}
