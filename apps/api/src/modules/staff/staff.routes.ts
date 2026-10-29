import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { requireRole } from '../../middleware/rbac.js';
import {
  attendanceQuery, createStaffBody, linkFlatBody, listStaffQuery, updateStaffBody,
  type AttendanceQuery, type ListStaffQuery,
} from './staff.schemas.js';
import * as svc from './staff.service.js';

export const router = Router();

router.get('/staff', validate({ query: listStaffQuery }), async (req, res) => {
  res.json({ items: await svc.listStaff(req.member!, req.q as ListStaffQuery) });
});

router.post('/staff', requireRole('ADMIN'), validate({ body: createStaffBody }), async (req, res) => {
  res.status(201).json(await svc.createStaff(req.member!, req.body));
});

router.patch('/staff/:id', requireRole('ADMIN'), validate({ body: updateStaffBody }), async (req, res) => {
  res.json(await svc.updateStaff(req.member!, req.params.id as string, req.body));
});

router.post('/staff/:id/flats', requireRole('ADMIN', 'RESIDENT'), validate({ body: linkFlatBody }), async (req, res) => {
  res.json(await svc.linkFlat(req.member!, req.params.id as string, req.body.flatId));
});

router.get('/staff/:id/attendance', validate({ query: attendanceQuery }), async (req, res) => {
  res.json({ items: await svc.listAttendance(req.member!, req.params.id as string, req.q as AttendanceQuery) });
});
