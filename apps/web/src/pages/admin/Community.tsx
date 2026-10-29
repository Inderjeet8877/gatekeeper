import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Megaphone, Pencil, Pin, PinOff, Plus, Trash, Vote, X } from 'lucide-react';
import { del, patch, post, useAct, useGet } from '../../lib/api';
import { fromISTInput } from '../../lib/format';
import { NOTICE_CAT } from '../../lib/status';
import type { List, Notice, NoticeCategory, Poll } from '../../lib/types';
import {
  Async, Button, Card, ConfirmModal, EmptyState, Field, IconButton, Input, Modal, PageHeader, Select, Textarea, options,
} from '../../components/ui';
import { NoticeBody, PollCard } from '../resident/Community';

function NoticeModal({ open, notice, onClose }: { open: boolean; notice: Notice | null; onClose: () => void }) {
  const [f, setF] = useState({ title: notice?.title ?? '', body: notice?.body ?? '', category: (notice?.category ?? 'GENERAL') as NoticeCategory, isPinned: notice?.isPinned ?? false });
  const [err, setErr] = useState<string | null>(null);
  const save = useAct(() => notice ? patch<Notice>(`/notices/${notice.id}`, f) : post<Notice>('/notices', f), {
    success: notice ? 'Notice updated.' : 'Notice posted to all members.', onSuccess: onClose,
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!f.title.trim() || !f.body.trim()) return setErr('Add a title and the notice text.');
    setErr(null); save.mutate();
  };
  return (
    <Modal open={open} onClose={onClose} title={notice ? 'Edit notice' : 'Post a notice'} size="md">
      <form onSubmit={submit} noValidate className="space-y-5">
        <Field label="Title"><Input value={f.title} maxLength={120} onChange={(e) => setF({ ...f, title: e.target.value })} autoFocus /></Field>
        <Field label="Category"><Select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value as NoticeCategory })}>{options(NOTICE_CAT)}</Select></Field>
        <Field label="Notice" hint={`${f.body.length} / 5000`}><Textarea rows={6} value={f.body} maxLength={5000} onChange={(e) => setF({ ...f, body: e.target.value })} /></Field>
        <label className="flex min-h-[44px] cursor-pointer items-center gap-3 text-body">
          <input type="checkbox" className="h-5 w-5 accent-[rgb(var(--gk-brand))]" checked={f.isPinned} onChange={(e) => setF({ ...f, isPinned: e.target.checked })} />
          Pin to the top for everyone
        </label>
        {err && <p role="alert" className="text-body-sm text-critical-fg">{err}</p>}
        <Button type="submit" full icon={Megaphone} loading={save.isPending}>{notice ? 'Save changes' : 'Post notice'}</Button>
      </form>
    </Modal>
  );
}

function NoticeRow({ n, onEdit }: { n: Notice; onEdit: () => void }) {
  const [confirm, setConfirm] = useState(false);
  const pin = useAct(() => patch(`/notices/${n.id}`, { isPinned: !n.isPinned }), { success: n.isPinned ? 'Notice unpinned.' : 'Notice pinned.' });
  const remove = useAct(() => del(`/notices/${n.id}`), { success: 'Notice deleted.', onSuccess: () => setConfirm(false) });
  return (
    <li className="flex items-start gap-1">
      <div className="min-w-0 flex-1"><NoticeBody n={n} /></div>
      <div className="flex shrink-0 pt-3">
        <IconButton label={n.isPinned ? `Unpin ${n.title}` : `Pin ${n.title}`} icon={n.isPinned ? PinOff : Pin} onClick={() => pin.mutate()} />
        <IconButton label={`Edit ${n.title}`} icon={Pencil} onClick={onEdit} />
        <IconButton label={`Delete ${n.title}`} icon={Trash} onClick={() => setConfirm(true)} className="hover:!text-critical-fg" />
      </div>
      <ConfirmModal open={confirm} onClose={() => setConfirm(false)} title="Delete this notice?" body={`“${n.title}” will be removed for everyone. This can't be undone.`}
        confirmLabel="Delete notice" loading={remove.isPending} onConfirm={() => remove.mutate()} />
    </li>
  );
}

