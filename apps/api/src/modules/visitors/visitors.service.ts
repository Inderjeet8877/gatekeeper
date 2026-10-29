import type { Prisma, VisitorStatus } from '@prisma/client';
import { prisma, flatInclude, actorInclude, flatRef, actorRef, actorRefOrNull } from '../../db.js';
import { VISITOR_PENDING_TTL_MS } from '../../config.js';
import { AppError, assertTransition, invalidTransition, notFound } from '../../lib/errors.js';
import { istDayRange } from '../../lib/time.js';
import { emitDomain, notify, type Target } from '../../events.js';
import type { Member } from '../../middleware/auth.js';
import { toggleAttendanceByPasscode } from '../staff/staff.service.js';
import type { CreateVisitorBody, Decision, ListVisitorsQuery } from './visitors.schemas.js';

const VISITOR_TRANSITIONS = {
  PENDING_APPROVAL: ['APPROVED', 'DENIED', 'LEFT_AT_GATE', 'EXPIRED'],
  APPROVED: ['CHECKED_IN'], CHECKED_IN: ['CHECKED_OUT'], LEFT_AT_GATE: ['COLLECTED'],
  DENIED: [], EXPIRED: [], CHECKED_OUT: [], COLLECTED: [],
} as const satisfies Record<VisitorStatus, readonly VisitorStatus[]>;

const visitorInclude = {
  flat: flatInclude, loggedBy: actorInclude, decidedBy: actorInclude,
} satisfies Prisma.VisitorInclude;

type VisitorRow = Prisma.VisitorGetPayload<{ include: typeof visitorInclude }>;

export const visitorDTO = (v: VisitorRow) => ({
  id: v.id, type: v.type, name: v.name, phone: v.phone, company: v.company, vehicleNo: v.vehicleNo,
  photoUrl: v.photoUrl, purpose: v.purpose, status: v.status, flat: flatRef(v.flat),
  preApprovalId: v.preApprovalId, loggedBy: actorRef(v.loggedBy), decidedBy: actorRefOrNull(v.decidedBy),
  decidedAt: v.decidedAt, checkInAt: v.checkInAt, checkOutAt: v.checkOutAt,
  expiresAt: v.status === 'PENDING_APPROVAL' ? new Date(v.createdAt.getTime() + VISITOR_PENDING_TTL_MS) : null,
  createdAt: v.createdAt, updatedAt: v.updatedAt,
});
export type VisitorDTO = ReturnType<typeof visitorDTO>;
export { visitorInclude };

const loadDTO = async (id: string) => visitorDTO(await prisma.visitor.findUniqueOrThrow({ where: { id }, include: visitorInclude }));
const updatedTarget = (v: VisitorDTO, societyId: string): Target => ({ societyId, flatIds: [v.flat.id], roles: ['GUARD'] });
const staleCutoff = () => new Date(Date.now() - VISITOR_PENDING_TTL_MS);

export async function expireStale(societyId?: string): Promise<number> {
  const stale = await prisma.visitor.findMany({
    where: { status: 'PENDING_APPROVAL', createdAt: { lte: staleCutoff() }, ...(societyId && { societyId }) },
    select: { id: true, societyId: true }, take: 500,
  });
  let n = 0;
  for (const { id, societyId: sid } of stale) {
    const r = await prisma.visitor.updateMany({ where: { id, status: 'PENDING_APPROVAL' }, data: { status: 'EXPIRED' } });
    if (r.count) { n++; const v = await loadDTO(id); emitDomain('visitor.updated', updatedTarget(v, sid), v); }
  }
  return n;
}

export async function listVisitors(m: Member, q: ListVisitorsQuery) {
  await expireStale(m.societyId);
  const flatId = m.role === 'RESIDENT' ? m.flatId! : q.flatId;
  const rows = await prisma.visitor.findMany({
    where: {
      societyId: m.societyId, flatId,
      ...(q.status && { status: { in: q.status } }),
      ...(q.date && (({ start, end }) => ({ createdAt: { gte: start, lt: end } }))(istDayRange(q.date))),
    },
    include: visitorInclude, orderBy: { createdAt: 'desc' }, take: q.limit,
  });
  return rows.map(visitorDTO);
}

export async function logWalkIn(m: Member, input: CreateVisitorBody) {
  const flat = await prisma.flat.findFirst({ where: { id: input.flatId, societyId: m.societyId }, ...flatInclude });
  if (!flat) throw notFound('Flat');
  const v = visitorDTO(await prisma.visitor.create({
    data: { ...input, societyId: m.societyId, loggedById: m.id, status: 'PENDING_APPROVAL' }, include: visitorInclude,
  }));
  emitDomain('visitor.requested', { societyId: m.societyId, flatIds: [flat.id] }, v);
  notify({ societyId: m.societyId, flatIds: [flat.id] }, {
    type: 'VISITOR_REQUESTED', title: 'Visitor at the gate',
    body: `${v.name}${v.company ? ` (${v.company})` : ''} is waiting at the gate for ${v.flat.label}.`,
    data: { visitorId: v.id },
  });
  return v;
}

