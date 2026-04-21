import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentTenant } from '../../common/auth/current-tenant.decorator';
import { IdempotencyInterceptor } from '../../common/idempotency/idempotency.interceptor';
import { JobsService } from './jobs.service';
import { CreateJobDto, ListJobsDto } from './dto/jobs.dto';

@ApiTags('jobs')
@Controller({ path: 'jobs', version: '1' })
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  @Post()
  @UseInterceptors(IdempotencyInterceptor)
  @ApiOperation({ summary: 'Submit a workflow job' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: false,
    description:
      'Pass a unique key to safely retry the same request. Replays return the original response.',
  })
  create(@CurrentTenant() tenantId: string, @Body() dto: CreateJobDto) {
    return this.jobs.create(tenantId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List jobs (tenant-scoped)' })
  list(@CurrentTenant() tenantId: string, @Query() q: ListJobsDto) {
    return this.jobs.list(tenantId, q.status, q.workflowId);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Job statistics (tenant-scoped)' })
  stats(@CurrentTenant() tenantId: string) {
    return this.jobs.stats(tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a job with steps, incidents, and audit log' })
  findOne(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.jobs.findOne(tenantId, id);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancel a running job' })
  cancel(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.jobs.cancel(tenantId, id);
  }
}
