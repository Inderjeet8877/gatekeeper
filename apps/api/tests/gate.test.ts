import { beforeAll, describe, it, expect } from 'vitest';
import { prisma } from '../src/db.js';
import { createSociety } from './helpers.js';

let s: Awaited<ReturnType<typeof createSociety>>;
beforeAll(async () => { s = await createSociety(); });

const verify = (passcode: string) => s.guard.post('/gate/verify', { passcode });

describe('TC-PRE-01 resident creates a pre-approval', () => {
  it('201 with a 6-digit passcode; window rules -> 400', async () => {
    const r = await s.rohan.post('/preapprovals', { guestName: 'Asha', guestPhone: '9811122233' });
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({
      type: 'GUEST', status: 'ACTIVE', usedCount: 0, maxUses: 1, passcode: expect.stringMatching(/^\d{6}$/),
      flat: { label: 'A-101' }, createdBy: { id: s.rohanM.membershipId },
    });
    const from = new Date(Date.now() + 3_600_000);
    expect((await s.rohan.post('/preapprovals', { guestName: 'A', validFrom: from.toISOString(), validTo: from.toISOString() })).status).toBe(400);
    expect((await s.rohan.post('/preapprovals', { guestName: 'A', validTo: new Date(Date.now() + 31 * 86_400_000).toISOString() })).status).toBe(400);
    expect((await s.rohan.post('/preapprovals', { guestName: 'A', maxUses: 0 })).status).toBe(400);
    expect((await s.guard.post('/preapprovals', { guestName: 'A' })).status).toBe(403);
  });
});

describe('TC-GATE-01 / TC-PRE-05 verify pre-approval passcode', () => {
  it('creates a CHECKED_IN visitor; USED after maxUses; then PASSCODE_INVALID', async () => {
    const pa = (await s.rohan.post('/preapprovals', { guestName: 'Kavya', maxUses: 2 })).body;
    const r1 = await verify(pa.passcode);
    expect(r1.status).toBe(200);
    expect(r1.body.kind).toBe('VISITOR');
    expect(r1.body.visitor).toMatchObject({
      status: 'CHECKED_IN', name: 'Kavya', preApprovalId: pa.id, flat: { id: s.flats.A101 },
      loggedBy: { id: s.guardM.membershipId }, decidedBy: { id: s.rohanM.membershipId }, expiresAt: null,
    });
    expect(r1.body.visitor.checkInAt).toBeTruthy();
    expect((await verify(pa.passcode)).body.kind).toBe('VISITOR');
    const row = await prisma.preApproval.findUniqueOrThrow({ where: { id: pa.id } });
    expect(row).toMatchObject({ usedCount: 2, status: 'USED' });
    const third = await verify(pa.passcode);
    expect(third.status).toBe(404);
    expect(third.body.error).toMatchObject({ code: 'PASSCODE_INVALID', details: { reason: 'NOT_FOUND' } });
  });

  it('NOT_YET_VALID and EXPIRED reasons', async () => {
    const future = new Date(Date.now() + 86_400_000).toISOString();
    const later = (await s.rohan.post('/preapprovals', { guestName: 'Tomorrow', validFrom: future })).body;
    expect((await verify(later.passcode)).body.error.details).toEqual({ reason: 'NOT_YET_VALID' });

    const old = (await s.rohan.post('/preapprovals', { guestName: 'Old' })).body;
    await prisma.preApproval.update({ where: { id: old.id }, data: { validTo: new Date(Date.now() - 1000) } });
    expect((await verify(old.passcode)).body.error.details).toEqual({ reason: 'EXPIRED' });
    expect((await prisma.preApproval.findUniqueOrThrow({ where: { id: old.id } })).status).toBe('EXPIRED');
  });

  it('TC-PRE-04 cancelled passcode stops working; cancel twice -> 422', async () => {
    const pa = (await s.rohan.post('/preapprovals', { guestName: 'Cancel me' })).body;
    expect((await s.priya.delete(`/preapprovals/${pa.id}`)).status).toBe(404);
    expect((await s.rohan.delete(`/preapprovals/${pa.id}`)).body.status).toBe('CANCELLED');
    expect((await verify(pa.passcode)).status).toBe(404);
    expect((await s.rohan.delete(`/preapprovals/${pa.id}`)).status).toBe(422);
  });

  it('TC-PRE-03 visibility: resident own flat, admin all, guard active-today without passcode', async () => {
    await s.priya.post('/preapprovals', { guestName: 'Priya guest' });
    const rohan = (await s.rohan.get('/preapprovals')).body.items as { flat: { label: string } }[];
    expect(rohan.every(p => p.flat.label === 'A-101')).toBe(true);
    const admin = (await s.admin.get('/preapprovals')).body.items as { flat: { label: string } }[];
    expect(new Set(admin.map(p => p.flat.label))).toEqual(new Set(['A-101', 'B-201']));
    const guard = (await s.guard.get('/preapprovals')).body.items as { status: string; passcode: string | null; guestName: string }[];
    expect(guard.length).toBeGreaterThan(0);
    expect(guard.every(p => p.status === 'ACTIVE' && p.passcode === null)).toBe(true);
    expect(guard.some(p => p.guestName === 'Tomorrow')).toBe(false); // starts tomorrow: not expected today
    expect(guard.some(p => p.guestName === 'Priya guest')).toBe(true);
  });
});

