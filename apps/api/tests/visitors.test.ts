import { beforeAll, describe, it, expect } from 'vitest';
import { prisma } from '../src/db.js';
import { flushNotifications } from '../src/events.js';
import { expireStale } from '../src/modules/visitors/visitors.service.js';
import { createSociety } from './helpers.js';

let s: Awaited<ReturnType<typeof createSociety>>;
beforeAll(async () => { s = await createSociety(); });

const walkIn = (type = 'GUEST', flatId = s.flats.A101, extra: object = {}) =>
  s.guard.post('/visitors', { flatId, type, name: 'Swift Parcel', ...extra });

describe('TC-VIS-02 guard logs a walk-in', () => {
  it('creates PENDING_APPROVAL with expiresAt, uppercased vehicle and notifies the flat', async () => {
    const r = await walkIn('DELIVERY', s.flats.A101, { vehicleNo: 'ka01ab1234', status: 'APPROVED' });
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({
      status: 'PENDING_APPROVAL', vehicleNo: 'KA01AB1234', decidedBy: null, preApprovalId: null,
      flat: { id: s.flats.A101, number: '101', blockName: 'A', label: 'A-101' },
      loggedBy: { id: s.guardM.membershipId },
    });
    expect(Date.parse(r.body.expiresAt) - Date.parse(r.body.createdAt)).toBe(10 * 60_000);
    await flushNotifications();
    const notes = await prisma.notification.findMany({ where: { data: { path: ['visitorId'], equals: r.body.id } } });
    expect(notes.map(n => n.userId)).toEqual([s.rohanM.userId]);
    expect(notes[0].type).toBe('VISITOR_REQUESTED');
  });

  it('resident cannot log a walk-in', async () => {
    expect((await s.rohan.post('/visitors', { flatId: s.flats.A101, type: 'GUEST', name: 'x' })).status).toBe(403);
  });
});

describe('TC-VIS-03/05/06 full lifecycle walk-in -> approve -> check-in -> check-out', () => {
  it('walks every state', async () => {
    const id = (await walkIn()).body.id;
    expect((await s.guard.post(`/visitors/${id}/check-in`)).body.error.details).toEqual({ from: 'PENDING_APPROVAL', to: 'CHECKED_IN' });
    const a = await s.rohan.post(`/visitors/${id}/decision`, { decision: 'APPROVE' });
    expect(a.status).toBe(200);
    expect(a.body).toMatchObject({ status: 'APPROVED', decidedBy: { id: s.rohanM.membershipId }, expiresAt: null });
    expect(a.body.decidedAt).toBeTruthy();
    expect((await s.rohan.post(`/visitors/${id}/check-in`)).status).toBe(403);
    const ci = await s.guard.post(`/visitors/${id}/check-in`);
    expect(ci.body).toMatchObject({ status: 'CHECKED_IN' });
    expect(ci.body.checkInAt).toBeTruthy();
    const co = await s.guard.post(`/visitors/${id}/check-out`);
    expect(co.body).toMatchObject({ status: 'CHECKED_OUT' });
    expect(co.body.checkOutAt).toBeTruthy();
    const again = await s.guard.post(`/visitors/${id}/check-out`);
    expect(again.status).toBe(422);
    expect(again.body.error).toMatchObject({ code: 'INVALID_TRANSITION', details: { from: 'CHECKED_OUT', to: 'CHECKED_OUT' } });
  });
});

describe('TC-VIS-11 deny', () => {
  it('denied visitors cannot be checked in', async () => {
    const id = (await walkIn()).body.id;
    expect((await s.rohan.post(`/visitors/${id}/decision`, { decision: 'DENY' })).body.status).toBe('DENIED');
    const r = await s.guard.post(`/visitors/${id}/check-in`);
    expect(r.status).toBe(422);
    expect(r.body.error.code).toBe('INVALID_TRANSITION');
  });
});

