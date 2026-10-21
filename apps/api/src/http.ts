import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  type PipeTransform,
} from '@nestjs/common';
import type { ErrorCode } from '@polifamia/contracts';
import type { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { logger } from './logger.js';

export class ApiError extends HttpException {
  constructor(
    readonly code: ErrorCode,
    message: string,
    status: number,
  ) {
    super(message, status);
  }
}

export class ZodPipe<T extends z.ZodType> implements PipeTransform<unknown, z.infer<T>> {
  constructor(private readonly schema: T) {}
  transform(value: unknown): z.infer<T> {
    const r = this.schema.safeParse(value);
    if (!r.success) throw new ApiError('validation', z.prettifyError(r.error), 400);
    return r.data;
  }
}

const STATUS_CODES: Record<number, ErrorCode> = {
  400: 'validation',
  404: 'not_found',
  413: 'validation',
  429: 'rate_limited',
};

@Catch()
export class ErrorFilter implements ExceptionFilter {
  catch(err: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const req = host.switchToHttp().getRequest<Request>();
    if (err instanceof ApiError) {
      res.status(err.getStatus()).json({ error: { code: err.code, message: err.message } });
      return;
    }
    if (err instanceof HttpException) {
      const status = err.getStatus();
      res.status(status).json({ error: { code: STATUS_CODES[status] ?? 'internal', message: err.message } });
      return;
    }
    // Errores de body-parser (JSON inválido, payload grande) llegan como Error con status.
    const status = (err as { status?: number }).status;
    if (status === 400 || status === 413) {
      res.status(status).json({ error: { code: 'validation', message: (err as Error).message } });
      return;
    }
    logger.error({ err, correlationId: (req as CorrelatedRequest).correlationId }, 'unhandled error');
    res.status(500).json({ error: { code: 'internal', message: 'Internal error' } });
  }
}

export type CorrelatedRequest = Request & { correlationId: string };

/** Asigna correlationId y registra cada petición sin cuerpo ni textos (privacidad). */
export function requestLogger(req: CorrelatedRequest, res: Response, next: NextFunction) {
  const incoming = req.header('x-correlation-id');
  req.correlationId = incoming && /^[\w-]{1,64}$/.test(incoming) ? incoming : randomUUID();
  res.setHeader('X-Correlation-Id', req.correlationId);
  const start = performance.now();
  res.on('finish', () =>
    logger.info(
      {
        correlationId: req.correlationId,
        method: req.method,
        path: req.route?.path ?? req.path,
        status: res.statusCode,
        ms: Math.round(performance.now() - start),
      },
      'request',
    ),
  );
  next();
}

export const InstallId = z.uuid();
