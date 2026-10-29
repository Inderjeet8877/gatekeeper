import type { User, Prisma } from '@prisma/client';
import { prisma, flatInclude, flatView } from '../../db.js';
import { unauthorized } from '../../lib/errors.js';
import type { UpdateMeBody } from './me.schemas.js';

export const userDTO = (u: User) =>
  ({ id: u.id, phone: u.phone, name: u.name, email: u.email, avatarUrl: u.avatarUrl, createdAt: u.createdAt });

export const membershipInclude = {
  society: { select: { id: true, name: true, city: true } },
  flat: flatInclude,
} satisfies Prisma.MembershipInclude;

type MembershipRow = Prisma.MembershipGetPayload<{ include: typeof membershipInclude }>;

export const membershipView = (m: MembershipRow) => ({
  id: m.id, role: m.role, status: m.status, residentType: m.residentType,
  society: m.society, flat: flatView(m.flat), createdAt: m.createdAt,
});

export async function loadMemberships(userId: string) {
  const rows = await prisma.membership.findMany({
    where: { userId, status: 'ACTIVE' }, include: membershipInclude, orderBy: { society: { name: 'asc' } },
  });
  return rows.map(membershipView);
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw unauthorized('User no longer exists');
  return { user: userDTO(user), memberships: await loadMemberships(userId) };
}

export async function updateMe(userId: string, input: UpdateMeBody) {
  if (!(await prisma.user.findUnique({ where: { id: userId }, select: { id: true } }))) throw unauthorized('User no longer exists');
  return userDTO(await prisma.user.update({ where: { id: userId }, data: input }));
}
