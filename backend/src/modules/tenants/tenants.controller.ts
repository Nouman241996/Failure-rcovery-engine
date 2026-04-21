import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { CurrentTenant } from '../../common/auth/current-tenant.decorator';
import { TenantsService } from './tenants.service';
import { CreateTenantDto, IssueApiKeyDto } from './dto/tenants.dto';
import type { AppEnv } from '../../common/config/env';

/**
 * Tenant administration.
 *
 * The `POST /v1/tenants` endpoint is intentionally restricted: only the
 * configured admin tenant (`DEFAULT_TENANT_SLUG`) may create new tenants.
 * All other endpoints operate on the caller's bound tenant.
 */
@ApiTags('tenants')
@Controller({ path: 'tenants', version: '1' })
export class TenantsController {
  constructor(
    private readonly tenants: TenantsService,
    private readonly config: ConfigService<AppEnv, true>,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List tenants (admin only)' })
  async list(@CurrentTenant() tenantId: string) {
    await this.assertAdmin(tenantId);
    return this.tenants.list();
  }

  @Post()
  @ApiOperation({ summary: 'Create a tenant (admin only)' })
  async create(@CurrentTenant() tenantId: string, @Body() dto: CreateTenantDto) {
    await this.assertAdmin(tenantId);
    return this.tenants.create(dto);
  }

  @Get('me/keys')
  @ApiOperation({ summary: 'List API keys for the calling tenant' })
  listKeys(@CurrentTenant() tenantId: string) {
    return this.tenants.listKeys(tenantId);
  }

  @Post('me/keys')
  @ApiOperation({
    summary: 'Issue a new API key. Returns the raw token ONCE.',
  })
  issueKey(@CurrentTenant() tenantId: string, @Body() dto: IssueApiKeyDto) {
    return this.tenants.issueKey(tenantId, dto.label);
  }

  @Delete('me/keys/:keyId')
  @ApiOperation({ summary: 'Revoke an API key' })
  async revokeKey(
    @CurrentTenant() tenantId: string,
    @Param('keyId') keyId: string,
  ) {
    await this.tenants.revokeKey(tenantId, keyId);
    return { revoked: true };
  }

  private async assertAdmin(tenantId: string): Promise<void> {
    const adminSlug = this.config.get('DEFAULT_TENANT_SLUG', { infer: true });
    const tenant = await this.tenants.list().then((all) => all.find((t) => t.id === tenantId));
    if (!tenant || tenant.slug !== adminSlug) {
      throw new ForbiddenException('Admin tenant required');
    }
  }
}
