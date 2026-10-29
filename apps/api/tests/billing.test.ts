import { beforeAll, describe, it, expect } from 'vitest';
import { prisma } from '../src/db.js';
import { currentPeriod, istDateOf } from '../src/lib/time.js';
import { createSociety } from './helpers.js';

let s: Awaited<ReturnType<typeof createSociety>>;
beforeAll(async () => { s = await createSociety(); });

const P = currentPeriod();
const due = istDateOf(new Date(Date.now() + 7 * 86_400_000));

describe('TC-BIL-02 generate invoices is idempotent', () => {
  it('creates one per flat, then skips; new flats picked up', async () => {
    const r1 = await s.admin.post('/invoices/generate', { period: P, amount: 350000, dueDate: due });
    expect(r1.status).toBe(201);
    expect(r1.body).toEqual({ created: 3, skipped: 0 });
    expect((await s.admin.post('/invoices/generate', { period: P, amount: 999, dueDate: due })).body).toEqual({ created: 0, skipped: 3 });
    await s.admin.post('/flats/bulk', { blockId: s.blocks.B, numbers: ['202'] });
    expect((await s.admin.post('/invoices/generate', { period: P, amount: 350000, dueDate: due })).body).toEqual({ created: 1, skipped: 3 });
    expect((await s.rohan.post('/invoices/generate', { period: P, amount: 1, dueDate: due })).status).toBe(403);
  });

  it('TC-BIL-05 amount validation', async () => {
    for (const amount of [3500.5, -1, '3500']) {
      expect((await s.admin.post('/invoices/generate', { period: '2026-12', amount, dueDate: '2026-12-10' })).status).toBe(400);
    }
  });
});

describe('TC-BIL-01/03 list and pay', () => {
  it('resident sees own flat; pays UPI; ALREADY_PAID; CASH forbidden; other flat 404', async () => {
    const mine = (await s.rohan.get('/invoices')).body.items;
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ period: P, amount: 350000, dueDate: due, status: 'UNPAID', flat: { label: 'A-101' }, payments: [] });
    const all = (await s.admin.get('/invoices')).body.items as { flat: { label: string } }[];
    expect(all.map(i => i.flat.label)).toEqual(['A-101', 'A-102', 'B-201', 'B-202']);
    expect((await s.guard.get('/invoices')).status).toBe(403);

    expect((await s.rohan.post(`/invoices/${mine[0].id}/pay`, { method: 'CASH' })).status).toBe(403);
    const priyaInv = (await s.priya.get('/invoices')).body.items[0];
    expect((await s.rohan.post(`/invoices/${priyaInv.id}/pay`, { method: 'UPI' })).status).toBe(404);

    const paid = await s.rohan.post(`/invoices/${mine[0].id}/pay`, { method: 'UPI', amount: 1 });
    expect(paid.status).toBe(200);
    expect(paid.body.status).toBe('PAID');
    expect(paid.body.payments).toHaveLength(1);
    expect(paid.body.payments[0]).toMatchObject({ amount: 350000, method: 'UPI', paidBy: { id: s.rohanM.membershipId }, reference: expect.stringMatching(/^MOCK-UPI-[A-Z0-9]{8}$/) });

    const again = await s.rohan.post(`/invoices/${mine[0].id}/pay`, { method: 'UPI' });
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('ALREADY_PAID');
    expect(await prisma.payment.count({ where: { invoiceId: mine[0].id } })).toBe(1);

    expect((await s.admin.post(`/invoices/${priyaInv.id}/pay`, { method: 'CASH' })).body.status).toBe('PAID');
    expect((await s.admin.get(`/invoices?status=PAID&period=${P}`)).body.items).toHaveLength(2);
  });

  it('double submit creates exactly one payment', async () => {
    const inv = (await s.admin.get(`/invoices?status=UNPAID`)).body.items[0];
    const rs = await Promise.all([1, 2, 3].map(() => s.admin.post(`/invoices/${inv.id}/pay`, { method: 'CASH' })));
    expect(rs.filter(r => r.status === 200)).toHaveLength(1);
    expect(await prisma.payment.count({ where: { invoiceId: inv.id } })).toBe(1);
  });

  it('TC-BIL-04 overdue invoices are payable', async () => {
    await s.admin.post('/invoices/generate', { period: '2025-01', amount: 100000, dueDate: '2025-01-10' });
    const od = (await s.rohan.get('/invoices?period=2025-01')).body.items[0];
    expect(od.status).toBe('OVERDUE');
    expect((await s.rohan.post(`/invoices/${od.id}/pay`, { method: 'CARD' })).body.status).toBe('PAID');
  });
});

describe('TC-BIL-06/07 expenses', () => {
  it('admin creates and lists; future date rejected; resident forbidden', async () => {
    const today = istDateOf(new Date());
    const e = await s.admin.post('/expenses', { category: 'SECURITY', amount: 1200000, vendor: 'Shield', spentOn: today });
    expect(e.status).toBe(201);
    expect(e.body).toMatchObject({ category: 'SECURITY', amount: 1200000, vendor: 'Shield', note: null, spentOn: today, createdBy: { id: s.adminMembershipId } });
    expect((await s.admin.post('/expenses', { category: 'WATER', amount: 1, spentOn: istDateOf(new Date(Date.now() + 2 * 86_400_000)) })).status).toBe(400);
    expect((await s.admin.post('/expenses', { category: 'WATER', amount: 0, spentOn: today })).status).toBe(400);
    expect((await s.admin.get('/expenses?category=SECURITY')).body.items).toHaveLength(1);
    expect((await s.rohan.get('/expenses')).status).toBe(403);
  });
});

describe('TC-RPT-01 reports/summary', () => {
  it('returns every KPI with the documented shape', async () => {
    await s.guard.post('/visitors', { flatId: s.flats.A101, type: 'GUEST', name: 'Today' });
    const r = await s.admin.get('/reports/summary');
    expect(r.status).toBe(200);
    expect(Object.keys(r.body).sort()).toEqual([
      'collectionRate', 'expensesThisMonth', 'flats', 'insideNow', 'openTickets', 'pendingApprovals',
      'recentVisitors', 'residents', 'sosActive', 'totalCollected', 'totalDue', 'visitorsToday',
    ]);
    expect(r.body).toMatchObject({
      flats: 4, residents: 2, visitorsToday: 1, pendingApprovals: 1, insideNow: 0, openTickets: 0, sosActive: 0,
      collectionRate: 75, totalDue: 350000 + 3 * 100000, // B-202 now + three overdue 2025-01 bills
      expensesThisMonth: 1200000,
    });
    expect(r.body.totalCollected).toBe(350000 * 3 + 100000);
    expect(r.body.recentVisitors[0]).toMatchObject({ name: 'Today', flat: { label: 'A-101' } });
    expect((await s.rohan.get('/reports/summary')).status).toBe(403);
  });
});
