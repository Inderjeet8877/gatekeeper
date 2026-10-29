import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { requireRole } from '../../middleware/rbac.js';
import {
  availabilityQuery, createAmenityBody, createBookingBody, listBookingsQuery, updateAmenityBody, type ListBookingsQuery,
} from './amenities.schemas.js';
import * as svc from './amenities.service.js';

export const router = Router();

router.get('/amenities', async (req, res) => {
  res.json({ items: await svc.listAmenities(req.member!) });
});

router.post('/amenities', requireRole('ADMIN'), validate({ body: createAmenityBody }), async (req, res) => {
  res.status(201).json(await svc.createAmenity(req.member!, req.body));
});

router.patch('/amenities/:id', requireRole('ADMIN'), validate({ body: updateAmenityBody }), async (req, res) => {
  res.json(await svc.updateAmenity(req.member!, req.params.id as string, req.body));
});

router.get('/amenities/:id/availability', validate({ query: availabilityQuery }), async (req, res) => {
  res.json({ items: await svc.getAvailability(req.member!, req.params.id as string, (req.q as { date: string }).date) });
});

const bookingRoles = requireRole('RESIDENT', 'ADMIN');

router.get('/bookings', bookingRoles, validate({ query: listBookingsQuery }), async (req, res) => {
  res.json({ items: await svc.listBookings(req.member!, req.q as ListBookingsQuery) });
});

router.post('/bookings', bookingRoles, validate({ body: createBookingBody }), async (req, res) => {
  res.status(201).json(await svc.createBooking(req.member!, req.body));
});

router.delete('/bookings/:id', bookingRoles, async (req, res) => {
  res.json(await svc.cancelBooking(req.member!, req.params.id as string));
});
