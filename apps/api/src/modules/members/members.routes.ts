import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { requireRole } from '../../middleware/rbac.js';
import { addMemberBody, listMembersQuery, updateMemberBody, type ListMembersQuery } from './members.schemas.js';
import * as svc from './members.service.js';

export const router = Router();

router.get('/members', requireRole('ADMIN', 'GUARD'), validate({ query: listMembersQuery }), async (req, res) => {
  res.json({ items: await svc.listMembers(req.member!, req.q as ListMembersQuery) });
});

router.post('/members', requireRole('ADMIN'), validate({ body: addMemberBody }), async (req, res) => {
  res.status(201).json(await svc.addMember(req.member!, req.body));
});

router.patch('/members/:id', requireRole('ADMIN'), validate({ body: updateMemberBody }), async (req, res) => {
  res.json(await svc.updateMember(req.member!, req.params.id as string, req.body));
});
