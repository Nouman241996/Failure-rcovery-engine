import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';

@Injectable()
export class HttpLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest<Request & { requestId?: string; tenantId?: string }>();
    const res = ctx.switchToHttp().getResponse<Response>();
    const started = Date.now();

    return next.handle().pipe(
      tap({
        next: () => this.log(req, res, started),
        error: () => this.log(req, res, started),
      }),
    );
  }

  private log(req: Request & { requestId?: string; tenantId?: string }, res: Response, started: number) {
    const duration = Date.now() - started;
    this.logger.log(
      `${req.method} ${req.url} ${res.statusCode} ${duration}ms ` +
        `[req=${req.requestId ?? '-'} tenant=${req.tenantId ?? '-'}]`,
    );
  }
}