export function AdminNotices() {
  const [params, setParams] = useSearchParams();
  const [editing, setEditing] = useState<Notice | null>(null);
  const q = useGet<List<Notice>>('/notices', { limit: 200 });
  const composing = params.get('compose') === '1';
  return (
    <>
      <PageHeader title="Notices" description="Announcements for every member. Pinned notices stay at the top."
        actions={<Button icon={Megaphone} onClick={() => setParams({ compose: '1' })}>Post notice</Button>} />
      <Card bodyClass="!py-0">
        <Async q={q} empty={<EmptyState icon={Megaphone} title="No notices yet." body="Post the first one to all residents." action={<Button onClick={() => setParams({ compose: '1' })}>Post notice</Button>} />}>
          {(d) => <ul className="divide-y divide-line">{d.items.map((n) => <NoticeRow key={n.id} n={n} onEdit={() => setEditing(n)} />)}</ul>}
        </Async>
      </Card>
      {(composing || editing) && <NoticeModal key={editing?.id ?? 'new'} open notice={editing} onClose={() => { setEditing(null); setParams({}); }} />}
    </>
  );
}

function PollModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [question, setQuestion] = useState('');
  const [opts, setOpts] = useState(['', '']);
  const [closesAt, setClosesAt] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const create = useAct(() => post<Poll>('/polls', { question: question.trim(), options: opts.map((o) => o.trim()), closesAt: closesAt ? fromISTInput(closesAt) : undefined }), {
    success: 'Poll created. Residents have been notified.', onSuccess: () => { setQuestion(''); setOpts(['', '']); setClosesAt(''); onClose(); },
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const clean = opts.map((o) => o.trim().toLowerCase());
    if (!question.trim()) return setErr('Enter the question.');
    if (clean.some((o) => !o)) return setErr('Fill in every option, or remove the empty ones.');
    if (new Set(clean).size !== clean.length) return setErr('Each option must be different.');
    if (closesAt && new Date(fromISTInput(closesAt)) <= new Date()) return setErr('The closing time must be in the future.');
    setErr(null); create.mutate();
  };
  return (
    <Modal open={open} onClose={onClose} title="Create a poll" size="md">
      <form onSubmit={submit} noValidate className="space-y-5">
        <Field label="Question"><Input value={question} maxLength={200} onChange={(e) => setQuestion(e.target.value)} autoFocus /></Field>
        <fieldset className="space-y-2">
          <legend className="mb-1.5 text-label">Options</legend>
          {opts.map((o, i) => (
            <div key={i} className="flex gap-2">
              <Input aria-label={`Option ${i + 1}`} value={o} maxLength={100} onChange={(e) => setOpts(opts.map((x, j) => (j === i ? e.target.value : x)))} />
              {opts.length > 2 && <IconButton label={`Remove option ${i + 1}`} icon={X} onClick={() => setOpts(opts.filter((_, j) => j !== i))} />}
            </div>
          ))}
          {opts.length < 10 && <Button variant="ghost" size="sm" icon={Plus} onClick={() => setOpts([...opts, ''])}>Add option</Button>}
        </fieldset>
        <Field label="Closes at" optional hint="Leave empty to keep the poll open."><Input type="datetime-local" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} /></Field>
        {err && <p role="alert" className="text-body-sm text-critical-fg">{err}</p>}
        <Button type="submit" full icon={Vote} loading={create.isPending}>Create poll</Button>
      </form>
    </Modal>
  );
}

export function AdminPolls() {
  const [open, setOpen] = useState(false);
  const q = useGet<List<Poll>>('/polls', { limit: 100 });
  return (
    <>
      <PageHeader title="Polls" description="Ask residents and see results as votes come in. Each resident votes once."
        actions={<Button icon={Vote} onClick={() => setOpen(true)}>Create poll</Button>} />
      <Async q={q} empty={<Card><EmptyState icon={Vote} title="No polls yet." body="Ask residents a question and see the results live." action={<Button onClick={() => setOpen(true)}>Create poll</Button>} /></Card>}>
        {(d) => <div className="grid gap-4 lg:grid-cols-2">{d.items.map((p) => <PollCard key={p.id} p={p} canVote={false} />)}</div>}
      </Async>
      <PollModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
