import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { requireRole } from '../../middleware/rbac.js';
import { createNoticeBody, listNoticesQuery, updateNoticeBody, type ListNoticesQuery } from './notices.schemas.js';
import * as svc from './notices.service.js';

export const router = Router();

router.get('/notices', validate({ query: listNoticesQuery }), async (req, res) => {
  res.json({ items: await svc.listNotices(req.member!, req.q as ListNoticesQuery) });
});

router.post('/notices', requireRole('ADMIN'), validate({ body: createNoticeBody }), async (req, res) => {
  res.status(201).json(await svc.createNotice(req.member!, req.body));
});

router.patch('/notices/:id', requireRole('ADMIN'), validate({ body: updateNoticeBody }), async (req, res) => {
  res.json(await svc.updateNotice(req.member!, req.params.id as string, req.body));
});

router.delete('/notices/:id', requireRole('ADMIN'), async (req, res) => {
  await svc.deleteNotice(req.member!, req.params.id as string);
  res.status(204).end();
});
