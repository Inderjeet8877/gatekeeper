import { prisma } from '../../db.js';
import { notFound } from '../../lib/errors.js';
import { notificationDTO } from '../../events.js';
import type { ListNotificationsQuery } from './notifications.schemas.js';

export async function listNotifications(userId: string, q: ListNotificationsQuery) {
  const [rows, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId, ...(q.unread && { readAt: null }) }, orderBy: { createdAt: 'desc' }, take: q.limit,
    }),
    prisma.notification.count({ where: { userId, readAt: null } }),
  ]);
  return { items: rows.map(notificationDTO), unreadCount };
}

export async function markRead(userId: string, id: string) {
  const n = await prisma.notification.findFirst({ where: { id, userId } });
  if (!n) throw notFound('Notification');
  if (n.readAt) return notificationDTO(n);
  return notificationDTO(await prisma.notification.update({ where: { id }, data: { readAt: new Date() } }));
}

export async function markAllRead(userId: string) {
  const r = await prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
  return { updated: r.count };
}