describe('TC-VIS-04/07 LEAVE_AT_GATE only for DELIVERY, then collect', () => {
  it('GUEST -> 422, DELIVERY -> LEFT_AT_GATE -> COLLECTED', async () => {
    const guest = (await walkIn('GUEST')).body.id;
    const bad = await s.rohan.post(`/visitors/${guest}/decision`, { decision: 'LEAVE_AT_GATE' });
    expect(bad.status).toBe(422);
    expect(bad.body.error).toMatchObject({ code: 'INVALID_TRANSITION', details: { from: 'PENDING_APPROVAL', to: 'LEFT_AT_GATE' } });

    const parcel = (await walkIn('DELIVERY')).body.id;
    expect((await s.rohan.post(`/visitors/${parcel}/decision`, { decision: 'LEAVE_AT_GATE' })).body.status).toBe('LEFT_AT_GATE');
    expect((await s.priya.post(`/visitors/${parcel}/collect`)).status).toBe(404);
    expect((await s.admin.post(`/visitors/${parcel}/collect`)).status).toBe(403);
    const c = await s.rohan.post(`/visitors/${parcel}/collect`);
    expect(c.body.status).toBe('COLLECTED');
    expect(c.body.checkOutAt).toBeTruthy();
  });
});

describe('TC-VIS-09 decisions by the flat only; first decision wins', () => {
  it('other flat -> 404, admin/guard -> 403, concurrent -> one 200', async () => {
    const id = (await walkIn()).body.id;
    expect((await s.priya.post(`/visitors/${id}/decision`, { decision: 'APPROVE' })).status).toBe(404);
    expect((await s.admin.post(`/visitors/${id}/decision`, { decision: 'APPROVE' })).status).toBe(403);
    const second = await s.addMember('RESIDENT', { flatId: s.flats.A101 });
    const [r1, r2] = await Promise.all([
      s.rohan.post(`/visitors/${id}/decision`, { decision: 'APPROVE' }),
      second.client.post(`/visitors/${id}/decision`, { decision: 'DENY' }),
    ]);
    expect([r1.status, r2.status].sort()).toEqual([200, 422]);
  });
});

describe('TC-VIS-08 expiry', () => {
  it('stale pending: decide -> 422 from EXPIRED; list shows EXPIRED; sweeper leaves fresh rows', async () => {
    const stale = (await walkIn()).body.id;
    const fresh = (await walkIn()).body.id;
    await prisma.visitor.update({ where: { id: stale }, data: { createdAt: new Date(Date.now() - 11 * 60_000) } });
    await prisma.visitor.update({ where: { id: fresh }, data: { createdAt: new Date(Date.now() - 9 * 60_000) } });
    const r = await s.rohan.post(`/visitors/${stale}/decision`, { decision: 'APPROVE' });
    expect(r.status).toBe(422);
    expect(r.body.error.details).toEqual({ from: 'EXPIRED', to: 'APPROVED' });

    const stale2 = (await walkIn()).body.id;
    await prisma.visitor.update({ where: { id: stale2 }, data: { createdAt: new Date(Date.now() - 11 * 60_000) } });
    expect(await expireStale(s.societyId)).toBe(1);
    const list = (await s.guard.get('/visitors?limit=200')).body.items as { id: string; status: string }[];
    expect(list.find(v => v.id === stale2)!.status).toBe('EXPIRED');
    expect(list.find(v => v.id === fresh)!.status).toBe('PENDING_APPROVAL');
  });
});

describe('TC-VIS-01 listing', () => {
  it('resident sees own flat only; filters work', async () => {
    await walkIn('GUEST', s.flats.B201);
    const mine = (await s.rohan.get(`/visitors?flatId=${s.flats.B201}`)).body.items as { flat: { id: string } }[];
    expect(mine.length).toBeGreaterThan(0);
    expect(mine.every(v => v.flat.id === s.flats.A101)).toBe(true);
    const pending = (await s.guard.get('/visitors?status=PENDING_APPROVAL,APPROVED')).body.items as { status: string }[];
    expect(pending.every(v => ['PENDING_APPROVAL', 'APPROVED'].includes(v.status))).toBe(true);
    expect((await s.guard.get('/visitors?status=NOPE')).status).toBe(400);
    expect((await s.guard.get('/visitors?limit=0')).status).toBe(400);
  });
});
