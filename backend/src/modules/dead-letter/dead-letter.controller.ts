import { Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentTenant } from '../../common/auth/current-tenant.decorator';
import { DeadLetterService } from './dead-letter.service';

@ApiTags('dlq')
@Controller({ path: 'dlq', version: '1' })
export class DeadLetterController {
  constructor(private readonly dlq: DeadLetterService) {}

  @Get()
  @ApiOperation({ summary: 'List dead-letter queue jobs' })
  list(@CurrentTenant() tenantId: string) {
    return this.dlq.list(tenantId);
  }

  @Post(':bullJobId/retry')
  @ApiOperation({ summary: 'Manually retry a dead-letter job' })
  retry(
    @CurrentTenant() tenantId: string,
    @Param('bullJobId') bullJobId: string,
  ) {
    return this.dlq.retry(tenantId, bullJobId);
  }
}
