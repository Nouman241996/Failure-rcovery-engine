import {
  CallHandler,
  ExecutionContext,
  Inject,
  Injectable,
  NestInterceptor,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Observable, from, of, switchMap, tap } from 'rxjs';
import { Request, Response } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { sha256 } from '../utils/crypto';
import type { AppEnv } from '../config/env';
import type { AuthenticatedRequest } from '../auth/current-tenant.decorator';

const HEADER = 'idempotency-key';

/**
 * Idempotency interceptor for write endpoints.
 *
 * Caches the response body+status of the first request seen with a given
 * `Idempotency-Key`. Subsequent identical replays receive the cached
 * response. Different bodies under the same key fail with 409 to prevent
 * silent overwrites.
 *
 * Storage: `idempotency_keys` table, scoped per tenant. TTL configurable
 * via `IDEMPOTENCY_TTL_HOURS`.
 *
 * The interceptor is a no-op when no header is present, allowing callers to
 * opt in.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly logger = new Logger(IdempotencyInterceptor.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(ConfigService)
    private readonly config: ConfigService<AppEnv, true>,
  ) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    const res = ctx.switchToHttp().getResponse<Response>();

    const key = (req.headers[HEADER] as string | undefined)?.trim();
    if (!key || !req.tenantId) return next.handle();

    const requestHash = this.hashBody(req);
    return from(
      this.prisma.idempotencyKey.findUnique({
        where: { tenantId_key: { tenantId: req.tenantId, key } },
      }),
    ).pipe(
      switchMap((existing) => {
        if (existing) {
          if (existing.requestHash !== requestHash) {
            throw new ConflictException(
              'Idempotency-Key was previously used with a different request body',
            );
          }
          res.status(existing.responseStatus);
          res.setHeader('Idempotent-Replayed', 'true');
          return of(existing.responseBody);
        }
        return next.handle().pipe(
          tap((body) => {
            void this.persist(req.tenantId, key, requestHash, res.statusCode, body);
          }),
        );
      }),
    );
  }

  private hashBody(req: Request): string {
    return sha256(JSON.stringify(req.body ?? {}));
  }

  private async persist(
    tenantId: string,
    key: string,
    requestHash: string,
    status: number,
    body: unknown,
  ) {
    const ttlHours = this.config.get('IDEMPOTENCY_TTL_HOURS', { infer: true });
    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);
    try {
      await this.prisma.idempotencyKey.create({
        data: {
          tenantId,
          key,
          requestHash,
          responseStatus: status,
          responseBody: (body ?? {}) as object,
          jobId: this.extractJobId(body),
          expiresAt,
        },
      });
    } catch (err) {
      // Race: another concurrent request stored the same key first.
      // The unique constraint will protect correctness; log and move on.
      this.logger.debug(
        `Idempotency persist race for key=${key}: ${(err as Error).message}`,
      );
    }
  }

  private extractJobId(body: unknown): string | undefined {
    if (
      body &&
      typeof body === 'object' &&
      'id' in body &&
      typeof (body as { id: unknown }).id === 'string'
    ) {
      return (body as { id: string }).id;
    }
    return undefined;
  }
}
