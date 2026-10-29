import { EventEmitter } from 'node:events';
import type { Response } from 'express';
import type { Role, Notification, Prisma } from '@prisma/client';
import { prisma } from './db.js';
import { logger, SSE_HEARTBEAT_MS } from './config.js';

export interface Target {
  societyId: string;
  flatIds?: string[];       // RESIDENT members of these flats
  roles?: Role[];           // members with these roles
  userIds?: string[];       // specific users
  exceptUserId?: string;    // skip the actor
}                           // no flatIds/roles/userIds => whole society

export type DomainEventName = 'visitor.requested' | 'visitor.updated' | 'sos.raised' | 'sos.updated' | 'notice.created';

export interface NotifySpec { type: string; title: string; body: string; data: Record<string, unknown> }

interface SseClient { userId: string; membershipId: string; societyId: string; role: Role; flatId: string | null; res: Response }

export const bus = new EventEmitter();

/** Payload is the same DTO the REST endpoint returns. Call after the DB write commits. */
export function emitDomain(name: DomainEventName, target: Target, data: unknown): void {
  bus.emit('domain', { name, target, data });
}

export function notify(target: Target, n: NotifySpec): void {
  bus.emit('notify', { target, n });
}

const hasFilter = (t: Target) => !!(t.flatIds?.length || t.roles?.length || t.userIds?.length);

function matches(t: Target, c: SseClient): boolean {
  if (c.userId === t.exceptUserId) return false;
  if (!hasFilter(t)) return true;
  return (!!c.flatId && c.role === 'RESIDENT' && !!t.flatIds?.includes(c.flatId))
    || !!t.roles?.includes(c.role)
    || !!t.userIds?.includes(c.userId);
}

// ponytail: in-process hub, reaches only clients on this instance. Multi-replica => Redis pub/sub in emitDomain/notify.
const clients = new Map<string, Set<SseClient>>();
let heartbeat: NodeJS.Timeout | undefined;

function write(c: SseClient, frame: string): boolean {
  try {
    c.res.write(frame);
    return true;
  } catch {
    remove(c);
    return false;
  }
}

function remove(c: SseClient) {
  const set = clients.get(c.societyId);
  if (!set) return;
  set.delete(c);
  if (!set.size) clients.delete(c.societyId);
}

const all = () => [...clients.values()].flatMap(s => [...s]);
const frame = (event: string, data: unknown) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

export const hub = {
  add(c: SseClient): () => void {
    let set = clients.get(c.societyId);
    if (!set) clients.set(c.societyId, (set = new Set()));
    set.add(c);
    if (!heartbeat) {
      heartbeat = setInterval(() => { for (const x of all()) write(x, ': ping\n\n'); }, SSE_HEARTBEAT_MS);
      heartbeat.unref();
    }
    return () => remove(c);
  },
  publish(t: Target, event: string, data: unknown): number {
    let n = 0;
    for (const c of [...(clients.get(t.societyId) ?? [])]) if (matches(t, c) && write(c, frame(event, data))) n++;
    return n;
  },
  publishToUsers(userIds: string[], event: string, data: unknown): number {
    let n = 0;
    for (const c of all()) if (userIds.includes(c.userId) && write(c, frame(event, data))) n++;
    return n;
  },
  dropMembership(membershipId: string): void {
    for (const c of all()) if (c.membershipId === membershipId) { remove(c); c.res.end(); }
  },
  closeAll(): void {
    for (const c of all()) { remove(c); c.res.end(); }
    if (heartbeat) clearInterval(heartbeat);
    heartbeat = undefined;
  },
  size: () => all().length,
};

export const notificationDTO = (n: Notification) => ({
  id: n.id, type: n.type, title: n.title, body: n.body, data: n.data, societyId: n.societyId, readAt: n.readAt, createdAt: n.createdAt,
});

function recipientFilter(t: Target): Prisma.MembershipWhereInput {
  if (!hasFilter(t)) return {};
  const or: Prisma.MembershipWhereInput[] = [];
  if (t.flatIds?.length) or.push({ role: 'RESIDENT', flatId: { in: t.flatIds } });
  if (t.roles?.length) or.push({ role: { in: t.roles } });
  if (t.userIds?.length) or.push({ userId: { in: t.userIds } });
  return { OR: or };
}

async function deliverNotification(t: Target, n: NotifySpec) {
  const rows = await prisma.membership.findMany({
    where: { societyId: t.societyId, status: 'ACTIVE', ...recipientFilter(t) },
    select: { userId: true },
  });
  const userIds = [...new Set(rows.map(r => r.userId))].filter(u => u !== t.exceptUserId);
  if (!userIds.length) return;
  const created = await prisma.notification.createManyAndReturn({
    data: userIds.map(userId => ({
      userId, societyId: t.societyId, type: n.type, title: n.title, body: n.body,
      data: { societyId: t.societyId, ...n.data } as Prisma.InputJsonObject,
    })),
  });
  for (const row of created) hub.publishToUsers([row.userId], 'notification', notificationDTO(row));
}

/** Resolves once every in-flight notification write has finished (used by tests). */
const pending = new Set<Promise<void>>();
export const flushNotifications = () => Promise.all([...pending]);

bus.on('domain', ({ name, target, data }: { name: string; target: Target; data: unknown }) => {
  try { hub.publish(target, name, data); } catch (err) { logger.error({ err }, 'publish failed'); }
});

bus.on('notify', ({ target, n }: { target: Target; n: NotifySpec }) => {
  const p = deliverNotification(target, n)
    .catch(err => logger.error({ err }, 'notify failed'))
    .finally(() => pending.delete(p));
  pending.add(p);
});
