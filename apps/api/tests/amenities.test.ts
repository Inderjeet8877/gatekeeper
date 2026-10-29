import { beforeAll, describe, it, expect } from 'vitest';
import { generateSlots } from '../src/modules/amenities/amenities.service.js';
import { currentPeriod, istDateOf, istDateTimeToUtc, istDayRange } from '../src/lib/time.js';
import { createSociety } from './helpers.js';

describe('time + slot helpers (unit)', () => {
  it('TC-SYS-04 IST day range and helpers', () => {
    expect(istDayRange('2026-01-02')).toEqual({ start: new Date('2026-01-01T18:30:00.000Z'), end: new Date('2026-01-02T18:30:00.000Z') });
    expect(istDateOf(new Date('2026-01-01T20:00:00Z'))).toBe('2026-01-02');
    expect(currentPeriod(new Date('2026-01-31T19:00:00Z'))).toBe('2026-02');
  });

  it('TC-AMN-04 generateSlots drops the trailing partial slot', () => {
    const slots = generateSlots({ openTime: '06:00', closeTime: '07:30', slotMinutes: 45 }, '2026-11-02');
    expect(slots.map(x => x.startAt.toISOString())).toEqual(['2026-11-02T00:30:00.000Z', '2026-11-02T01:15:00.000Z']);
    expect(generateSlots({ openTime: '06:00', closeTime: '22:00', slotMinutes: 60 }, '2026-11-02')).toHaveLength(16);
  });
});

let s: Awaited<ReturnType<typeof createSociety>>;
const tomorrow = () => istDateOf(new Date(Date.now() + 86_400_000));

beforeAll(async () => { s = await createSociety(); });

describe('TC-AMN-01/02 amenities', () => {
  it('validation, duplicate name, inactive hidden from residents', async () => {
    const base = { name: 'Court', openTime: '06:00', closeTime: '22:00', slotMinutes: 60, capacity: 2 };
    expect((await s.admin.post('/amenities', { ...base, openTime: '22:00', closeTime: '06:00' })).status).toBe(400);
    expect((await s.admin.post('/amenities', { ...base, slotMinutes: 10 })).status).toBe(400);
    expect((await s.admin.post('/amenities', { ...base, pricePerSlot: 99.5 })).status).toBe(400);
    expect((await s.admin.post('/amenities', { ...base, capacity: 0 })).status).toBe(400);
    expect((await s.rohan.post('/amenities', base)).status).toBe(403);
    const ok = await s.admin.post('/amenities', base);
    expect(ok.status).toBe(201);
    expect(ok.body).toMatchObject({ name: 'Court', pricePerSlot: 0, isActive: true, description: null });
    expect((await s.admin.post('/amenities', { ...base, name: 'court' })).status).toBe(409);
    const pool = (await s.admin.post('/amenities', { ...base, name: 'Pool', isActive: false })).body;
    expect((await s.rohan.get('/amenities')).body.items.map((a: { name: string }) => a.name)).toEqual(['Court']);
    expect((await s.admin.get('/amenities')).body.items).toHaveLength(2);
    const inactive = await s.rohan.post('/bookings', { amenityId: pool.id, startAt: istDateTimeToUtc(tomorrow(), '07:00').toISOString() });
    expect(inactive.body.error.code).toBe('AMENITY_INACTIVE');
    expect((await s.rohan.get(`/amenities/${pool.id}/availability?date=${tomorrow()}`)).status).toBe(404);
  });
});

describe('TC-BKG-01/02 booking rules and capacity', () => {
  it('books up to capacity then SLOT_FULL', async () => {
    const a = (await s.admin.post('/amenities', { name: 'Tennis', openTime: '06:00', closeTime: '22:00', slotMinutes: 60, capacity: 2 })).body;
    const startAt = istDateTimeToUtc(tomorrow(), '07:00').toISOString();
    const b1 = await s.rohan.post('/bookings', { amenityId: a.id, startAt });
    expect(b1.status).toBe(201);
    expect(b1.body).toMatchObject({ status: 'CONFIRMED', amenity: { id: a.id, name: 'Tennis' }, flat: { label: 'A-101' } });
    expect(Date.parse(b1.body.endAt) - Date.parse(b1.body.startAt)).toBe(3_600_000);

    const dup = await s.rohan.post('/bookings', { amenityId: a.id, startAt });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('CONFLICT');
    expect((await s.priya.post('/bookings', { amenityId: a.id, startAt })).status).toBe(201);
    const full = await s.admin.post('/bookings', { amenityId: a.id, startAt, flatId: s.flats.A102 });
    expect(full.status).toBe(409);
    expect(full.body.error.code).toBe('SLOT_FULL');

    const avail = await s.rohan.get(`/amenities/${a.id}/availability?date=${tomorrow()}`);
    expect(avail.body.items).toHaveLength(16);
    expect(avail.body.items.find((x: { startAt: string }) => x.startAt === startAt)).toMatchObject({ booked: 2, capacity: 2, available: 0 });

    const misaligned = istDateTimeToUtc(tomorrow(), '07:15').toISOString();
    expect((await s.rohan.post('/bookings', { amenityId: a.id, startAt: misaligned })).body.error.code).toBe('SLOT_INVALID');
    const past = istDateTimeToUtc(istDateOf(new Date(Date.now() - 86_400_000)), '07:00').toISOString();
    expect((await s.rohan.post('/bookings', { amenityId: a.id, startAt: past })).body.error.code).toBe('SLOT_IN_PAST');

    // TC-BKG-04 cancel frees the slot
    expect((await s.priya.delete(`/bookings/${b1.body.id}`)).status).toBe(404);
    expect((await s.rohan.delete(`/bookings/${b1.body.id}`)).body.status).toBe('CANCELLED');
    expect((await s.rohan.delete(`/bookings/${b1.body.id}`)).status).toBe(422);
    expect((await s.admin.post('/bookings', { amenityId: a.id, startAt, flatId: s.flats.A102 })).status).toBe(201);
  });

  it('concurrent bookings never exceed capacity', async () => {
    const a = (await s.admin.post('/amenities', { name: 'Clubhouse', openTime: '09:00', closeTime: '22:00', slotMinutes: 60, capacity: 1 })).body;
    const startAt = istDateTimeToUtc(tomorrow(), '10:00').toISOString();
    const rs = await Promise.all([s.flats.A101, s.flats.A102, s.flats.B201].map(flatId =>
      s.admin.post('/bookings', { amenityId: a.id, startAt, flatId })));
    expect(rs.filter(r => r.status === 201)).toHaveLength(1);
    expect(rs.filter(r => r.status === 409)).toHaveLength(2);
  });

  it('guard cannot book', async () => {
    expect((await s.guard.get('/bookings')).status).toBe(403);
  });
});
