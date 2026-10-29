import { PrismaClient, Prisma } from '@prisma/client';

const g = globalThis as unknown as { prisma?: PrismaClient };
export const prisma = g.prisma ?? new PrismaClient();
g.prisma = prisma;
export type Tx = Prisma.TransactionClient;

// Shared includes + mappers for the compact refs used across DTOs (08 §3).
export const flatInclude = { include: { block: { select: { id: true, name: true } } } } as const;
export const actorInclude = { include: { user: { select: { name: true } } } } as const;

type FlatWithBlock = { id: string; number: string; block: { id: string; name: string } };
type Actor = { id: string; user: { name: string } };

export const flatRef = (f: FlatWithBlock) =>
  ({ id: f.id, number: f.number, blockName: f.block.name, label: `${f.block.name}-${f.number}` });
export const flatRefOrNull = (f: FlatWithBlock | null) => (f ? flatRef(f) : null);
export const flatView = (f: FlatWithBlock | null) =>
  (f ? { id: f.id, number: f.number, block: { id: f.block.id, name: f.block.name } } : null);
export const actorRef = (a: Actor) => ({ id: a.id, name: a.user.name });
export const actorRefOrNull = (a: Actor | null) => (a ? actorRef(a) : null);
export const isoDate = (d: Date) => d.toISOString().slice(0, 10);
