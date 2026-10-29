import type { RequestHandler } from 'express';
import type { Role, ResidentType } from '@prisma/client';
import { verifyToken } from '../lib/jwt.js';
import { unauthorized } from '../lib/errors.js';

export interface AuthUser { id: string }
export interface Member {
  id: string;                 // Membership.id (the actor id stored in ...ById columns)
  userId: string;
  societyId: string;
  role: Role;
  flatId: string | null;      // non-null for RESIDENT
  residentType: ResidentType | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      member?: Member;
      q?: unknown;            // parsed query (Express 5 req.query is a getter)
    }
  }
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) throw unauthorized();
  req.user = { id: verifyToken(h.slice(7).trim()).sub };
  next();
};
