import type { NextFunction, Request, Response } from 'express';
import { ApiError } from '../lib/http';
import { recordError } from '../lib/server-log';

function requestIdOf(res: Response): string {
  return (res as any).locals?.requestId || '';
}

/**
 * Central error handler — never leaks raw server errors to the client.
 * Every error is mapped to a friendly message + a stable error code +
 * a requestId so support conversations can reference a specific failure.
 */
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  // Surface real 4xx/5xx to the admin error feed (quietly, never to clients).
  // Skip routine 401 (session expiry) and 404 (probes) to keep the feed useful.
  const errStatus = err instanceof ApiError ? err.status : 500;
  if (errStatus !== 401 && errStatus !== 404) {
    recordError({
      method: req.method,
      path: req.originalUrl.split('?')[0],
      message: err instanceof Error ? err.message : 'Unknown error',
      status: errStatus,
      code: err instanceof ApiError ? err.code : 'INTERNAL',
      requestId: requestIdOf(res),
    });
  }

  const requestId = requestIdOf(res);

  if (err instanceof ApiError) {
    return res.status(err.status).json({
      error: {
        code: err.code,
        message: err.message,
        requestId,
        ...(err.details ? { details: err.details } : {}),
      },
    });
  }

  // Body-parser / multer style errors
  const anyErr = err as { type?: string; code?: string; status?: number; message?: string };
  if (anyErr?.type === 'entity.too.large' || anyErr?.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'The upload is too large.', requestId } });
  }
  if (anyErr?.code === 'P2002') {
    return res.status(409).json({ error: { code: 'CONFLICT', message: 'This record already exists.', requestId } });
  }
  if (anyErr?.code === 'P2025') {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Record not found.', requestId } });
  }

  // eslint-disable-next-line no-console
  console.error('[error]', req.method, req.originalUrl, err);
  const status = anyErr?.status && anyErr.status >= 400 && anyErr.status < 500 ? anyErr.status : 500;
  // Preserve explicit error codes (e.g. LIMIT_EXCEEDED, CHECKOUT_FAILED) so the
  // UI can act on them; fall back to stable generic codes otherwise.
  const code = status === 500 ? 'INTERNAL' : /^[A-Z][A-Z_]+$/.test(anyErr?.code || '') ? (anyErr.code as string) : 'ERROR';
  return res.status(status).json({
    error: {
      code,
      message: status === 500 ? 'Something went wrong on our side. Please try again.' : anyErr?.message || 'Something went wrong.',
      requestId,
    },
  });
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.originalUrl} not found.`,
      requestId: requestIdOf(res),
    },
  });
}
