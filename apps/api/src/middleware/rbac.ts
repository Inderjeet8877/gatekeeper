import type { RequestHandler } from 'express';
import type { Role } from '@prisma/client';
import { forbidden } from '../lib/errors.js';

export const requireRole = (...roles: Role[]): RequestHandler => (req, _res, next) => {
  if (!roles.includes(req.member!.role)) throw forbidden();
  next();
};
