import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { requireRole } from '../../middleware/rbac.js';
import { createPollBody, listPollsQuery, voteBody } from './polls.schemas.js';
import * as svc from './polls.service.js';

export const router = Router();

router.get('/polls', validate({ query: listPollsQuery }), async (req, res) => {
  res.json({ items: await svc.listPolls(req.member!, req.q as { limit: number }) });
});

router.post('/polls', requireRole('ADMIN'), validate({ body: createPollBody }), async (req, res) => {
  res.status(201).json(await svc.createPoll(req.member!, req.body));
});

router.post('/polls/:id/vote', requireRole('RESIDENT'), validate({ body: voteBody }), async (req, res) => {
  res.json(await svc.vote(req.member!, req.params.id as string, req.body.optionId));
});
