import { z } from 'zod';
import { date, hhmm, id, isoDateTime, limit, optStr, str } from '../../middleware/validate.js';

const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

/** Cross-field hours rule, shared by create and the merged PATCH result. */
export function hoursIssue(a: { openTime: string; closeTime: string; slotMinutes: number }): string | null {
  if (minutes(a.closeTime) <= minutes(a.openTime)) return 'closeTime must be after openTime';
  if (minutes(a.closeTime) - minutes(a.openTime) < a.slotMinutes) return 'Opening hours must fit at least one slot';
  return null;
}

const fields = {
  name: str(1, 80),
  description: optStr(500),
  openTime: hhmm,
  closeTime: hhmm,
  slotMinutes: z.number().int().min(15).max(480),
  capacity: z.number().int().min(1).max(500),
  pricePerSlot: z.number().int().min(0),
  isActive: z.boolean(),
};

export const createAmenityBody = z.object({
  ...fields, pricePerSlot: fields.pricePerSlot.default(0), isActive: fields.isActive.default(true),
}).superRefine((a, ctx) => {
  const issue = hoursIssue(a);
  if (issue) ctx.addIssue({ code: 'custom', path: ['closeTime'], message: issue });
});

export const updateAmenityBody = z.object({
  name: fields.name.optional(), description: fields.description, openTime: fields.openTime.optional(),
  closeTime: fields.closeTime.optional(), slotMinutes: fields.slotMinutes.optional(), capacity: fields.capacity.optional(),
  pricePerSlot: fields.pricePerSlot.optional(), isActive: fields.isActive.optional(),
}).refine(o => Object.values(o).some(v => v !== undefined), 'At least one field is required');

export const availabilityQuery = z.object({ date });
export const createBookingBody = z.object({ amenityId: id, startAt: isoDateTime, flatId: id.nullish() });
export const listBookingsQuery = z.object({
  amenityId: id.optional(), date: date.optional(), status: z.enum(['CONFIRMED', 'CANCELLED']).optional(), limit,
});

export type CreateAmenityBody = z.infer<typeof createAmenityBody>;
export type UpdateAmenityBody = z.infer<typeof updateAmenityBody>;
export type CreateBookingBody = z.infer<typeof createBookingBody>;
export type ListBookingsQuery = z.infer<typeof listBookingsQuery>;
