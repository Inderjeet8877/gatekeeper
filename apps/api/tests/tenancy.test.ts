import { beforeAll, describe, it, expect } from 'vitest';
import { as, createSociety } from './helpers.js';

let s: Awaited<ReturnType<typeof createSociety>>;
let other: Awaited<ReturnType<typeof createSociety>>;

beforeAll(async () => {
  s = await createSociety();
  other = await createSociety();
});

describe('TC-TEN-01/02 tenancy header and membership', () => {
  it('missing X-Society-Id -> 400', async () => {
    const r = await as(s.rohanM.token).get('/visitors');
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('society without membership -> 403', async () => {
    const r = await as(s.rohanM.token, other.societyId).get('/society');
    expect(r.status).toBe(403);
    expect(r.body.error.code).toBe('FORBIDDEN');
  });

  it('TC-SOC-02 every member can read the society', async () => {
    for (const c of [s.admin, s.guard, s.rohan]) expect((await c.get('/society')).body.id).toBe(s.societyId);
  });
});

describe('TC-TEN-04 cross-tenant ids are 404', () => {
  it('other society notice / visitor / ticket', async () => {
    const notice = (await other.admin.post('/notices', { title: 'Theirs', body: 'x' })).body.id;
    const visitor = (await other.guard.post('/visitors', { flatId: other.flats.A101, type: 'GUEST', name: 'V' })).body.id;
    const ticket = (await other.rohan.post('/tickets', { title: 't', description: 'd', category: 'OTHER' })).body.id;
    expect((await s.admin.patch(`/notices/${notice}`, { title: 'Hijack' })).status).toBe(404);
    expect((await s.guard.post(`/visitors/${visitor}/check-in`)).status).toBe(404);
    expect((await s.admin.get(`/tickets/${ticket}`)).status).toBe(404);
    expect((await s.guard.post('/visitors', { flatId: other.flats.A101, type: 'GUEST', name: 'V' })).status).toBe(404);
  });
});

describe('TC-TEN-03 RBAC', () => {
  it('resident cannot create a notice; admin can', async () => {
    const r = await s.rohan.post('/notices', { title: 'Hi', body: 'x' });
    expect(r.status).toBe(403);
    expect(r.body.error.code).toBe('FORBIDDEN');
    const ok = await s.admin.post('/notices', { title: 'Hi', body: 'x', isPinned: true });
    expect(ok.status).toBe(201);
    expect(ok.body).toMatchObject({ title: 'Hi', isPinned: true, category: 'GENERAL', createdBy: { id: s.adminMembershipId } });
  });

  it('TC-SOC-07 members: guard needs flatId, resident forbidden', async () => {
    expect((await s.rohan.get('/members')).status).toBe(403);
    expect((await s.guard.get('/members')).status).toBe(403);
    const g = await s.guard.get(`/members?flatId=${s.flats.A101}`);
    expect(g.status).toBe(200);
    expect(g.body.items).toHaveLength(1);
    expect(g.body.items[0]).toMatchObject({ id: s.rohanM.membershipId, role: 'RESIDENT', flat: { id: s.flats.A101, number: '101', block: { name: 'A' } } });
    expect((await s.admin.get('/members')).body.items).toHaveLength(4);
  });

  it('TC-SOC-04/06 blocks and flats', async () => {
    expect((await s.admin.post('/blocks', { name: 'a' })).status).toBe(409);
    expect((await s.rohan.post('/blocks', { name: 'Z' })).status).toBe(403);
    const r = await s.admin.post('/flats/bulk', { blockId: s.blocks.A, numbers: ['102', '103', '103'] });
    expect(r.status).toBe(201);
    expect(r.body.skipped).toEqual(['102']);
    expect(r.body.items.map((f: { label: string }) => f.label)).toEqual(['A-103']);
    expect((await s.admin.post('/flats/bulk', { blockId: other.blocks.A, numbers: ['9'] })).status).toBe(404);
    const flats = await s.rohan.get('/flats');
    expect(flats.body.items.map((f: { label: string }) => f.label)).toEqual(['A-101', 'A-102', 'A-103', 'B-201']);
    expect(flats.body.items[0].residentCount).toBe(1);
  });

  it('TC-SOC-08/09 add member conflicts, LAST_ADMIN, deactivation -> 403', async () => {
    expect((await s.admin.post('/members', { phone: '9811111111', name: 'X', role: 'RESIDENT' })).status).toBe(400);
    expect((await s.admin.post('/members', { phone: '9811111111', name: 'X', role: 'GUARD', flatId: s.flats.A101 })).status).toBe(400);
    const last = await s.admin.patch(`/members/${s.adminMembershipId}`, { role: 'RESIDENT' });
    expect(last.status).toBe(422);
    expect((await s.admin.patch(`/members/${s.adminMembershipId}`, { status: 'INACTIVE' })).body.error.code).toBe('LAST_ADMIN');
    const extra = await s.addMember('RESIDENT', { flatId: s.flats.A102 });
    expect((await s.admin.patch(`/members/${extra.membershipId}`, { status: 'INACTIVE' })).status).toBe(200);
    expect((await extra.client.get('/visitors')).status).toBe(403); // TC-TEN-05
  });
});

describe('TC-POLL-01/03/05 polls', () => {
  it('vote once; second vote ALREADY_VOTED; admin cannot vote', async () => {
    const p = await s.admin.post('/polls', { question: 'EV chargers?', options: ['Yes', 'No', 'Maybe'] });
    expect(p.status).toBe(201);
    expect(p.body.options.map((o: { text: string }) => o.text)).toEqual(['Yes', 'No', 'Maybe']);
    const yes = p.body.options[0].id;
    const v = await s.rohan.post(`/polls/${p.body.id}/vote`, { optionId: yes });
    expect(v.status).toBe(200);
    expect(v.body).toMatchObject({ totalVotes: 1, myVoteOptionId: yes, isClosed: false });
    expect(v.body.options[0].votes).toBe(1);
    const again = await s.rohan.post(`/polls/${p.body.id}/vote`, { optionId: p.body.options[1].id });
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('ALREADY_VOTED');
    expect((await s.admin.post(`/polls/${p.body.id}/vote`, { optionId: yes })).status).toBe(403);
    const list = await s.priya.get('/polls');
    expect(list.body.items.find((x: { id: string }) => x.id === p.body.id).myVoteOptionId).toBeNull();
  });

  it('TC-POLL-02 validation', async () => {
    expect((await s.admin.post('/polls', { question: 'Q', options: ['One'] })).status).toBe(400);
    expect((await s.admin.post('/polls', { question: 'Q', options: ['a', 'A'] })).status).toBe(400);
    expect((await s.admin.post('/polls', { question: 'Q', options: ['a', 'b'], closesAt: '2000-01-01T00:00:00.000Z' })).status).toBe(400);
  });
});
