import { Prisma, type Amenity } from '@prisma/client';
import { prisma, flatInclude, actorInclude, flatRef, actorRef } from '../../db.js';
import { AppError, badRequest, conflict, invalidTransition, notFound, unprocessable } from '../../lib/errors.js';
import { addMinutes, istDateOf, istDateTimeToUtc, istDayRange } from '../../lib/time.js';
import type { Member } from '../../middleware/auth.js';
import {
  hoursIssue, type CreateAmenityBody, type CreateBookingBody, type ListBookingsQuery, type UpdateAmenityBody,
} from './amenities.schemas.js';

const amenityDTO = (a: Amenity) => ({
  id: a.id, name: a.name, description: a.description, openTime: a.openTime, closeTime: a.closeTime,
  slotMinutes: a.slotMinutes, capacity: a.capacity, pricePerSlot: a.pricePerSlot, isActive: a.isActive, createdAt: a.createdAt,
});

const bookingInclude = {
  amenity: { select: { id: true, name: true } }, flat: flatInclude, bookedBy: actorInclude,
} satisfies Prisma.AmenityBookingInclude;

const bookingDTO = (b: Prisma.AmenityBookingGetPayload<{ include: typeof bookingInclude }>) => ({
  id: b.id, amenity: b.amenity, flat: flatRef(b.flat), bookedBy: actorRef(b.bookedBy),
  startAt: b.startAt, endAt: b.endAt, status: b.status, createdAt: b.createdAt,
});

/** Slots from openTime stepping by slotMinutes while the slot ends by closeTime (trailing partial slot dropped). */
export function generateSlots(a: Pick<Amenity, 'openTime' | 'closeTime' | 'slotMinutes'>, date: string) {
  const close = istDateTimeToUtc(date, a.closeTime);
  const slots: { startAt: Date; endAt: Date }[] = [];
  for (let s = istDateTimeToUtc(date, a.openTime); addMinutes(s, a.slotMinutes) <= close; s = addMinutes(s, a.slotMinutes)) {
    slots.push({ startAt: s, endAt: addMinutes(s, a.slotMinutes) });
  }
  return slots;
}

async function findAmenity(m: Member, id: string) {
  const a = await prisma.amenity.findFirst({ where: { id, societyId: m.societyId } });
  if (!a || (!a.isActive && m.role !== 'ADMIN')) throw notFound('Amenity');
  return a;
}

async function assertNameFree(m: Member, name: string, exceptId?: string) {
  const dup = await prisma.amenity.findFirst({
    where: { societyId: m.societyId, name: { equals: name, mode: 'insensitive' }, ...(exceptId && { id: { not: exceptId } }) },
  });
  if (dup) throw conflict('CONFLICT', 'An amenity with this name already exists');
}

export async function listAmenities(m: Member) {
  const rows = await prisma.amenity.findMany({
    where: { societyId: m.societyId, ...(m.role !== 'ADMIN' && { isActive: true }) }, orderBy: { name: 'asc' },
  });
  return rows.map(amenityDTO);
}

export async function createAmenity(m: Member, input: CreateAmenityBody) {
  await assertNameFree(m, input.name);
  return amenityDTO(await prisma.amenity.create({ data: { ...input, societyId: m.societyId } }));
}

export async function updateAmenity(m: Member, id: string, input: UpdateAmenityBody) {
  const cur = await findAmenity(m, id);
  const issue = hoursIssue({
    openTime: input.openTime ?? cur.openTime, closeTime: input.closeTime ?? cur.closeTime, slotMinutes: input.slotMinutes ?? cur.slotMinutes,
  });
  if (issue) throw badRequest(issue, [{ path: 'closeTime', message: issue }]);
  if (input.name) await assertNameFree(m, input.name, id);
  return amenityDTO(await prisma.amenity.update({ where: { id }, data: input }));
}

