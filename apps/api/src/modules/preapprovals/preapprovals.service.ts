import type { Prisma } from '@prisma/client';
import { prisma, flatInclude, actorInclude, flatRef, actorRef } from '../../db.js';
import { invalidTransition, notFound } from '../../lib/errors.js';
import { generateUniquePasscode } from '../../lib/passcode.js';
import { istDayRange, istDateOf } from '../../lib/time.js';
import type { Member } from '../../middleware/auth.js';
import type { CreatePreApprovalBody, ListPreApprovalsQuery } from './preapprovals.schemas.js';

const include = { flat: flatInclude, createdBy: actorInclude } satisfies Prisma.PreApprovalInclude;

const dto = (p: Prisma.PreApprovalGetPayload<{ include: typeof include }>, m: Member) => ({
  id: p.id, type: p.type, guestName: p.guestName, guestPhone: p.guestPhone,
  passcode: m.role === 'GUARD' ? null : p.passcode,
  validFrom: p.validFrom, validTo: p.validTo, maxUses: p.maxUses, usedCount: p.usedCount, status: p.status,
  flat: flatRef(p.flat), createdBy: actorRef(p.createdBy), createdAt: p.createdAt,
});

export async function expireStale(societyId?: string): Promise<number> {
  const r = await prisma.preApproval.updateMany({
    where: { status: 'ACTIVE', validTo: { lt: new Date() }, ...(societyId && { societyId }) }, data: { status: 'EXPIRED' },
  });
  return r.count;
}

export async function listPreApprovals(m: Member, q: ListPreApprovalsQuery) {
  await expireStale(m.societyId);
  let where: Prisma.PreApprovalWhereInput = { status: q.status };
  if (m.role === 'RESIDENT') where.flatId = m.flatId!;
  if (m.role === 'GUARD') {
    // "Expected today": ACTIVE and the validity window overlaps today's IST day.
    const { start, end } = istDayRange(istDateOf(new Date()));
    where = { status: 'ACTIVE', validFrom: { lt: end }, validTo: { gte: start } };
  }
  const rows = await prisma.preApproval.findMany({
    where: { societyId: m.societyId, ...where }, include, orderBy: { createdAt: 'desc' }, take: q.limit,
  });
  return rows.map(p => dto(p, m));
}

export async function createPreApproval(m: Member, input: CreatePreApprovalBody) {
  const p = await prisma.$transaction(async tx => tx.preApproval.create({
    data: {
      ...input, societyId: m.societyId, flatId: m.flatId!, createdById: m.id,
      passcode: await generateUniquePasscode(tx, m.societyId), status: 'ACTIVE',
    },
    include,
  }));
  return dto(p, m);
}

export async function cancelPreApproval(m: Member, id: string) {
  const cur = await prisma.preApproval.findFirst({ where: { id, societyId: m.societyId, flatId: m.flatId! } });
  if (!cur) throw notFound('Pre-approval');
  const r = await prisma.preApproval.updateMany({ where: { id, status: 'ACTIVE' }, data: { status: 'CANCELLED' } });
  if (!r.count) {
    const now = await prisma.preApproval.findUniqueOrThrow({ where: { id }, select: { status: true } });
    throw invalidTransition(now.status, 'CANCELLED');
  }
  return dto(await prisma.preApproval.findUniqueOrThrow({ where: { id }, include }), m);
}
