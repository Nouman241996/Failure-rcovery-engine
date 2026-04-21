import { Injectable } from '@nestjs/common';
import { Incident } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class IncidentsService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string, resolved?: boolean): Promise<Incident[]> {
    return this.prisma.incident.findMany({
      where: {
        job: { tenantId },
        ...(resolved !== undefined ? { resolved } : {}),
      },
      include: {
        recoveryAttempts: { orderBy: { createdAt: 'asc' } },
        job: { select: { id: true, status: true, workflow: { select: { name: true } } } },
        jobStep: { select: { workflowStep: { select: { name: true, type: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async resolve(tenantId: string, id: string) {
    const result = await this.prisma.incident.updateMany({
      where: { id, job: { tenantId } },
      data: { resolved: true },
    });
    if (result.count === 0) {
      throw new Error(`Incident ${id} not found`);
    }
    return { resolved: true };
  }

  async stats(tenantId: string) {
    const where = { job: { tenantId } };
    const [total, resolved, escalated] = await Promise.all([
      this.prisma.incident.count({ where }),
      this.prisma.incident.count({ where: { ...where, resolved: true } }),
      this.prisma.incident.count({ where: { ...where, escalated: true } }),
    ]);
    return { total, resolved, open: total - resolved, escalated };
  }
}
