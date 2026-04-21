import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { RequestContextStore } from './request-context';

const HEADER = 'x-request-id';

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const requestId =
      (req.headers[HEADER] as string | undefined) ?? randomUUID();
    res.setHeader(HEADER, requestId);
    (req as unknown as { requestId: string }).requestId = requestId;
    RequestContextStore.run({ requestId }, () => next());
  }
}
