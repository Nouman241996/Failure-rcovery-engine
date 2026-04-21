import { createParamDecorator, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Request } from 'express';

export interface AuthenticatedRequest extends Request {
  tenantId: string;
  apiKeyId?: string;
}

/**
 * Resolves the current tenant ID (set by `ApiKeyGuard`).
 * Throws if no tenant is bound to the request — callers must pair this with
 * the guard.
 */
export const CurrentTenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!req.tenantId) {
      throw new ForbiddenException('No tenant bound to request');
    }
    return req.tenantId;
  },
);
