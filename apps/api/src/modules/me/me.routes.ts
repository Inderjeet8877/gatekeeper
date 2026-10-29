import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { updateMeBody } from './me.schemas.js';
import * as svc from './me.service.js';

export const router = Router();

router.get('/me', async (req, res) => {
  res.json(await svc.getMe(req.user!.id));
});

router.patch('/me', validate({ body: updateMeBody }), async (req, res) => {
  res.json(await svc.updateMe(req.user!.id, req.body));
});