export async function getAvailability(m: Member, amenityId: string, date: string) {
  const a = await findAmenity(m, amenityId);
  const { start, end } = istDayRange(date);
  const counts = await prisma.amenityBooking.groupBy({
    by: ['startAt'], _count: { _all: true }, where: { amenityId, status: 'CONFIRMED', startAt: { gte: start, lt: end } },
  });
  const byStart = new Map(counts.map(c => [c.startAt.getTime(), c._count._all]));
  return generateSlots(a, date).map(s => {
    const booked = byStart.get(s.startAt.getTime()) ?? 0;
    return { ...s, booked, capacity: a.capacity, available: Math.max(0, a.capacity - booked) };
  });
}

const bookingScope = (m: Member): Prisma.AmenityBookingWhereInput =>
  ({ societyId: m.societyId, ...(m.role === 'RESIDENT' && { flatId: m.flatId! }) });

export async function listBookings(m: Member, q: ListBookingsQuery) {
  const range = q.date ? istDayRange(q.date) : null;
  const rows = await prisma.amenityBooking.findMany({
    where: {
      ...bookingScope(m), amenityId: q.amenityId, status: q.status,
      ...(range && { startAt: { gte: range.start, lt: range.end } }),
    },
    include: bookingInclude, orderBy: { startAt: 'desc' }, take: q.limit,
  });
  return rows.map(bookingDTO);
}

export async function createBooking(m: Member, input: CreateBookingBody) {
  const flatId = m.role === 'RESIDENT' ? m.flatId! : input.flatId;
  if (!flatId) throw badRequest('flatId is required', [{ path: 'flatId', message: 'Required for ADMIN' }]);
  const a = await prisma.amenity.findFirst({ where: { id: input.amenityId, societyId: m.societyId } });
  if (!a) throw notFound('Amenity');
  if (m.role === 'ADMIN' && !(await prisma.flat.findFirst({ where: { id: flatId, societyId: m.societyId } }))) throw notFound('Flat');
  if (!a.isActive) throw unprocessable('AMENITY_INACTIVE', 'This amenity is not available for booking');
  const slot = generateSlots(a, istDateOf(input.startAt)).find(s => +s.startAt === +input.startAt);
  if (!slot) throw unprocessable('SLOT_INVALID', 'Not a valid slot for this amenity');
  if (slot.startAt <= new Date()) throw unprocessable('SLOT_IN_PAST', 'This slot has already started');

  for (let attempt = 1; ; attempt++) {
    try {
      const id = await prisma.$transaction(async tx => {
        const where = { amenityId: a.id, startAt: slot.startAt, status: 'CONFIRMED' as const };
        if (await tx.amenityBooking.findFirst({ where: { ...where, flatId }, select: { id: true } })) {
          throw conflict('CONFLICT', 'This flat already has this slot booked');
        }
        if ((await tx.amenityBooking.count({ where })) >= a.capacity) throw conflict('SLOT_FULL', 'This slot is full');
        const b = await tx.amenityBooking.create({
          data: { amenityId: a.id, societyId: m.societyId, flatId, bookedById: m.id, startAt: slot.startAt, endAt: slot.endAt, status: 'CONFIRMED' },
        });
        return b.id;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      return bookingDTO(await prisma.amenityBooking.findUniqueOrThrow({ where: { id }, include: bookingInclude }));
    } catch (e) {
      const retryable = e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2034';
      if (!retryable) throw e;
      if (attempt >= 3) throw new AppError(409, 'CONFLICT', 'Slot is busy, please retry');
    }
  }
}

export async function cancelBooking(m: Member, id: string) {
  const b = await prisma.amenityBooking.findFirst({ where: { id, ...bookingScope(m) } });
  if (!b) throw notFound('Booking');
  if (b.status !== 'CONFIRMED') throw invalidTransition(b.status, 'CANCELLED');
  if (b.startAt <= new Date()) throw unprocessable('SLOT_IN_PAST', 'This booking has already started');
  const r = await prisma.amenityBooking.updateMany({ where: { id, status: 'CONFIRMED' }, data: { status: 'CANCELLED' } });
  if (!r.count) throw invalidTransition('CANCELLED', 'CANCELLED');
  return bookingDTO(await prisma.amenityBooking.findUniqueOrThrow({ where: { id }, include: bookingInclude }));
}
