import { useState } from 'react';
import { ChevronDown, Megaphone, Pin, Vote } from 'lucide-react';
import { post, useAct, useGet } from '../../lib/api';
import { formatDateTime, formatRelative } from '../../lib/format';
import { NOTICE_CAT, STATUS } from '../../lib/status';
import type { List, Notice, Poll } from '../../lib/types';
import { Async, Badge, Button, Card, cx, EmptyState, PageHeader, StatusChip, Tabs } from '../../components/ui';

export function NoticeBody({ n }: { n: Notice }) {
  const Cat = NOTICE_CAT[n.category];
  return (
    <details className="group">
      <summary className="flex items-start gap-3 py-4">
        <span className={cx('mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full', n.category === 'URGENT' ? 'bg-status-danger-bg text-status-danger-fg' : 'bg-status-neutral-bg text-status-neutral-fg')}>
          <Cat.icon size={18} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-h4 text-fg-heading">{n.title}</span>
            {n.isPinned && <Badge icon={Pin} className="!bg-status-info-bg !text-status-info-fg">Pinned</Badge>}
          </span>
          <span className="mt-0.5 block text-body-sm text-fg-muted group-open:hidden"><span className="line-clamp-2">{n.body}</span></span>
          <span className="mt-1 block text-caption text-fg-subtle">{Cat.label} · {n.createdBy.name} · {formatRelative(n.createdAt)}</span>
        </span>
        <ChevronDown size={20} className="mt-1 shrink-0 text-fg-subtle transition-transform duration-fast group-open:rotate-180" aria-hidden />
      </summary>
      <p className="mb-4 ml-12 max-w-prose whitespace-pre-line text-body text-fg">{n.body}</p>
    </details>
  );
}

export function PollCard({ p, canVote, footer }: { p: Poll; canVote: boolean; footer?: React.ReactNode }) {
  const [choice, setChoice] = useState<string | null>(null);
  const vote = useAct(() => post<Poll>(`/polls/${p.id}/vote`, { optionId: choice }), { success: 'Vote recorded.' });
  const showVote = canVote && !p.isClosed && !p.myVoteOptionId;
  const max = Math.max(...p.options.map((o) => o.votes), 0);
  return (
    <Card title={p.question} actions={<StatusChip spec={p.isClosed ? STATUS.poll.CLOSED : STATUS.poll.OPEN} />}
      description={`${p.totalVotes} vote${p.totalVotes === 1 ? '' : 's'}${p.closesAt ? ` · ${p.isClosed ? 'closed' : 'closes'} ${formatDateTime(p.closesAt)}` : ''}`}>
      {showVote ? (
        <fieldset>
          <legend className="sr-only">{p.question}</legend>
          <div className="space-y-2">
            {p.options.map((o) => (
              <label key={o.id} className={cx('flex min-h-[52px] cursor-pointer items-center gap-3 rounded-control border px-4 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-focus', choice === o.id ? 'border-brand bg-status-success-bg' : 'border-line-strong hover:bg-surface-sunken')}>
                <input type="radio" name={`poll-${p.id}`} className="h-5 w-5 accent-[rgb(var(--gk-brand))]" checked={choice === o.id} onChange={() => setChoice(o.id)} />
                <span className="text-body">{o.text}</span>
              </label>
            ))}
          </div>
          <Button className="mt-4" icon={Vote} disabled={!choice} loading={vote.isPending} onClick={() => vote.mutate()}>Submit vote</Button>
        </fieldset>
      ) : (
        <ul className="space-y-3">
          {p.options.map((o) => {
            const pct = p.totalVotes ? Math.round((o.votes / p.totalVotes) * 100) : 0;
            const mine = p.myVoteOptionId === o.id;
            return (
              <li key={o.id}>
                <div className="flex items-baseline justify-between gap-3 text-body-sm">
                  <span className="font-semibold text-fg">{o.text}{mine && <span className="ml-2 text-caption font-medium text-brand-fg">Your vote</span>}</span>
                  <span className="tabular-nums text-fg-muted">{pct}% · {o.votes}</span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-xs bg-slate-200 dark:bg-line" aria-hidden>
                  <div className={cx('h-full', o.votes === max && max > 0 ? 'bg-brand' : 'bg-navy-200 dark:bg-navy-600')} style={{ width: `${pct}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {footer}
    </Card>
  );
}

export default function Community() {
  const [tab, setTab] = useState<'notices' | 'polls'>('notices');
  const [cat, setCat] = useState('');
  const notices = useGet<List<Notice>>('/notices', { category: cat || undefined, limit: 100 });
  const polls = useGet<List<Poll>>(tab === 'polls' ? '/polls' : null);
  return (
    <>
      <PageHeader title="Community" description="Notices from the committee and polls for everyone in the society." />
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'notices', label: 'Notices' }, { id: 'polls', label: 'Polls' }]} />
      {tab === 'notices' ? (
        <>
          <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0" role="group" aria-label="Filter by category">
            {[['', 'All'], ...Object.entries(NOTICE_CAT).map(([k, v]) => [k, v.label])].map(([k, l]) => (
              <button key={k} type="button" aria-pressed={cat === k} onClick={() => setCat(k)}
                className={cx('h-11 shrink-0 rounded-full border px-4 text-label', cat === k ? 'border-navy-900 bg-navy-900 text-white dark:border-navy-200 dark:bg-navy-200 dark:text-navy-950' : 'border-line-strong text-fg-muted hover:text-fg')}>{l}</button>
            ))}
          </div>
          <Card bodyClass="!py-0">
            <Async q={notices} empty={<EmptyState icon={Megaphone} title="No notices yet." body="Notices from the committee will appear here." />}>
              {(d) => <ul className="divide-y divide-line">{d.items.map((n) => <li key={n.id}><NoticeBody n={n} /></li>)}</ul>}
            </Async>
          </Card>
        </>
      ) : (
        <Async q={polls} empty={<Card><EmptyState icon={Vote} title="No polls right now." body="When the committee asks for opinions, you can vote here." /></Card>}>
          {(d) => <div className="space-y-4">{d.items.map((p) => <PollCard key={p.id} p={p} canVote />)}</div>}
        </Async>
      )}
    </>
  );
}
