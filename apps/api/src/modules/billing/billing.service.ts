import crypto from 'node:crypto';
import type { PaymentMethod, Prisma } from '@prisma/client';
import { prisma, flatInclude, actorInclude, flatRef, actorRef, actorRefOrNull, isoDate } from '../../db.js';
import { conflict, forbidden, notFound } from '../../lib/errors.js';
import { currentPeriod, istDateOf, periodRange, startOfTodayIst } from '../../lib/time.js';
import { notify } from '../../events.js';
import type { Member } from '../../middleware/auth.js';
import { expireStale, visitorDTO, visitorInclude } from '../visitors/visitors.service.js';
import type { CreateExpenseBody, GenerateInvoicesBody, ListExpensesQuery, ListInvoicesQuery, PayBody } from './billing.schemas.js';

const invoiceInclude = {
  flat: flatInclude,
  payments: { include: { paidBy: actorInclude }, orderBy: { paidAt: 'asc' } },
} satisfies Prisma.InvoiceInclude;

const invoiceDTO = (i: Prisma.InvoiceGetPayload<{ include: typeof invoiceInclude }>) => ({
  id: i.id, period: i.period, amount: i.amount, dueDate: isoDate(i.dueDate), status: i.status, flat: flatRef(i.flat),
  payments: i.payments.map(p => ({
    id: p.id, invoiceId: p.invoiceId, amount: p.amount, method: p.method, reference: p.reference,
    paidBy: actorRefOrNull(p.paidBy), paidAt: p.paidAt,
  })),
  createdAt: i.createdAt,
});

const expenseInclude = { createdBy: actorInclude } satisfies Prisma.ExpenseInclude;
const expenseDTO = (e: Prisma.ExpenseGetPayload<{ include: typeof expenseInclude }>) => ({
  id: e.id, category: e.category, amount: e.amount, vendor: e.vendor, note: e.note, spentOn: isoDate(e.spentOn),
  createdBy: actorRef(e.createdBy), createdAt: e.createdAt,
});

const rupees = (paise: number) => `₹${(paise / 100).toFixed(2)}`;

export async function markOverdue(societyId: string): Promise<number> {
  // dueDate is a DATE column (UTC midnight in JS); "before today (IST)" == dueDate < today's IST calendar date.
  const r = await prisma.invoice.updateMany({
    where: { societyId, status: 'UNPAID', dueDate: { lt: new Date(istDateOf(new Date())) } }, data: { status: 'OVERDUE' },
  });
  return r.count;
}

export async function listInvoices(m: Member, q: ListInvoicesQuery) {
  await markOverdue(m.societyId);
  const flatId = m.role === 'RESIDENT' ? m.flatId! : q.flatId;
  const rows = await prisma.invoice.findMany({
    where: { societyId: m.societyId, flatId, status: q.status, period: q.period },
    include: invoiceInclude,
    orderBy: [{ period: 'desc' }, { flat: { block: { name: 'asc' } } }, { flat: { number: 'asc' } }],
    take: q.limit,
  });
  return rows.map(invoiceDTO);
}

export async function generateInvoices(m: Member, { period, amount, dueDate }: GenerateInvoicesBody) {
  const [flats, existing] = await Promise.all([
    prisma.flat.findMany({ where: { societyId: m.societyId }, select: { id: true } }),
    prisma.invoice.findMany({ where: { societyId: m.societyId, period }, select: { flatId: true } }),
  ]);
  const have = new Set(existing.map(e => e.flatId));
  const created = await prisma.invoice.createManyAndReturn({
    data: flats.filter(f => !have.has(f.id)).map(f => ({
      societyId: m.societyId, flatId: f.id, period, amount, dueDate: new Date(dueDate), status: 'UNPAID' as const,
    })),
    skipDuplicates: true, // @@unique([flatId, period]) makes concurrent runs safe
  });
  for (const inv of created) {
    notify({ societyId: m.societyId, flatIds: [inv.flatId] }, {
      type: 'INVOICE_GENERATED', title: `Maintenance bill ${period}`, body: `${rupees(amount)} due ${dueDate}`,
      data: { invoiceId: inv.id, period },
    });
  }
  return { created: created.length, skipped: flats.length - created.length };
}

/** The only function a real payment gateway replaces. */
function mockCharge(method: PaymentMethod) {
  const rand = Array.from(crypto.randomBytes(8), b => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[b % 36]).join('');
  return { status: 'SUCCESS' as const, reference: `MOCK-${method}-${rand}` };
}

