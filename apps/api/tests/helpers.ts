import { randomInt } from 'node:crypto';
import request from 'supertest';
import { createApp } from '../src/app.js';

export const app = createApp();
export const api = () => request(app);

/** Random test phone in the 98xxxxxxxx range (10-plan §4.3); unique across runs without wiping the DB. */
export const newPhone = () => `98${String(randomInt(0, 100_000_000)).padStart(8, '0')}`;

export async function login(phone: string, name = `User ${phone.slice(-4)}`) {
  const r1 = await api().post('/api/v1/auth/otp/request').send({ phone });
  if (r1.status !== 200) throw new Error(`otp request ${r1.status} ${JSON.stringify(r1.body)}`);
  const r2 = await api().post('/api/v1/auth/otp/verify').send({ phone, code: r1.body.devCode, name });
  if (r2.status !== 200) throw new Error(`otp verify ${r2.status} ${JSON.stringify(r2.body)}`);
  return r2.body as { token: string; user: { id: string; name: string }; memberships: { id: string; society: { id: string } }[] };
}

/** supertest calls with Bearer + X-Society-Id preset. */
export function as(token: string, societyId?: string) {
  const wrap = (t: request.Test) => {
    t.set('Authorization', `Bearer ${token}`);
    if (societyId) t.set('X-Society-Id', societyId);
    return t;
  };
  const p = (path: string) => `/api/v1${path}`;
  return {
    get: (path: string) => wrap(api().get(p(path))),
    post: (path: string, body: object = {}) => wrap(api().post(p(path))).send(body),
    patch: (path: string, body: object = {}) => wrap(api().patch(p(path))).send(body),
    delete: (path: string) => wrap(api().delete(p(path))),
  };
}

export type Client = ReturnType<typeof as>;

/**
 * Factory: a fresh society with blocks A/B, flats A-101, A-102, B-201, an admin, a guard,
 * resident `rohan` (A-101) and resident `priya` (B-201). Every call is independent.
 */
export async function createSociety() {
  const adminLogin = await login(newPhone(), 'Admin');
  const s = await as(adminLogin.token).post('/societies', {
    name: 'Test Heights', addressLine: '1 Test Rd', city: 'Bengaluru', state: 'Karnataka', pincode: '560001',
  });
  if (s.status !== 201) throw new Error(`create society ${s.status} ${JSON.stringify(s.body)}`);
  const societyId: string = s.body.society.id;
  const admin = as(adminLogin.token, societyId);

  const blockA = (await admin.post('/blocks', { name: 'A' })).body.id as string;
  const blockB = (await admin.post('/blocks', { name: 'B' })).body.id as string;
  const fa = (await admin.post('/flats/bulk', { blockId: blockA, numbers: ['101', '102'] })).body.items;
  const fb = (await admin.post('/flats/bulk', { blockId: blockB, numbers: ['201'] })).body.items;
  const flats = { A101: fa[0].id as string, A102: fa[1].id as string, B201: fb[0].id as string };

  const addMember = async (role: string, extra: object = {}) => {
    const phone = newPhone();
    const r = await admin.post('/members', { phone, name: `${role} ${phone.slice(-4)}`, role, ...extra });
    if (r.status !== 201) throw new Error(`add member ${r.status} ${JSON.stringify(r.body)}`);
    const l = await login(phone);
    return { client: as(l.token, societyId), token: l.token, membershipId: r.body.id as string, userId: l.user.id };
  };
  const guard = await addMember('GUARD');
  const rohan = await addMember('RESIDENT', { flatId: flats.A101 });
  const priya = await addMember('RESIDENT', { flatId: flats.B201 });
  return {
    societyId, flats, blocks: { A: blockA, B: blockB },
    admin, adminToken: adminLogin.token, adminMembershipId: s.body.membership.id as string,
    guard: guard.client, guardM: guard, rohan: rohan.client, rohanM: rohan, priya: priya.client, priyaM: priya,
    addMember,
  };
}
