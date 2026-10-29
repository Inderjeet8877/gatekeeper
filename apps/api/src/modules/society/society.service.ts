import type { Prisma, Society } from '@prisma/client';
import { prisma } from '../../db.js';
import { conflict, notFound } from '../../lib/errors.js';
import type { Member } from '../../middleware/auth.js';
import { membershipInclude, membershipView } from '../me/me.service.js';
import type { BulkFlatsBody, CreateSocietyBody } from './society.schemas.js';

export const societyDTO = (s: Society) => ({
  id: s.id, name: s.name, addressLine: s.addressLine, city: s.city, state: s.state,
  pincode: s.pincode, logoUrl: s.logoUrl, createdAt: s.createdAt,
});

const flatListInclude = {
  block: { select: { id: true, name: true } },
  _count: { select: { memberships: { where: { role: 'RESIDENT', status: 'ACTIVE' } } } },
} satisfies Prisma.FlatInclude;

const flatDTO = (f: Prisma.FlatGetPayload<{ include: typeof flatListInclude }>) => ({
  id: f.id, number: f.number, floor: f.floor, block: f.block,
  label: `${f.block.name}-${f.number}`, residentCount: f._count.memberships, createdAt: f.createdAt,
});

const naturalCompare = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });

export async function createSociety(userId: string, input: CreateSocietyBody) {
  return prisma.$transaction(async tx => {
    const society = await tx.society.create({ data: input });
    const membership = await tx.membership.create({
      data: { userId, societyId: society.id, role: 'ADMIN', status: 'ACTIVE' }, include: membershipInclude,
    });
    return { society: societyDTO(society), membership: membershipView(membership) };
  });
}

export async function getSociety(m: Member) {
  return societyDTO(await prisma.society.findUniqueOrThrow({ where: { id: m.societyId } }));
}

export async function listBlocks(m: Member) {
  const rows = await prisma.block.findMany({
    where: { societyId: m.societyId }, include: { _count: { select: { flats: true } } }, orderBy: { name: 'asc' },
  });
  return rows.map(b => ({ id: b.id, name: b.name, flatCount: b._count.flats, createdAt: b.createdAt }));
}

export async function createBlock(m: Member, { name }: { name: string }) {
  const dup = await prisma.block.findFirst({ where: { societyId: m.societyId, name: { equals: name, mode: 'insensitive' } } });
  if (dup) throw conflict('CONFLICT', 'A block with this name already exists');
  const b = await prisma.block.create({ data: { societyId: m.societyId, name } });
  return { id: b.id, name: b.name, flatCount: 0, createdAt: b.createdAt };
}

export async function listFlats(m: Member, q: { blockId?: string }) {
  const rows = await prisma.flat.findMany({
    where: { societyId: m.societyId, ...(q.blockId && { blockId: q.blockId }) }, include: flatListInclude,
  });
  return rows.sort((a, b) => naturalCompare(a.block.name, b.block.name) || naturalCompare(a.number, b.number)).map(flatDTO);
}

export async function bulkCreateFlats(m: Member, { blockId, numbers }: BulkFlatsBody) {
  const block = await prisma.block.findFirst({ where: { id: blockId, societyId: m.societyId } });
  if (!block) throw notFound('Block');
  const unique = [...new Set(numbers)];
  const existing = new Set((await prisma.flat.findMany({ where: { blockId, number: { in: unique } }, select: { number: true } })).map(f => f.number));
  const ids = (await prisma.flat.createManyAndReturn({
    data: unique.filter(n => !existing.has(n)).map(number => ({ societyId: m.societyId, blockId, number })),
    skipDuplicates: true,
    select: { id: true },
  })).map(f => f.id);
  const created = await prisma.flat.findMany({ where: { id: { in: ids } }, include: flatListInclude });
  const createdNums = new Set(created.map(f => f.number));
  return {
    items: created.sort((a, b) => naturalCompare(a.number, b.number)).map(flatDTO),
    skipped: unique.filter(n => !createdNums.has(n)),
  };
}
