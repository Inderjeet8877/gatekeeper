import type { Prisma } from '@prisma/client';
import { prisma, actorInclude, actorRef } from '../../db.js';
import { notFound } from '../../lib/errors.js';
import { emitDomain, notify } from '../../events.js';
import type { Member } from '../../middleware/auth.js';
import type { CreateNoticeBody, ListNoticesQuery, UpdateNoticeBody } from './notices.schemas.js';

const include = { createdBy: actorInclude } satisfies Prisma.NoticeInclude;

const dto = (n: Prisma.NoticeGetPayload<{ include: typeof include }>) => ({
  id: n.id, title: n.title, body: n.body, category: n.category, isPinned: n.isPinned,
  createdBy: actorRef(n.createdBy), createdAt: n.createdAt, updatedAt: n.updatedAt,
});

async function findNotice(m: Member, id: string) {
  if (!(await prisma.notice.findFirst({ where: { id, societyId: m.societyId }, select: { id: true } }))) throw notFound('Notice');
}

export async function listNotices(m: Member, q: ListNoticesQuery) {
  const rows = await prisma.notice.findMany({
    where: { societyId: m.societyId, category: q.category }, include,
    orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }], take: q.limit,
  });
  return rows.map(dto);
}

export async function createNotice(m: Member, input: CreateNoticeBody) {
  const n = dto(await prisma.notice.create({ data: { ...input, societyId: m.societyId, createdById: m.id }, include }));
  emitDomain('notice.created', { societyId: m.societyId }, n);
  notify({ societyId: m.societyId, exceptUserId: m.userId }, {
    type: 'NOTICE_POSTED', title: n.title, body: n.body.length > 140 ? `${n.body.slice(0, 137)}...` : n.body, data: { noticeId: n.id },
  });
  return n;
}

export async function updateNotice(m: Member, id: string, input: UpdateNoticeBody) {
  await findNotice(m, id);
  return dto(await prisma.notice.update({ where: { id }, data: input, include }));
}

export async function deleteNotice(m: Member, id: string) {
  await findNotice(m, id);
  await prisma.notice.delete({ where: { id } });
}
