import type { RequestHandler } from 'express';
import { prisma } from '../db.js';
import { badRequest, forbidden } from '../lib/errors.js';

export const requireMember: RequestHandler = async (req, _res, next) => {
  const societyId = req.header('x-society-id');
  if (!societyId) throw badRequest('X-Society-Id header is required', [{ path: 'X-Society-Id', message: 'Required' }]);
  const m = await prisma.membership.findFirst({ where: { userId: req.user!.id, societyId, status: 'ACTIVE' } });
  if (!m) throw forbidden('You are not a member of this society');
  req.member = { id: m.id, userId: m.userId, societyId, role: m.role, flatId: m.flatId, residentType: m.residentType };
  req.log = req.log.child({ societyId, membershipId: m.id });
  next();
};
