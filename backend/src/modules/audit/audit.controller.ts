import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CurrentTenant } from '../../common/auth/current-tenant.decorator';
import { AuditService } from './audit.service';

@ApiTags('audit')
@Controller({ path: 'audit', version: '1' })
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @ApiOperation({ summary: 'List recent audit log entries (tenant-scoped)' })
  list(
    @CurrentTenant() tenantId: string,
    @Query('limit') limit?: string,
  ) {
    return this.audit.findAll(tenantId, limit ? parseInt(limit, 10) : undefined);
  }

  @Get('job/:jobId')
  @ApiOperation({ summary: 'List audit log entries for a job' })
  byJob(
    @CurrentTenant() tenantId: string,
    @Param('jobId') jobId: string,
  ) {
    return this.audit.findByJob(tenantId, jobId);
  }
}
