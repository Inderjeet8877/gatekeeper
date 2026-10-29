import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { listNotificationsQuery, type ListNotificationsQuery } from './notifications.schemas.js';
import * as svc from './notifications.service.js';

export const router = Router();

router.get('/notifications', validate({ query: listNotificationsQuery }), async (req, res) => {
  res.json(await svc.listNotifications(req.user!.id, req.q as ListNotificationsQuery));
});

router.post('/notifications/read-all', async (req, res) => {
  res.json(await svc.markAllRead(req.user!.id));
});

router.post('/notifications/:id/read', async (req, res) => {
  res.json(await svc.markRead(req.user!.id, req.params.id as string));
});