/** Compare-and-set transition; first writer wins, everyone else gets INVALID_TRANSITION. */
async function transition(m: Member, id: string, to: VisitorStatus, data: Prisma.VisitorUncheckedUpdateManyInput,
  scope: Prisma.VisitorWhereInput = {}, guard?: (v: { status: VisitorStatus; type: string }) => void) {
  const cur = await prisma.visitor.findFirst({ where: { id, societyId: m.societyId, ...scope } });
  if (!cur) throw notFound('Visitor');
  guard?.(cur);
  assertTransition(VISITOR_TRANSITIONS, cur.status, to);
  const extra: Prisma.VisitorWhereInput = cur.status === 'PENDING_APPROVAL' ? { createdAt: { gt: staleCutoff() } } : {};
  const r = await prisma.visitor.updateMany({ where: { id, status: cur.status, ...extra }, data: { ...data, status: to } });
  if (!r.count) {
    if (cur.status === 'PENDING_APPROVAL') await expireStale(m.societyId);
    const now = await prisma.visitor.findUniqueOrThrow({ where: { id }, select: { status: true } });
    throw invalidTransition(now.status, to);
  }
  const v = await loadDTO(id);
  emitDomain('visitor.updated', updatedTarget(v, m.societyId), v);
  return v;
}

const DECISION_TO: Record<Decision, VisitorStatus> = { APPROVE: 'APPROVED', DENY: 'DENIED', LEAVE_AT_GATE: 'LEFT_AT_GATE' };

export function decide(m: Member, id: string, decision: Decision) {
  const to = DECISION_TO[decision];
  return transition(m, id, to, { decidedById: m.id, decidedAt: new Date() }, { flatId: m.flatId! }, v => {
    if (to === 'LEFT_AT_GATE' && v.type !== 'DELIVERY') throw invalidTransition(v.status, to);
  });
}

export const checkIn = (m: Member, id: string) => transition(m, id, 'CHECKED_IN', { checkInAt: new Date() });
export const checkOut = (m: Member, id: string) => transition(m, id, 'CHECKED_OUT', { checkOutAt: new Date() });
export const collect = (m: Member, id: string) =>
  transition(m, id, 'COLLECTED', { checkOutAt: new Date() }, m.role === 'RESIDENT' ? { flatId: m.flatId! } : {});

const passcodeInvalid = (reason: 'NOT_FOUND' | 'NOT_YET_VALID' | 'EXPIRED') =>
  new AppError(404, 'PASSCODE_INVALID', 'Passcode is not valid', { reason });

export async function verifyGatePasscode(m: Member, passcode: string) {
  const now = new Date();
  const pa = await prisma.preApproval.findFirst({ where: { societyId: m.societyId, passcode, status: 'ACTIVE' } });
  if (pa) {
    if (now < pa.validFrom) throw passcodeInvalid('NOT_YET_VALID');
    if (now > pa.validTo) {
      await prisma.preApproval.updateMany({ where: { id: pa.id, status: 'ACTIVE' }, data: { status: 'EXPIRED' } });
      throw passcodeInvalid('EXPIRED');
    }
    const visitorId = await prisma.$transaction(async tx => {
      const r = await tx.preApproval.updateMany({
        where: { id: pa.id, status: 'ACTIVE', usedCount: { lt: pa.maxUses } }, data: { usedCount: { increment: 1 } },
      });
      if (!r.count) return null;
      await tx.preApproval.updateMany({ where: { id: pa.id, usedCount: { gte: pa.maxUses } }, data: { status: 'USED' } });
      const v = await tx.visitor.create({
        data: {
          societyId: m.societyId, flatId: pa.flatId, type: pa.type, name: pa.guestName, phone: pa.guestPhone,
          preApprovalId: pa.id, status: 'CHECKED_IN', loggedById: m.id, decidedById: pa.createdById, decidedAt: now, checkInAt: now,
        },
      });
      return v.id;
    });
    if (visitorId) {
      const v = await loadDTO(visitorId);
      emitDomain('visitor.updated', updatedTarget(v, m.societyId), v);
      notify({ societyId: m.societyId, flatIds: [v.flat.id] }, {
        type: 'VISITOR_ARRIVED', title: 'Guest arrived', body: `${v.name} has entered for ${v.flat.label}.`,
        data: { visitorId: v.id, preApprovalId: pa.id },
      });
      return { kind: 'VISITOR' as const, visitor: v };
    }
  }
  const staff = await toggleAttendanceByPasscode(m, passcode);
  if (staff) return { kind: 'STAFF' as const, ...staff };
  throw passcodeInvalid('NOT_FOUND');
}
