import type { NextFunction, Request, Response } from 'express';
import crypto from 'crypto';

/** Tag every request with a short id (header + response), used in error payloads. */
export function requestId(req: Request, res: Response, next: NextFunction) {
  const incoming = (req.headers['x-request-id'] as string) || '';
  const id = /^[A-Za-z0-9-]{8,64}$/.test(incoming) ? incoming : crypto.randomBytes(8).toString('hex');
  res.setHeader('x-request-id', id);
  (res as any).locals.requestId = id;
  next();
}
