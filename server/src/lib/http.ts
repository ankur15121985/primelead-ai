import { ZodError, type ZodType } from 'zod';
import type { NextFunction, Request, Response } from 'express';

/** Friendly API error with an HTTP status code. */
export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (msg: string, details?: unknown) => new ApiError(400, 'BAD_REQUEST', msg, details);
export const unauthorized = (msg = 'Please sign in to continue') => new ApiError(401, 'UNAUTHORIZED', msg);
export const forbidden = (msg = 'You do not have permission to do that') => new ApiError(403, 'FORBIDDEN', msg);
export const notFound = (msg = 'Not found') => new ApiError(404, 'NOT_FOUND', msg);
export const conflict = (msg: string) => new ApiError(409, 'CONFLICT', msg);
export const unprocessable = (msg: string) => new ApiError(422, 'INVALID_PAYLOAD', msg);
export const tooMany = (msg = 'Too many requests. Please slow down.') => new ApiError(429, 'RATE_LIMITED', msg);
export const serverError = (msg = 'Something went wrong on our side. Please try again.') =>
  new ApiError(500, 'INTERNAL', msg);

/** Wrap an async route handler so thrown errors reach the error middleware. */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

/** Validate request payloads with zod. Throws 422 with readable messages. */
export function validate<T>(schema: ZodType<T>, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (err) {
    if (err instanceof ZodError) {
      const first = err.issues[0];
      const path = first?.path.join('.');
      const message = first?.message || 'Invalid input';
      throw new ApiError(422, 'VALIDATION_ERROR', path ? `${path}: ${message}` : message, err.issues);
    }
    throw err;
  }
}

/** Consistent response envelope: { data } on success. */
export function ok<T>(res: Response, data: T, status = 200) {
  return res.status(status).json({ data });
}