export async function payInvoice(m: Member, invoiceId: string, { method }: PayBody) {
  if (m.role === 'RESIDENT' && method === 'CASH') throw forbidden('Cash payments are recorded by the office');
  await markOverdue(m.societyId);
  const inv = await prisma.invoice.findFirst({
    where: { id: invoiceId, societyId: m.societyId, ...(m.role === 'RESIDENT' && { flatId: m.flatId! }) },
  });
  if (!inv) throw notFound('Invoice');
  if (inv.status === 'PAID') throw conflict('ALREADY_PAID', 'Invoice already paid');
  const charge = mockCharge(method);
  const payment = await prisma.$transaction(async tx => {
    const r = await tx.invoice.updateMany({ where: { id: inv.id, status: { in: ['UNPAID', 'OVERDUE'] } }, data: { status: 'PAID' } });
    if (!r.count) throw conflict('ALREADY_PAID', 'Invoice already paid');
    return tx.payment.create({
      data: { invoiceId: inv.id, societyId: m.societyId, amount: inv.amount, method, reference: charge.reference, paidById: m.id, paidAt: new Date() },
    });
  });
  notify({ societyId: m.societyId, flatIds: [inv.flatId], roles: ['ADMIN'], exceptUserId: m.userId }, {
    type: 'PAYMENT_RECEIVED', title: `Payment received for ${inv.period}`, body: `${rupees(inv.amount)} via ${method}`,
    data: { invoiceId: inv.id, paymentId: payment.id },
  });
  return invoiceDTO(await prisma.invoice.findUniqueOrThrow({ where: { id: inv.id }, include: invoiceInclude }));
}

/** Calendar-month bounds for DATE columns (stored as UTC midnight). */
function monthDates(period: string) {
  const [y, mo] = period.split('-').map(Number);
  return { gte: new Date(Date.UTC(y, mo - 1, 1)), lt: new Date(Date.UTC(y, mo, 1)) };
}

export async function listExpenses(m: Member, q: ListExpensesQuery) {
  const rows = await prisma.expense.findMany({
    where: { societyId: m.societyId, category: q.category, spentOn: q.month ? monthDates(q.month) : undefined },
    include: expenseInclude, orderBy: [{ spentOn: 'desc' }, { createdAt: 'desc' }], take: q.limit,
  });
  return rows.map(expenseDTO);
}

export async function createExpense(m: Member, input: CreateExpenseBody) {
  return expenseDTO(await prisma.expense.create({
    data: { ...input, spentOn: new Date(input.spentOn), societyId: m.societyId, createdById: m.id }, include: expenseInclude,
  }));
}

export async function getSummary(m: Member) {
  const societyId = m.societyId;
  await Promise.all([markOverdue(societyId), expireStale(societyId)]);
  const P = currentPeriod();
  const M = periodRange(P);
  const sum = (r: { _sum: { amount: number | null } }) => r._sum.amount ?? 0;
  const [visitorsToday, pendingApprovals, insideNow, openTickets, billed, paid, due, collected, expenses, residents, flats, recent, sosActive] =
    await Promise.all([
      prisma.visitor.count({ where: { societyId, createdAt: { gte: startOfTodayIst() } } }),
      prisma.visitor.count({ where: { societyId, status: 'PENDING_APPROVAL' } }),
      prisma.visitor.count({ where: { societyId, status: 'CHECKED_IN' } }),
      prisma.ticket.count({ where: { societyId, status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
      prisma.invoice.aggregate({ _sum: { amount: true }, where: { societyId, period: P } }),
      prisma.invoice.aggregate({ _sum: { amount: true }, where: { societyId, period: P, status: 'PAID' } }),
      prisma.invoice.aggregate({ _sum: { amount: true }, where: { societyId, status: { in: ['UNPAID', 'OVERDUE'] } } }),
      prisma.payment.aggregate({ _sum: { amount: true }, where: { societyId, paidAt: { gte: M.start, lt: M.end } } }),
      prisma.expense.aggregate({ _sum: { amount: true }, where: { societyId, spentOn: monthDates(P) } }),
      prisma.membership.count({ where: { societyId, role: 'RESIDENT', status: 'ACTIVE' } }),
      prisma.flat.count({ where: { societyId } }),
      prisma.visitor.findMany({ where: { societyId }, include: visitorInclude, orderBy: { createdAt: 'desc' }, take: 5 }),
      prisma.sosAlert.count({ where: { societyId, status: { in: ['RAISED', 'ACKNOWLEDGED'] } } }),
    ]);
  return {
    visitorsToday, pendingApprovals, insideNow, openTickets,
    collectionRate: sum(billed) ? Math.round((sum(paid) / sum(billed)) * 100) : 0,
    totalDue: sum(due), totalCollected: sum(collected), expensesThisMonth: sum(expenses),
    residents, flats, recentVisitors: recent.map(visitorDTO), sosActive,
  };
}
