import type { Prisma } from '@prisma/client';
import { prisma, flatInclude, flatView } from '../../db.js';
import { conflict, forbidden, notFound, unprocessable } from '../../lib/errors.js';
import { hub, notify } from '../../events.js';
import type { Member } from '../../middleware/auth.js';
import type { AddMemberBody, ListMembersQuery, UpdateMemberBody } from './members.schemas.js';

const memberInclude = {
  flat: flatInclude,
  user: { select: { id: true, name: true, phone: true } },
} satisfies Prisma.MembershipInclude;

const memberDTO = (r: Prisma.MembershipGetPayload<{ include: typeof memberInclude }>) => ({
  id: r.id, role: r.role, status: r.status, residentType: r.residentType,
  flat: flatView(r.flat), user: r.user, createdAt: r.createdAt,
});

export async function listMembers(m: Member, q: ListMembersQuery) {
  let where: Prisma.MembershipWhereInput;
  if (m.role === 'ADMIN') where = { role: q.role, status: q.status, flatId: q.flatId };
  else if (m.role === 'GUARD' && q.flatId) where = { role: 'RESIDENT', status: 'ACTIVE', flatId: q.flatId };
  else throw forbidden();
  const rows = await prisma.membership.findMany({
    where: { societyId: m.societyId, ...where }, include: memberInclude, orderBy: { user: { name: 'asc' } },
  });
  return rows.map(memberDTO);
}

export async function addMember(m: Member, input: AddMemberBody) {
  if (input.flatId && !(await prisma.flat.findFirst({ where: { id: input.flatId, societyId: m.societyId } }))) throw notFound('Flat');
  const user = await prisma.user.upsert({ where: { phone: input.phone }, update: {}, create: { phone: input.phone, name: input.name } });
  if (await prisma.membership.findUnique({ where: { userId_societyId: { userId: user.id, societyId: m.societyId } } })) {
    throw conflict('CONFLICT', 'This user already has a membership in this society. Use PATCH to reactivate it');
  }
  const isResident = input.role === 'RESIDENT';
  const row = await prisma.membership.create({
    data: {
      userId: user.id, societyId: m.societyId, role: input.role, status: 'ACTIVE',
      flatId: isResident ? input.flatId : null, residentType: isResident ? (input.residentType ?? 'OWNER') : null,
    },
    include: memberInclude,
  });
  const society = await prisma.society.findUniqueOrThrow({ where: { id: m.societyId }, select: { name: true } });
  notify({ societyId: m.societyId, userIds: [user.id] }, {
    type: 'MEMBERSHIP_ADDED', title: `Welcome to ${society.name}`,
    body: `You were added to ${society.name} as ${input.role.toLowerCase()}.`, data: { membershipId: row.id },
  });
  return memberDTO(row);
}

export async function updateMember(m: Member, id: string, input: UpdateMemberBody) {
  const row = await prisma.$transaction(async tx => {
    const cur = await tx.membership.findFirst({ where: { id, societyId: m.societyId } });
    if (!cur) throw notFound('Member');
    const data: Prisma.MembershipUncheckedUpdateInput = { status: input.status };
    if (input.role && input.role !== cur.role) {
      if (input.role === 'RESIDENT') {
        if (!cur.flatId) throw unprocessable('FLAT_REQUIRED', 'A resident must be linked to a flat');
        data.residentType = cur.residentType ?? 'OWNER';
      } else {
        data.flatId = null;
        data.residentType = null;
      }
      data.role = input.role;
    }
    const updated = await tx.membership.update({ where: { id }, data, include: memberInclude });
    const admins = await tx.membership.count({ where: { societyId: m.societyId, role: 'ADMIN', status: 'ACTIVE' } });
    if (!admins) throw unprocessable('LAST_ADMIN', 'The society must keep at least one active admin');
    return updated;
  });
  if (row.status === 'INACTIVE') hub.dropMembership(row.id);
  return memberDTO(row);
}
