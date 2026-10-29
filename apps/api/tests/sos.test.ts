import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, it, expect } from 'vitest';
import { prisma } from '../src/db.js';
import { flushNotifications } from '../src/events.js';
import { app, createSociety } from './helpers.js';

let s: Awaited<ReturnType<typeof createSociety>>;
let server: http.Server;
let base: string;

beforeAll(async () => {
  s = await createSociety();
  server = app.listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`;
});
afterAll(() => { server.closeAllConnections(); server.close(); });

/** Opens an SSE stream and collects raw text until closed. */
function stream(token: string, societyId: string) {
  let text = '';
  let status = 0;
  let headers: http.IncomingHttpHeaders = {};
  let close = () => {};
  const ready = new Promise<void>(resolve => {
    const req = http.get(`${base}/events?token=${token}&societyId=${societyId}`, res => {
      status = res.statusCode!;
      headers = res.headers;
      res.setEncoding('utf8');
      res.on('data', d => { text += d; if (text.includes(': connected')) resolve(); });
      res.on('end', () => resolve());
    });
    close = () => req.destroy();
  });
  return { ready, text: () => text, status: () => status, headers: () => headers, close: () => close() };
}

const until = async (fn: () => boolean, ms = 3000) => {
  for (const t0 = Date.now(); !fn(); ) {
    if (Date.now() - t0 > ms) throw new Error('timeout waiting for condition');
    await new Promise(r => setTimeout(r, 20));
  }
};

describe('TC-NTF-04 SSE handshake', () => {
  it('rejects bad params before opening the stream', async () => {
    const get = (q: string) => fetch(`${base}/events${q}`).then(r => r.status);
    expect(await get('')).toBe(400);
    expect(await get(`?token=bad&societyId=${s.societyId}`)).toBe(401);
    const outsider = await createSociety();
    expect(await get(`?token=${outsider.adminToken}&societyId=${s.societyId}`)).toBe(403);
  });
});

describe('TC-SOS-01/03/04 raise -> acknowledge -> resolve', () => {
  it('walks the state machine and fans out to the right streams', async () => {
    const guardS = stream(s.guardM.token, s.societyId);
    const rohanS = stream(s.rohanM.token, s.societyId);
    const priyaS = stream(s.priyaM.token, s.societyId);
    await Promise.all([guardS.ready, rohanS.ready, priyaS.ready]);
    expect(guardS.status()).toBe(200);
    expect(guardS.headers()['content-type']).toContain('text/event-stream');

    expect((await s.guard.post('/sos', { type: 'MEDICAL' })).status).toBe(403);
    expect((await s.rohan.post('/sos', { type: 'FLOOD' })).status).toBe(400);
    const raised = await s.rohan.post('/sos', { type: 'MEDICAL', message: 'Fall' });
    expect(raised.status).toBe(201);
    expect(raised.body).toMatchObject({
      status: 'RAISED', type: 'MEDICAL', message: 'Fall', flat: { label: 'A-101' },
      raisedBy: { id: s.rohanM.membershipId, phone: expect.any(String) }, acknowledgedBy: null, acknowledgedAt: null, resolvedAt: null,
    });
    const id = raised.body.id;
    await until(() => guardS.text().includes('event: sos.raised') && rohanS.text().includes('event: sos.raised'));

    expect((await s.rohan.patch(`/sos/${id}`, { status: 'ACKNOWLEDGED' })).status).toBe(403);
    const ack = await s.guard.patch(`/sos/${id}`, { status: 'ACKNOWLEDGED' });
    expect(ack.body).toMatchObject({ status: 'ACKNOWLEDGED', acknowledgedBy: { id: s.guardM.membershipId } });
    expect(ack.body.acknowledgedAt).toBeTruthy();
    await until(() => rohanS.text().includes('event: sos.updated'));

    const res = await s.guard.patch(`/sos/${id}`, { status: 'RESOLVED' });
    expect(res.body.status).toBe('RESOLVED');
    expect(res.body.resolvedAt).toBeTruthy();
    const back = await s.guard.patch(`/sos/${id}`, { status: 'ACKNOWLEDGED' });
    expect(back.status).toBe(422);
    expect(back.body.error).toMatchObject({ code: 'INVALID_TRANSITION', details: { from: 'RESOLVED', to: 'ACKNOWLEDGED' } });

    await flushNotifications();
    await until(() => guardS.text().includes('event: notification'));
    expect(priyaS.text()).not.toContain('sos.');
    for (const x of [guardS, rohanS, priyaS]) x.close();

    const guardNotes = await prisma.notification.findMany({ where: { userId: s.guardM.userId, type: 'SOS_RAISED' } });
    expect(guardNotes).toHaveLength(1);
  });

  it('RAISED -> RESOLVED directly fills acknowledgement; resident sees own alerts only', async () => {
    const id = (await s.rohan.post('/sos', { type: 'FIRE' })).body.id;
    const r = await s.admin.patch(`/sos/${id}`, { status: 'RESOLVED' });
    expect(r.body).toMatchObject({ status: 'RESOLVED', acknowledgedBy: { id: s.adminMembershipId } });
    expect((await s.priya.get('/sos')).body.items).toHaveLength(0);
    expect((await s.rohan.get('/sos')).body.items).toHaveLength(2);
    expect((await s.guard.get('/sos?status=RAISED,ACKNOWLEDGED')).body.items).toHaveLength(0);
  });
});

describe('TC-VIS-02 SSE visitor.requested reaches only the flat', () => {
  it('rohan receives, priya does not', async () => {
    const rohanS = stream(s.rohanM.token, s.societyId);
    const priyaS = stream(s.priyaM.token, s.societyId);
    await Promise.all([rohanS.ready, priyaS.ready]);
    await s.guard.post('/visitors', { flatId: s.flats.A101, type: 'DELIVERY', name: 'Parcel' });
    await until(() => rohanS.text().includes('event: visitor.requested'));
    await new Promise(r => setTimeout(r, 100));
    expect(priyaS.text()).not.toContain('visitor.requested');
    rohanS.close(); priyaS.close();
  });
});

describe('TC-NTF-01/02/03 notifications inbox', () => {
  it('lists, reads, read-all', async () => {
    await flushNotifications();
    const list = await s.rohan.get('/notifications');
    expect(list.status).toBe(200);
    expect(list.body.unreadCount).toBeGreaterThan(0);
    const first = list.body.items[0];
    expect(first).toMatchObject({ readAt: null, societyId: s.societyId, data: { societyId: s.societyId } });
    const read = await s.rohan.post(`/notifications/${first.id}/read`);
    expect(read.body.readAt).toBeTruthy();
    expect((await s.rohan.post(`/notifications/${first.id}/read`)).body.readAt).toBe(read.body.readAt);
    expect((await s.priya.post(`/notifications/${first.id}/read`)).status).toBe(404);
    const all = await s.rohan.post('/notifications/read-all');
    expect(all.body.updated).toBe(list.body.unreadCount - 1);
    expect((await s.rohan.get('/notifications?unread=true')).body).toEqual({ items: [], unreadCount: 0 });
  });
});
