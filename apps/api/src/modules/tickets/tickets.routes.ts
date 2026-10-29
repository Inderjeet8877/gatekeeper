import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { requireRole } from '../../middleware/rbac.js';
import { commentBody, createTicketBody, listTicketsQuery, updateTicketBody, type ListTicketsQuery } from './tickets.schemas.js';
import * as svc from './tickets.service.js';

export const router = Router();
const roles = requireRole('RESIDENT', 'ADMIN');

router.get('/tickets', roles, validate({ query: listTicketsQuery }), async (req, res) => {
  res.json({ items: await svc.listTickets(req.member!, req.q as ListTicketsQuery) });
});

router.post('/tickets', roles, validate({ body: createTicketBody }), async (req, res) => {
  res.status(201).json(await svc.createTicket(req.member!, req.body));
});

router.get('/tickets/:id', roles, async (req, res) => {
  res.json(await svc.getTicket(req.member!, req.params.id as string));
});

router.patch('/tickets/:id', roles, validate({ body: updateTicketBody }), async (req, res) => {
  res.json(await svc.updateTicket(req.member!, req.params.id as string, req.body));
});

router.post('/tickets/:id/comments', roles, validate({ body: commentBody }), async (req, res) => {
  res.status(201).json(await svc.addComment(req.member!, req.params.id as string, req.body));
});
