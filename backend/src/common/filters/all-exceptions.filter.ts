import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';

interface ErrorBody {
  statusCode: number;
  error: string;
  message: string | string[];
  requestId?: string;
  timestamp: string;
  path: string;
  method: string;
}

/**
 * Centralized error → JSON mapper.
 *
 * - HttpException: pass through.
 * - Prisma known errors: translate to clean 4xx/5xx with stable shape.
 * - Anything else: 500 with generic message (full error logged, never leaked).
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request & { requestId?: string }>();

    const { status, error, message } = this.normalize(exception);

    const body: ErrorBody = {
      statusCode: status,
      error,
      message,
      requestId: req.requestId,
      timestamp: new Date().toISOString(),
      path: req.url,
      method: req.method,
    };

    if (status >= 500) {
      this.logger.error(
        { err: this.serializeError(exception), req: { method: req.method, url: req.url, requestId: req.requestId } },
        `Unhandled error: ${req.method} ${req.url} → ${status}`,
      );
    } else {
      this.logger.warn(`${req.method} ${req.url} → ${status} ${typeof message === 'string' ? message : message.join('; ')}`);
    }

    res.status(status).json(body);
  }

  private normalize(exception: unknown): {
    status: number;
    error: string;
    message: string | string[];
  } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();
      if (typeof response === 'string') {
        return { status, error: HttpStatus[status] ?? 'Error', message: response };
      }
      const r = response as { message?: string | string[]; error?: string };
      return {
        status,
        error: r.error ?? HttpStatus[status] ?? 'Error',
        message: r.message ?? exception.message,
      };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      // P2002 = unique constraint, P2025 = not found
      if (exception.code === 'P2002') {
        return {
          status: HttpStatus.CONFLICT,
          error: 'Conflict',
          message: 'A resource with the given unique fields already exists',
        };
      }
      if (exception.code === 'P2025') {
        return {
          status: HttpStatus.NOT_FOUND,
          error: 'Not Found',
          message: 'Resource not found',
        };
      }
      return {
        status: HttpStatus.BAD_REQUEST,
        error: 'Bad Request',
        message: `Database error: ${exception.code}`,
      };
    }

    if (exception instanceof Prisma.PrismaClientValidationError) {
      return {
        status: HttpStatus.BAD_REQUEST,
        error: 'Bad Request',
        message: 'Invalid request payload',
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'Internal Server Error',
      message: 'An unexpected error occurred',
    };
  }

  private serializeError(err: unknown): Record<string, unknown> {
    if (err instanceof Error) {
      return { name: err.name, message: err.message, stack: err.stack };
    }
    return { value: String(err) };
  }
}
