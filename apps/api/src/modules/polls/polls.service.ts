import { Prisma } from '@prisma/client';
import { prisma, actorInclude, actorRef } from '../../db.js';
import { badRequest, conflict, notFound, unprocessable } from '../../lib/errors.js';
import { notify } from '../../events.js';
import type { Member } from '../../middleware/auth.js';
import type { CreatePollBody } from './polls.schemas.js';

const include = {
  createdBy: actorInclude,
  options: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
  votes: { select: { optionId: true, membershipId: true } },
} satisfies Prisma.PollInclude;

// ponytail: loads every vote row to count; switch to pollVote.groupBy once polls have thousands of votes.
const dto = (p: Prisma.PollGetPayload<{ include: typeof include }>, m: Member) => {
  const counts = new Map<string, number>();
  for (const v of p.votes) counts.set(v.optionId, (counts.get(v.optionId) ?? 0) + 1);
  return {
    id: p.id, question: p.question, closesAt: p.closesAt, isClosed: !!p.closesAt && p.closesAt <= new Date(),
    options: p.options.map(o => ({ id: o.id, text: o.text, votes: counts.get(o.id) ?? 0 })),
    totalVotes: p.votes.length,
    myVoteOptionId: p.votes.find(v => v.membershipId === m.id)?.optionId ?? null,
    createdBy: actorRef(p.createdBy), createdAt: p.createdAt,
  };
};

export async function listPolls(m: Member, q: { limit: number }) {
  const rows = await prisma.poll.findMany({ where: { societyId: m.societyId }, include, orderBy: { createdAt: 'desc' }, take: q.limit });
  return rows.map(p => dto(p, m));
}

export async function createPoll(m: Member, input: CreatePollBody) {
  const p = await prisma.$transaction(async tx => {
    const poll = await tx.poll.create({ data: { societyId: m.societyId, question: input.question, closesAt: input.closesAt, createdById: m.id } });
    for (const text of input.options) await tx.pollOption.create({ data: { pollId: poll.id, text } }); // sequential => creation order
    return tx.poll.findUniqueOrThrow({ where: { id: poll.id }, include });
  });
  notify({ societyId: m.societyId, roles: ['RESIDENT'] }, {
    type: 'POLL_CREATED', title: 'New poll', body: p.question, data: { pollId: p.id },
  });
  return dto(p, m);
}

export async function vote(m: Member, pollId: string, optionId: string) {
  const poll = await prisma.poll.findFirst({ where: { id: pollId, societyId: m.societyId }, include: { options: { select: { id: true } } } });
  if (!poll) throw notFound('Poll');
  if (poll.closesAt && poll.closesAt <= new Date()) throw unprocessable('POLL_CLOSED', 'This poll is closed');
  if (!poll.options.some(o => o.id === optionId)) throw badRequest('Option does not belong to this poll', [{ path: 'optionId', message: 'Not an option of this poll' }]);
  try {
    await prisma.pollVote.create({ data: { pollId, optionId, membershipId: m.id } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw conflict('ALREADY_VOTED', 'You have already voted in this poll');
    throw e;
  }
  return dto(await prisma.poll.findUniqueOrThrow({ where: { id: pollId }, include }), m);
}