describe('TC-GATE-02 staff passcode toggles attendance', () => {
  it('CHECK_IN then CHECK_OUT; passcode only visible to admin', async () => {
    const st = await s.admin.post('/staff', { name: 'Lakshmi', category: 'MAID', flatIds: [s.flats.A101] });
    expect(st.status).toBe(201);
    expect(st.body.passcode).toMatch(/^\d{6}$/);
    expect((await s.rohan.get('/staff')).body.items[0].passcode).toBeNull();

    const r1 = await verify(st.body.passcode);
    expect(r1.body).toMatchObject({ kind: 'STAFF', action: 'CHECK_IN', staff: { id: st.body.id, isInside: true, passcode: null } });
    expect(r1.body.attendance).toMatchObject({ checkOutAt: null, loggedBy: { id: s.guardM.membershipId }, staff: { name: 'Lakshmi' } });
    const r2 = await verify(st.body.passcode);
    expect(r2.body).toMatchObject({ kind: 'STAFF', action: 'CHECK_OUT', staff: { isInside: false } });
    expect(r2.body.attendance.id).toBe(r1.body.attendance.id);
    expect(r2.body.attendance.checkOutAt).toBeTruthy();
    expect((await s.rohan.get(`/staff/${st.body.id}/attendance`)).body.items).toHaveLength(1);

    await s.admin.patch(`/staff/${st.body.id}`, { isActive: false });
    expect((await verify(st.body.passcode)).body.error.details).toEqual({ reason: 'NOT_FOUND' });
  });

  it('TC-STF-04 resident links staff to own flat only', async () => {
    const st = (await s.admin.post('/staff', { name: 'Cook', category: 'COOK' })).body;
    expect((await s.rohan.post(`/staff/${st.id}/flats`, { flatId: s.flats.B201 })).status).toBe(403);
    expect((await s.rohan.post(`/staff/${st.id}/flats`, { flatId: s.flats.A101 })).body.flats).toHaveLength(1);
    expect((await s.rohan.post(`/staff/${st.id}/flats`, { flatId: s.flats.A101 })).body.flats).toHaveLength(1);
    expect((await s.guard.post(`/staff/${st.id}/flats`, { flatId: s.flats.A101 })).status).toBe(403);
  });
});

describe('TC-GATE-03/05 invalid input and roles', () => {
  it('unknown passcode -> 404 NOT_FOUND; bad format -> 400; non-guards -> 403', async () => {
    const r = await verify('000000');
    if (r.status === 200) return; // astronomically unlikely collision with a generated code
    expect(r.status).toBe(404);
    expect(r.body.error).toMatchObject({ code: 'PASSCODE_INVALID', details: { reason: 'NOT_FOUND' } });
    expect((await verify('12345')).status).toBe(400);
    expect((await s.rohan.post('/gate/verify', { passcode: '000000' })).status).toBe(403);
    expect((await s.admin.post('/gate/verify', { passcode: '000000' })).status).toBe(403);
  });
});
