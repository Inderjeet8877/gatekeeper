import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, LifeBuoy, Send } from 'lucide-react';
import { patch, post, useAct, useGet } from '../../lib/api';
import { formatDateTime, formatRelative } from '../../lib/format';
import { STATUS, TICKET_CAT } from '../../lib/status';
import type { List, Member, Role, Ticket, TicketStatus } from '../../lib/types';
import {
  Async, Avatar, Badge, Button, Card, EmptyState, Field, PageHeader, Select, Skeleton, StatusChip, Table, Textarea,
  options, td, tr,
} from '../../components/ui';

/** Transitions the API allows per role (docs/08 §4.10). */
function allowed(from: TicketStatus, role: Role): TicketStatus[] {
  const admin: Record<TicketStatus, TicketStatus[]> = {
    OPEN: ['IN_PROGRESS', 'RESOLVED', 'CLOSED'], IN_PROGRESS: ['OPEN', 'RESOLVED', 'CLOSED'], RESOLVED: ['CLOSED', 'OPEN'], CLOSED: [],
  };
  const resident: Record<TicketStatus, TicketStatus[]> = { OPEN: ['CLOSED'], IN_PROGRESS: ['CLOSED'], RESOLVED: ['CLOSED', 'OPEN'], CLOSED: [] };
  return (role === 'ADMIN' ? admin : resident)[from];
}
const ACTION_LABEL: Record<TicketStatus, string> = { OPEN: 'Reopen', IN_PROGRESS: 'Start work', RESOLVED: 'Mark resolved', CLOSED: 'Close request' };

