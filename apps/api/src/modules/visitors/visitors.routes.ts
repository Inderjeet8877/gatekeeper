import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { requireRole } from '../../middleware/rbac.js';
import { createVisitorBody, decisionBody, gateVerifyBody, listVisitorsQuery, type ListVisitorsQuery } from './visitors.schemas.js';
import * as svc from './visitors.service.js';

export const router = Router();

router.get('/visitors', validate({ query: listVisitorsQuery }), async (req, res) => {
  res.json({ items: await svc.listVisitors(req.member!, req.q as ListVisitorsQuery) });
});

router.post('/visitors', requireRole('GUARD'), validate({ body: createVisitorBody }), async (req, res) => {
  res.status(201).json(await svc.logWalkIn(req.member!, req.body));
});

router.post('/visitors/:id/decision', requireRole('RESIDENT'), validate({ body: decisionBody }), async (req, res) => {
  res.json(await svc.decide(req.member!, req.params.id as string, req.body.decision));
});

router.post('/visitors/:id/check-in', requireRole('GUARD'), async (req, res) => {
  res.json(await svc.checkIn(req.member!, req.params.id as string));
});

router.post('/visitors/:id/check-out', requireRole('GUARD'), async (req, res) => {
  res.json(await svc.checkOut(req.member!, req.params.id as string));
});

router.post('/visitors/:id/collect', requireRole('GUARD', 'RESIDENT'), async (req, res) => {
  res.json(await svc.collect(req.member!, req.params.id as string));
});

router.post('/gate/verify', requireRole('GUARD'), validate({ body: gateVerifyBody }), async (req, res) => {
  res.json(await svc.verifyGatePasscode(req.member!, req.body.passcode));
});
