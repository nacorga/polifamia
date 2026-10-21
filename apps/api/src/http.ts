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

/**
 * Límite por minuto por IP y, por separado, por `X-Install-Id` (FR-016, PRD §10.5). El installId es
 * anónimo y falsificable: por eso la IP se limita siempre, aunque cambie el identificador.
 * ponytail: ventana fija en memoria de un solo proceso; con varias instancias, mover a PostgreSQL.
 */
export function rateLimit(perMinute: number, now: () => number = Date.now) {
  const hits = new Map<string, { windowStart: number; count: number }>();
  const over = (key: string, t: number) => {
    const h = hits.get(key);
    if (!h || t - h.windowStart >= 60_000) {
      hits.set(key, { windowStart: t, count: 1 });
      return false;
    }
    return ++h.count > perMinute;
  };
  return (req: Request, res: Response, next: NextFunction) => {
    const t = now();
    if (hits.size > 10_000) for (const [k, h] of hits) if (t - h.windowStart >= 60_000) hits.delete(k);
    const installId = InstallId.safeParse(req.header('x-install-id'));
    const limited = [
      over(`ip:${req.ip}`, t),
      installId.success ? over(`install:${installId.data}`, t) : false,
    ].some(Boolean);
    if (!limited) return next();
    res.setHeader('Retry-After', '60');
    res.status(429).json({ error: { code: 'rate_limited', message: 'Too many requests' } });
  };
}