export function TicketDetail({ id, role, back }: { id: string; role: Role; back: string }) {
  const q = useGet<Ticket>(`/tickets/${id}`);
  const staff = useGet<List<Member>>(role === 'ADMIN' ? '/members' : null, { status: 'ACTIVE' });
  const [body, setBody] = useState('');
  const update = useAct((b: Record<string, unknown>) => patch<Ticket>(`/tickets/${id}`, b), { success: 'Request updated.' });
  const comment = useAct(() => post(`/tickets/${id}/comments`, { body: body.trim() }), { success: 'Comment added.', onSuccess: () => setBody('') });
  const send = (e: FormEvent) => { e.preventDefault(); if (body.trim()) comment.mutate(); };

  return (
    <>
      <Link to={back} className="-ml-2 mb-4 inline-flex h-11 items-center gap-1 rounded-control px-2 text-label text-fg-muted hover:text-fg"><ArrowLeft size={18} aria-hidden /> All requests</Link>
      <Async q={q} skeleton={<div className="space-y-4"><Skeleton className="h-8 w-1/2" /><Skeleton className="h-40 !rounded-card" /></div>}>
        {(t) => {
          const Cat = TICKET_CAT[t.category];
          const next = allowed(t.status, role);
          return (
            <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
              <div className="space-y-6">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusChip spec={STATUS.ticket[t.status]} withIcon />
                    <StatusChip spec={STATUS.priority[t.priority]} withIcon />
                    <Badge icon={Cat.icon}>{Cat.label}</Badge>
                  </div>
                  <h1 className="mt-3 text-h1">{t.title}</h1>
                  <p className="mt-1 text-body-sm text-fg-subtle">{t.flat?.label ?? 'Common area'} · raised by {t.raisedBy.name} · {formatDateTime(t.createdAt)}</p>
                </div>
                <Card><p className="whitespace-pre-line text-body">{t.description}</p></Card>
                <Card title="Conversation" description={t.status === 'CLOSED' ? 'This request is closed.' : undefined}>
                  {t.comments?.length ? (
                    <ol className="space-y-5">
                      {t.comments.map((c) => (
                        <li key={c.id} className="flex gap-3">
                          <Avatar name={c.author.name} seed={c.author.id} size={32} />
                          <div className="min-w-0 flex-1">
                            <p className="text-body-sm"><span className="font-semibold text-fg-heading">{c.author.name}</span> <span className="text-fg-subtle">· {c.author.role === 'ADMIN' ? 'Committee' : 'Resident'} · {formatRelative(c.createdAt)}</span></p>
                            <p className="mt-1 whitespace-pre-line text-body">{c.body}</p>
                          </div>
                        </li>
                      ))}
                    </ol>
                  ) : <p className="text-body-sm text-fg-muted">No comments yet.</p>}
                  <form onSubmit={send} className="mt-6 space-y-3 border-t border-line pt-5">
                    <Field label="Add a comment"><Textarea value={body} maxLength={2000} onChange={(e) => setBody(e.target.value)} /></Field>
                    <Button type="submit" icon={Send} disabled={!body.trim()} loading={comment.isPending}>Send</Button>
                  </form>
                </Card>
              </div>
              <aside className="space-y-4">
                <Card title="Status">
                  {next.length ? (
                    <div className="flex flex-col gap-2">
                      {next.map((s) => (
                        <Button key={s} variant={s === 'RESOLVED' ? 'primary' : 'outline'} loading={update.isPending && (update.variables as { status?: string })?.status === s} onClick={() => update.mutate({ status: s })}>{ACTION_LABEL[s]}</Button>
                      ))}
                    </div>
                  ) : <p className="text-body-sm text-fg-muted">Closed requests can't be changed.</p>}
                  {t.resolvedAt && <p className="mt-3 text-caption text-fg-subtle">Resolved {formatDateTime(t.resolvedAt)}</p>}
                </Card>
                {role === 'ADMIN' && (
                  <Card title="Details">
                    <div className="space-y-4">
                      <Field label="Priority">
                        <Select value={t.priority} onChange={(e) => update.mutate({ priority: e.target.value })}>{options(STATUS.priority)}</Select>
                      </Field>
                      <Field label="Category">
                        <Select value={t.category} onChange={(e) => update.mutate({ category: e.target.value })}>{options(TICKET_CAT)}</Select>
                      </Field>
                      <Field label="Assigned to">
                        <Select value={t.assignedTo?.id ?? ''} onChange={(e) => update.mutate({ assignedToId: e.target.value || null })}>
                          <option value="">Unassigned</option>
                          {staff.data?.items.filter((m) => m.role !== 'RESIDENT').map((m) => <option key={m.id} value={m.id}>{m.user.name} ({m.role === 'ADMIN' ? 'Admin' : 'Guard'})</option>)}
                        </Select>
                      </Field>
                    </div>
                  </Card>
                )}
                {role !== 'ADMIN' && t.assignedTo && <Card><p className="text-body-sm text-fg-muted">Assigned to <span className="font-semibold text-fg">{t.assignedTo.name}</span></p></Card>}
              </aside>
            </div>
          );
        }}
      </Async>
    </>
  );
}

export function AdminTicket() {
  return <TicketDetail id={useParams().id!} role="ADMIN" back="/app/admin/helpdesk" />;
}

export default function Helpdesk() {
  const [status, setStatus] = useState('OPEN,IN_PROGRESS');
  const [category, setCategory] = useState('');
  const q = useGet<List<Ticket>>('/tickets', { status: status || undefined, category: category || undefined, limit: 200 });
  const navigate = useNavigate();
  return (
    <>
      <PageHeader title="Helpdesk" description="Requests raised by residents. Assign, update and reply in one place." />
      <div className="mb-4 flex flex-wrap gap-3">
        <Select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)} className="w-48">
          <option value="OPEN,IN_PROGRESS">Open and in progress</option>
          <option value="">All statuses</option>
          {options(STATUS.ticket)}
        </Select>
        <Select aria-label="Category" value={category} onChange={(e) => setCategory(e.target.value)} className="w-44">
          <option value="">All categories</option>{options(TICKET_CAT)}
        </Select>
      </div>
      <Async q={q} empty={<Card><EmptyState icon={LifeBuoy} title="No open requests." body="New requests from residents will appear here." /></Card>}>
        {(d) => (
          <Table caption="Helpdesk requests" head={['Request', 'Flat', 'Priority', 'Status', 'Assigned to', 'Age']}>
            {d.items.map((t) => {
              const Cat = TICKET_CAT[t.category];
              return (
                <tr key={t.id} className={`${tr} cursor-pointer`} onClick={() => navigate(`/app/admin/helpdesk/${t.id}`)}>
                  <td className={td}>
                    <Link to={`/app/admin/helpdesk/${t.id}`} className="flex items-center gap-3 font-semibold text-fg-heading hover:underline" onClick={(e) => e.stopPropagation()}>
                      <Cat.icon size={18} className="shrink-0 text-fg-subtle" aria-hidden />{t.title}
                    </Link>
                    <span className="ml-[30px] text-caption text-fg-subtle">{Cat.label} · {t.commentCount} comment{t.commentCount === 1 ? '' : 's'}</span>
                  </td>
                  <td className={td}>{t.flat ? <Badge variant="outline">{t.flat.label}</Badge> : <span className="text-fg-subtle">Common</span>}</td>
                  <td className={td}><StatusChip spec={STATUS.priority[t.priority]} /></td>
                  <td className={td}><StatusChip spec={STATUS.ticket[t.status]} /></td>
                  <td className={td}>{t.assignedTo?.name ?? <span className="text-fg-subtle">Unassigned</span>}</td>
                  <td className={`${td} whitespace-nowrap tabular-nums text-fg-muted`}>{formatRelative(t.createdAt)}</td>
                </tr>
              );
            })}
          </Table>
        )}
      </Async>
    </>
  );
}
