import type { Prisma, SosStatus } from '@prisma/client';
import { prisma, flatInclude, actorInclude, flatRefOrNull, actorRefOrNull } from '../../db.js';
import { assertTransition, invalidTransition, notFound } from '../../lib/errors.js';
import { emitDomain, notify, type Target } from '../../events.js';
import type { Member } from '../../middleware/auth.js';
import type { ListSosQuery, RaiseSosBody } from './sos.schemas.js';

const SOS_TRANSITIONS = {
  RAISED: ['ACKNOWLEDGED', 'RESOLVED'], ACKNOWLEDGED: ['RESOLVED'], RESOLVED: [],
} as const satisfies Record<SosStatus, readonly SosStatus[]>;

const include = {
  flat: flatInclude,
  raisedBy: { include: { user: { select: { name: true, phone: true } } } },
  acknowledgedBy: actorInclude,
} satisfies Prisma.SosAlertInclude;

const dto = (s: Prisma.SosAlertGetPayload<{ include: typeof include }>) => ({
  id: s.id, type: s.type, message: s.message, status: s.status, flat: flatRefOrNull(s.flat),
  raisedBy: { id: s.raisedBy.id, name: s.raisedBy.user.name, phone: s.raisedBy.user.phone },
  acknowledgedBy: actorRefOrNull(s.acknowledgedBy), acknowledgedAt: s.acknowledgedAt, resolvedAt: s.resolvedAt, createdAt: s.createdAt,
});

const target = (societyId: string, raiserUserId: string): Target => ({ societyId, roles: ['GUARD', 'ADMIN'], userIds: [raiserUserId] });
const LABEL = { MEDICAL: 'Medical emergency', FIRE: 'Fire', THEFT: 'Theft / intrusion', OTHER: 'Emergency' } as const;

export async function listSos(m: Member, q: ListSosQuery) {
  const rows = await prisma.sosAlert.findMany({
    where: {
      societyId: m.societyId, ...(m.role === 'RESIDENT' && { raisedById: m.id }),
      ...(q.status && { status: { in: q.status } }),
    },
    include, orderBy: { createdAt: 'desc' }, take: q.limit,
  });
  return rows.map(dto);
}

export async function raiseSos(m: Member, input: RaiseSosBody) {
  const s = dto(await prisma.sosAlert.create({
    data: { societyId: m.societyId, flatId: m.flatId, raisedById: m.id, type: input.type, message: input.message, status: 'RAISED' },
    include,
  }));
  emitDomain('sos.raised', target(m.societyId, m.userId), s);
  notify({ societyId: m.societyId, roles: ['GUARD', 'ADMIN'] }, {
    type: 'SOS_RAISED', title: `SOS: ${LABEL[s.type]}`,
    body: `${s.raisedBy.name}${s.flat ? ` (${s.flat.label})` : ''}${s.message ? `: ${s.message}` : ''}`,
    data: { sosId: s.id, type: s.type },
  });
  return s;
}

export async function updateSosStatus(m: Member, id: string, to: 'ACKNOWLEDGED' | 'RESOLVED') {
  const cur = await prisma.sosAlert.findFirst({ where: { id, societyId: m.societyId }, include: { raisedBy: { select: { userId: true } } } });
  if (!cur) throw notFound('SOS alert');
  assertTransition(SOS_TRANSITIONS, cur.status, to);
  const now = new Date();
  const data: Prisma.SosAlertUncheckedUpdateManyInput = { status: to };
  if (to === 'ACKNOWLEDGED' || !cur.acknowledgedById) { data.acknowledgedById = m.id; data.acknowledgedAt = now; }
  if (to === 'RESOLVED') data.resolvedAt = now;
  const r = await prisma.sosAlert.updateMany({ where: { id, status: cur.status }, data });
  if (!r.count) {
    const fresh = await prisma.sosAlert.findUniqueOrThrow({ where: { id }, select: { status: true } });
    throw invalidTransition(fresh.status, to);
  }
  const s = dto(await prisma.sosAlert.findUniqueOrThrow({ where: { id }, include }));
  emitDomain('sos.updated', target(m.societyId, cur.raisedBy.userId), s);
  notify({ societyId: m.societyId, userIds: [cur.raisedBy.userId] }, {
    type: 'SOS_UPDATED', title: to === 'ACKNOWLEDGED' ? 'Help is on the way' : 'SOS resolved',
    body: to === 'ACKNOWLEDGED' ? `${s.acknowledgedBy?.name ?? 'Security'} acknowledged your alert.` : 'Your SOS alert has been marked resolved.',
    data: { sosId: s.id, status: to },
  });
  return s;
}
