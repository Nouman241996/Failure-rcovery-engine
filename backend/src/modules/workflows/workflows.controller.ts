import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentTenant } from '../../common/auth/current-tenant.decorator';
import { WorkflowsService } from './workflows.service';
import { CreateWorkflowDto } from './dto/workflows.dto';

@ApiTags('workflows')
@Controller({ path: 'workflows', version: '1' })
export class WorkflowsController {
  constructor(private readonly workflows: WorkflowsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a workflow definition' })
  create(@CurrentTenant() tenantId: string, @Body() dto: CreateWorkflowDto) {
    return this.workflows.create(tenantId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List workflow definitions' })
  list(@CurrentTenant() tenantId: string) {
    return this.workflows.list(tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a workflow by id' })
  findOne(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.workflows.findOne(tenantId, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a workflow' })
  remove(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.workflows.remove(tenantId, id);
  }
}
