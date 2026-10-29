import { Router, type RequestHandler } from 'express';
import { validate } from '../../middleware/validate.js';
import { requireRole } from '../../middleware/rbac.js';
import { bulkFlatsBody, createBlockBody, listFlatsQuery } from './society.schemas.js';
import * as svc from './society.service.js';

export const router = Router();

/** POST /societies is user-scoped (no X-Society-Id); mounted before requireMember in app.ts. */
export const createSocietyHandler: RequestHandler = async (req, res) => {
  res.status(201).json(await svc.createSociety(req.user!.id, req.body));
};

router.get('/society', async (req, res) => {
  res.json(await svc.getSociety(req.member!));
});

router.get('/blocks', async (req, res) => {
  res.json({ items: await svc.listBlocks(req.member!) });
});

router.post('/blocks', requireRole('ADMIN'), validate({ body: createBlockBody }), async (req, res) => {
  res.status(201).json(await svc.createBlock(req.member!, req.body));
});

router.get('/flats', validate({ query: listFlatsQuery }), async (req, res) => {
  res.json({ items: await svc.listFlats(req.member!, req.q as { blockId?: string }) });
});

router.post('/flats/bulk', requireRole('ADMIN'), validate({ body: bulkFlatsBody }), async (req, res) => {
  res.status(201).json(await svc.bulkCreateFlats(req.member!, req.body));
});
