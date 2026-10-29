import type { Prisma, TicketStatus } from '@prisma/client';
import { prisma, flatInclude, actorInclude, flatRefOrNull, actorRef, actorRefOrNull } from '../../db.js';
import { assertTransition, forbidden, invalidTransition, notFound } from '../../lib/errors.js';
import { notify } from '../../events.js';
import type { Member } from '../../middleware/auth.js';
import type { CreateTicketBody, ListTicketsQuery, UpdateTicketBody } from './tickets.schemas.js';

const TICKET_TRANSITIONS = {
  OPEN: ['IN_PROGRESS', 'RESOLVED', 'CLOSED'],
  IN_PROGRESS: ['OPEN', 'RESOLVED', 'CLOSED'],
  RESOLVED: ['CLOSED', 'OPEN'],
  CLOSED: [],
} as const satisfies Record<TicketStatus, readonly TicketStatus[]>;

const residentMayMove = (from: TicketStatus, to: TicketStatus) => to === 'CLOSED' || (from === 'RESOLVED' && to === 'OPEN');

const include = {
  flat: flatInclude, raisedBy: actorInclude, assignedTo: actorInclude, _count: { select: { comments: true } },
} satisfies Prisma.TicketInclude;
const commentInclude = { author: { include: { user: { select: { name: true } } } } } satisfies Prisma.TicketCommentInclude;

const dto = (t: Prisma.TicketGetPayload<{ include: typeof include }>) => ({
  id: t.id, title: t.title, description: t.description, category: t.category, priority: t.priority, status: t.status,
  flat: flatRefOrNull(t.flat), raisedBy: actorRef(t.raisedBy), assignedTo: actorRefOrNull(t.assignedTo),
  resolvedAt: t.resolvedAt, commentCount: t._count.comments, createdAt: t.createdAt, updatedAt: t.updatedAt,
});
const commentDTO = (c: Prisma.TicketCommentGetPayload<{ include: typeof commentInclude }>) => ({
  id: c.id, body: c.body, author: { id: c.author.id, name: c.author.user.name, role: c.author.role }, createdAt: c.createdAt,
});

const scope = (m: Member): Prisma.TicketWhereInput =>
  ({ societyId: m.societyId, ...(m.role === 'RESIDENT' && { flatId: m.flatId! }) });

async function findTicket(m: Member, id: string) {
  const t = await prisma.ticket.findFirst({ where: { id, ...scope(m) }, include });
  if (!t) throw notFound('Ticket');
  return t;
}

async function withComments(id: string) {
  const [t, comments] = await Promise.all([
    prisma.ticket.findUniqueOrThrow({ where: { id }, include }),
    prisma.ticketComment.findMany({ where: { ticketId: id }, include: commentInclude, orderBy: { createdAt: 'asc' } }),
  ]);
  return { ...dto(t), comments: comments.map(commentDTO) };
}

const userIdOf = async (membershipId: string) =>
  (await prisma.membership.findUniqueOrThrow({ where: { id: membershipId }, select: { userId: true } })).userId;

export async function listTickets(m: Member, q: ListTicketsQuery) {
  const rows = await prisma.ticket.findMany({
    where: { ...scope(m), category: q.category, ...(q.status && { status: { in: q.status } }) },
    include, orderBy: { createdAt: 'desc' }, take: q.limit,
  });
  return rows.map(dto);
}

export async function getTicket(m: Member, id: string) {
  await findTicket(m, id);
  return withComments(id);
}

