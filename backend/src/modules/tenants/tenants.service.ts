import { Injectable, NotFoundException } from '@nestjs/common';
import { ApiKey, Tenant } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { generateApiKey } from '../../common/utils/crypto';
import { TenantRepository } from './tenant.repository';

export interface IssuedKey {
  id: string;
  tenantId: string;
  prefix: string;
  label: string;
  /** Raw token — shown ONCE on creation, never persisted in plaintext. */
  token: string;
  createdAt: Date;
}

@Injectable()
export class TenantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repo: TenantRepository,
  ) {}

  list(): Promise<Tenant[]> {
    return this.repo.list();
  }

  async create(input: { name: string; slug: string; rateLimit?: number }): Promise<Tenant> {
    return this.repo.create(input);
  }

  async issueKey(tenantId: string, label: string): Promise<IssuedKey> {
    const tenant = await this.repo.findById(tenantId);
    if (!tenant) throw new NotFoundException(`Tenant ${tenantId} not found`);
    const generated = generateApiKey();
    const created = await this.prisma.apiKey.create({
      data: {
        tenantId,
        label,
        prefix: generated.prefix,
        keyHash: generated.hash,
      },
    });
    return {
      id: created.id,
      tenantId: created.tenantId,
      prefix: created.prefix,
      label: created.label,
      token: generated.raw,
      createdAt: created.createdAt,
    };
  }

  listKeys(tenantId: string): Promise<ApiKey[]> {
    return this.prisma.apiKey.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revokeKey(tenantId: string, keyId: string): Promise<void> {
    const result = await this.prisma.apiKey.updateMany({
      where: { id: keyId, tenantId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (result.count === 0) {
      throw new NotFoundException(`API key ${keyId} not found for tenant`);
    }
  }
}
