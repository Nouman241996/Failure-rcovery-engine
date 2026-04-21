import { Injectable } from '@nestjs/common';
import { AuditAction, AuditLog, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface AuditLogInput {
  tenantId?: string;
  jobId?: string;
  action: AuditAction;
  message: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  log(input: AuditLogInput): Promise<AuditLog> {
    return this.prisma.auditLog.create({
      data: {
        tenantId: input.tenantId,
        jobId: input.jobId,
        action: input.action,
        message: input.message,
        metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });
  }

  findByJob(tenantId: string, jobId: string): Promise<AuditLog[]> {
    return this.prisma.auditLog.findMany({
      where: { jobId, tenantId },
      orderBy: { createdAt: 'asc' },
    });
  }

  findAll(tenantId: string, limit = 100): Promise<AuditLog[]> {
    return this.prisma.auditLog.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 500),
    });
  }
}
