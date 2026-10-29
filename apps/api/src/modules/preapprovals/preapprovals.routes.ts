import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { requireRole } from '../../middleware/rbac.js';
import { createPreApprovalBody, listPreApprovalsQuery, type ListPreApprovalsQuery } from './preapprovals.schemas.js';
import * as svc from './preapprovals.service.js';

export const router = Router();

router.get('/preapprovals', validate({ query: listPreApprovalsQuery }), async (req, res) => {
  res.json({ items: await svc.listPreApprovals(req.member!, req.q as ListPreApprovalsQuery) });
});

router.post('/preapprovals', requireRole('RESIDENT'), validate({ body: createPreApprovalBody }), async (req, res) => {
  res.status(201).json(await svc.createPreApproval(req.member!, req.body));
});

router.delete('/preapprovals/:id', requireRole('RESIDENT'), async (req, res) => {
  res.json(await svc.cancelPreApproval(req.member!, req.params.id as string));
});
