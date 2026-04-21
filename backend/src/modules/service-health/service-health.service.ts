import { Injectable } from '@nestjs/common';
import { ServiceHealth, ServiceStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Service health is intentionally global (not tenant-scoped) — it represents
 * shared simulated infrastructure used for chaos testing. In a real
 * deployment this would be replaced by data from your monitoring system.
 */
@Injectable()
export class ServiceHealthService {
  constructor(private readonly prisma: PrismaService) {}

  list(): Promise<ServiceHealth[]> {
    return this.prisma.serviceHealth.findMany({ orderBy: { name: 'asc' } });
  }

  upsert(name: string, status: ServiceStatus): Promise<ServiceHealth> {
    return this.prisma.serviceHealth.upsert({
      where: { name },
      update: { status },
      create: { name, status },
    });
  }

  async asMap(): Promise<Record<string, string>> {
    const records = await this.prisma.serviceHealth.findMany();
    return Object.fromEntries(records.map((r) => [r.name, r.status]));
  }
}
