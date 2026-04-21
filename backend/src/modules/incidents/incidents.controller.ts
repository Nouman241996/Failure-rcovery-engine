import { Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentTenant } from '../../common/auth/current-tenant.decorator';
import { IncidentsService } from './incidents.service';

@ApiTags('incidents')
@Controller({ path: 'incidents', version: '1' })
export class IncidentsController {
  constructor(private readonly incidents: IncidentsService) {}

  @Get()
  @ApiOperation({ summary: 'List incidents' })
  list(
    @CurrentTenant() tenantId: string,
    @Query('resolved') resolved?: string,
  ) {
    const flag = resolved === 'true' ? true : resolved === 'false' ? false : undefined;
    return this.incidents.list(tenantId, flag);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Incident statistics' })
  stats(@CurrentTenant() tenantId: string) {
    return this.incidents.stats(tenantId);
  }

  @Patch(':id/resolve')
  @ApiOperation({ summary: 'Mark an incident as resolved' })
  resolve(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.incidents.resolve(tenantId, id);
  }
}
