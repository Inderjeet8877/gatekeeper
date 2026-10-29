import { Router } from 'express';
import { prisma } from '../../db.js';
import { hub } from '../../events.js';
import { verifyToken } from '../../lib/jwt.js';
import { badRequest, forbidden } from '../../lib/errors.js';

export const router = Router();

router.get('/events', async (req, res) => {
  const token = typeof req.query.token === 'string' ? req.query.token : '';
  const societyId = typeof req.query.societyId === 'string' ? req.query.societyId : '';
  if (!token || !societyId) throw badRequest('token and societyId query params are required');
  const { sub } = verifyToken(token);
  const m = await prisma.membership.findFirst({ where: { userId: sub, societyId, status: 'ACTIVE' } });
  if (!m) throw forbidden('You are not a member of this society');

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write('retry: 5000\n: connected\n\n');
  const remove = hub.add({ userId: sub, membershipId: m.id, societyId, role: m.role, flatId: m.flatId, res });
  req.on('close', remove);
});
