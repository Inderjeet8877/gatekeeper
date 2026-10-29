import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { AppError } from '../lib/errors.js';
import { logger } from '../config.js';

export const notFoundHandler: RequestHandler = () => { throw new AppError(404, 'NOT_FOUND', 'Route not found'); };

function toAppError(err: unknown): AppError | null {
  if (err instanceof AppError) return err;
  if (err instanceof ZodError) {
    return new AppError(400, 'VALIDATION_ERROR', 'Invalid input',
      err.issues.map(i => ({ path: i.path.join('.'), message: i.message })));
  }
  const type = (err as { type?: string } | null)?.type;
  if (type === 'entity.parse.failed') return new AppError(400, 'VALIDATION_ERROR', 'Malformed JSON', [{ path: '', message: 'Malformed JSON' }]);
  if (type === 'entity.too.large') return new AppError(413, 'VALIDATION_ERROR', 'Body too large', [{ path: '', message: 'Body too large' }]);
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') return new AppError(409, 'CONFLICT', 'Already exists', { target: err.meta?.target });
    if (err.code === 'P2025') return new AppError(404, 'NOT_FOUND', 'Not found');
    if (err.code === 'P2034') return new AppError(409, 'CONFLICT', 'Conflicting update, please retry');
  }
  return null;
}

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const e = toAppError(err);
  const log = req.log ?? logger; // body-parser errors happen before pino-http attaches req.log
  if (!e) {
    log.error({ err }, 'unhandled error');
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } });
    return;
  }
  log.info({ code: e.code, status: e.status }, e.message);
  res.status(e.status).json({ error: { code: e.code, message: e.message, ...(e.details !== undefined && { details: e.details }) } });
};
