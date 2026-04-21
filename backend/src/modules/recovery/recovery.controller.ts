import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../prisma/prisma.service';
import { CurrentTenant } from '../../common/auth/current-tenant.decorator';

@ApiTags('recovery')
@Controller({ path: 'recovery', version: '1' })
export class RecoveryController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('attempts')
  @ApiOperation({ summary: 'List recent recovery attempts (tenant-scoped)' })
  attempts(
    @CurrentTenant() tenantId: string,
    @Query('limit') limit?: string,
  ) {
    return this.prisma.recoveryAttempt.findMany({
      where: { jobStep: { job: { tenantId } } },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit ? parseInt(limit, 10) : 100, 500),
      include: {
        incident: { select: { failureType: true, message: true } },
        jobStep: { select: { jobId: true } },
      },
    });
  }

  @Get('stats')
  @ApiOperation({ summary: 'Recovery statistics (tenant-scoped)' })
  async stats(@CurrentTenant() tenantId: string) {
    const where = { jobStep: { job: { tenantId } } };
    const [total, succeeded, failed] = await Promise.all([
      this.prisma.recoveryAttempt.count({ where }),
      this.prisma.recoveryAttempt.count({ where: { ...where, success: true } }),
      this.prisma.recoveryAttempt.count({ where: { ...where, success: false } }),
    ]);
    return {
      total,
      succeeded,
      failed,
      successRate: total > 0 ? Math.round((succeeded / total) * 100) : 0,
    };
  }
}