export async function createTicket(m: Member, input: CreateTicketBody) {
  let flatId: string | null = m.role === 'RESIDENT' ? m.flatId : (input.flatId ?? null);
  if (m.role === 'ADMIN' && flatId && !(await prisma.flat.findFirst({ where: { id: flatId, societyId: m.societyId } }))) throw notFound('Flat');
  const t = await prisma.ticket.create({
    data: {
      societyId: m.societyId, flatId, raisedById: m.id, title: input.title, description: input.description,
      category: input.category, priority: input.priority, status: 'OPEN',
    },
    include,
  });
  notify({ societyId: m.societyId, roles: ['ADMIN'], exceptUserId: m.userId }, {
    type: 'TICKET_CREATED', title: 'New helpdesk ticket',
    body: `${t.title}${t.flat ? ` (${t.flat.block.name}-${t.flat.number})` : ''}`, data: { ticketId: t.id },
  });
  return { ...dto(t), comments: [] };
}

export async function updateTicket(m: Member, id: string, input: UpdateTicketBody) {
  const cur = await findTicket(m, id);
  if (m.role === 'RESIDENT') {
    if (input.priority !== undefined || input.category !== undefined || input.assignedToId !== undefined || !input.status) {
      throw forbidden('Residents can only close or reopen their tickets');
    }
  }
  const data: Prisma.TicketUncheckedUpdateInput = { priority: input.priority, category: input.category };
  const statusChanged = !!input.status && input.status !== cur.status;
  if (statusChanged) {
    const to = input.status!;
    assertTransition(TICKET_TRANSITIONS, cur.status, to);
    if (m.role === 'RESIDENT' && !residentMayMove(cur.status, to)) throw forbidden('Only an admin can make this change');
    data.status = to;
    if (to === 'RESOLVED') data.resolvedAt = new Date();
    if (to === 'OPEN') data.resolvedAt = null;
  }
  let newAssignee: string | null = null;
  if (input.assignedToId !== undefined) {
    if (input.assignedToId) {
      const a = await prisma.membership.findFirst({
        where: { id: input.assignedToId, societyId: m.societyId, status: 'ACTIVE', role: { in: ['ADMIN', 'GUARD'] } },
      });
      if (!a) throw notFound('Assignee');
      if (a.id !== cur.assignedToId) newAssignee = a.userId;
    }
    data.assignedToId = input.assignedToId;
  }
  if (statusChanged) {
    const r = await prisma.ticket.updateMany({ where: { id, status: cur.status }, data: data as Prisma.TicketUncheckedUpdateManyInput });
    if (!r.count) {
      const now = await prisma.ticket.findUniqueOrThrow({ where: { id }, select: { status: true } });
      throw invalidTransition(now.status, input.status!);
    }
  } else {
    await prisma.ticket.update({ where: { id }, data });
  }
  if (statusChanged) {
    notify({ societyId: m.societyId, userIds: [await userIdOf(cur.raisedById)], exceptUserId: m.userId }, {
      type: 'TICKET_UPDATED', title: 'Ticket updated', body: `"${cur.title}" is now ${input.status!.replace('_', ' ').toLowerCase()}.`,
      data: { ticketId: id, status: input.status },
    });
  }
  if (newAssignee) {
    const status = input.status ?? cur.status;
    notify({ societyId: m.societyId, userIds: [newAssignee], exceptUserId: m.userId }, {
      type: 'TICKET_UPDATED', title: 'Ticket assigned to you', body: cur.title, data: { ticketId: id, status },
    });
  }
  return withComments(id);
}

export async function addComment(m: Member, id: string, { body }: { body: string }) {
  const t = await findTicket(m, id);
  const c = await prisma.ticketComment.create({ data: { ticketId: id, societyId: m.societyId, authorId: m.id, body }, include: commentInclude });
  const target = m.id !== t.raisedById
    ? { userIds: [await userIdOf(t.raisedById)] }
    : t.assignedToId ? { userIds: [await userIdOf(t.assignedToId)] } : { roles: ['ADMIN' as const] };
  notify({ societyId: m.societyId, exceptUserId: m.userId, ...target }, {
    type: 'TICKET_COMMENT', title: `New comment on "${t.title}"`, body: body.length > 140 ? `${body.slice(0, 137)}...` : body,
    data: { ticketId: id, commentId: c.id },
  });
  return commentDTO(c);
}
