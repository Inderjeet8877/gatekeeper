import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { requireRole } from '../../middleware/rbac.js';
import { listSosQuery, raiseSosBody, updateSosBody, type ListSosQuery } from './sos.schemas.js';
import * as svc from './sos.service.js';

export const router = Router();

router.get('/sos', validate({ query: listSosQuery }), async (req, res) => {
  res.json({ items: await svc.listSos(req.member!, req.q as ListSosQuery) });
});

router.post('/sos', requireRole('RESIDENT'), validate({ body: raiseSosBody }), async (req, res) => {
  res.status(201).json(await svc.raiseSos(req.member!, req.body));
});

router.patch('/sos/:id', requireRole('GUARD', 'ADMIN'), validate({ body: updateSosBody }), async (req, res) => {
  res.json(await svc.updateSosStatus(req.member!, req.params.id as string, req.body.status));
});
