import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ServiceStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ServiceHealthService } from './service-health.service';

class UpdateServiceStatusDto {
  @ApiProperty({ enum: ServiceStatus })
  @IsEnum(ServiceStatus)
  status!: ServiceStatus;
}

@ApiTags('health')
@Controller({ path: 'health', version: '1' })
export class ServiceHealthController {
  constructor(private readonly svc: ServiceHealthService) {}

  @Get()
  @ApiOperation({ summary: 'List service health (simulated)' })
  list() {
    return this.svc.list();
  }

  @Patch(':name')
  @ApiOperation({ summary: 'Update simulated service status' })
  update(@Param('name') name: string, @Body() dto: UpdateServiceStatusDto) {
    return this.svc.upsert(name, dto.status);
  }
}
