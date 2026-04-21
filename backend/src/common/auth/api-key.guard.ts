import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { sha256 } from '../utils/crypto';
import { RequestContextStore } from '../context/request-context';
import { IS_PUBLIC_KEY } from './public.decorator';
import type { AppEnv } from '../config/env';
import type { AuthenticatedRequest } from './current-tenant.decorator';

const HEADER = 'x-api-key';

/**
 * Authenticates inbound requests using an API key (`x-api-key` header).
 *
 * - When `AUTH_ENABLED=false`, attaches the `DEFAULT_TENANT_SLUG` tenant
 *   automatically (development convenience).
 * - When `AUTH_ENABLED=true`, requires a valid, non-revoked key. The raw key
 *   is hashed with SHA-256 and looked up by digest — raw keys are never
 *   stored.
 * - Bumps `lastUsedAt` asynchronously (fire-and-forget) so the request path
 *   stays fast.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<AppEnv, true>,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    const rawAuth = this.config.get('AUTH_ENABLED', { infer: true });
    const authEnabled =
      typeof rawAuth === 'boolean' ? rawAuth : !/^(0|false|no|off)$/i.test(String(rawAuth ?? ''));

    if (!authEnabled) {
      const slug = this.config.get('DEFAULT_TENANT_SLUG', { infer: true });
      const tenant = await this.prisma.tenant.findUnique({ where: { slug } });
      if (!tenant) {
        throw new UnauthorizedException(
          `Default tenant "${slug}" not found. Run the seeder.`,
        );
      }
      this.bind(req, tenant.id);
      return true;
    }

    const raw = (req.headers[HEADER] as string | undefined)?.trim();
    if (!raw) throw new UnauthorizedException('Missing API key');

    const apiKey = await this.prisma.apiKey.findUnique({
      where: { keyHash: sha256(raw) },
      select: { id: true, tenantId: true, revokedAt: true },
    });

    if (!apiKey || apiKey.revokedAt) {
      throw new UnauthorizedException('Invalid API key');
    }

    this.bind(req, apiKey.tenantId, apiKey.id);
    // Best-effort lastUsedAt update; failures don't block requests.
    void this.prisma.apiKey
      .update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } })
      .catch(() => undefined);
    return true;
  }

  private bind(req: Request, tenantId: string, apiKeyId?: string) {
    (req as unknown as AuthenticatedRequest).tenantId = tenantId;
    (req as unknown as AuthenticatedRequest).apiKeyId = apiKeyId;
    const ctx = RequestContextStore.get();
    if (ctx) {
      ctx.tenantId = tenantId;
      ctx.apiKeyId = apiKeyId;
    }
  }
}
