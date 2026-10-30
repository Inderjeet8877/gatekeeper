import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Check, ChevronRight, IndianRupee, LifeBuoy, Megaphone, Pin, Siren, Ticket, UserRoundCheck } from 'lucide-react';
import { post, useGet, useAct } from '../../lib/api';
import { formatINR, formatISODate, formatLongDay, formatPeriod, formatRelative, formatTime, greeting, todayIST } from '../../lib/format';
import { NOTICE_CAT, SOS_TYPE, STATUS, STAFF_CAT } from '../../lib/status';
import type { Invoice, List, Notice, SosAlert, SosType, Staff, Visitor } from '../../lib/types';
import { useAuth } from '../../auth/AuthContext';
import { Async, Badge, Button, ButtonLink, Card, cx, EmptyState, Field, Input, Modal, Skeleton, StatusChip } from '../../components/ui';
import { ApprovalCard, Parcels, VisitorRow } from './Visitors';

/* ── SOS: press and hold 2 s (docs/09 §4.21) ───────────────────────── */
const C = 2 * Math.PI * 40;
export function SosButton() {
  const [holding, setHolding] = useState(false);
  const [hint, setHint] = useState(false);
  const [sheet, setSheet] = useState(false);
  const timer = useRef<number>();
  const start = () => {
    if (holding) return;
    setHolding(true); setHint(false);
    timer.current = window.setTimeout(() => { setHolding(false); setSheet(true); }, 2000);
  };
  const stop = () => {
    if (!holding) return;
    window.clearTimeout(timer.current);
    setHolding(false); setHint(true);
  };
  return (
    <>
      <div className="fixed bottom-24 right-4 z-raised flex flex-col items-center lg:bottom-8 lg:right-8">
        {hint && <p role="status" className="mb-2 max-w-[180px] rounded-control bg-surface-raised px-3 py-2 text-caption text-fg shadow-raised">Press and hold for 2 seconds to alert security.</p>}
        <button type="button" aria-label="SOS. Press and hold for 2 seconds to alert security."
          onPointerDown={start} onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop} onContextMenu={(e) => e.preventDefault()}
          onKeyDown={(e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); start(); } }}
          onKeyUp={(e) => { if (e.key === ' ' || e.key === 'Enter') stop(); }}
          className="relative flex h-[72px] w-[72px] touch-none select-none items-center justify-center rounded-full bg-danger-600 text-white shadow-sos">
          <svg className="pointer-events-none absolute -inset-[6px] h-[84px] w-[84px] -rotate-90" viewBox="0 0 84 84" aria-hidden>
            <circle cx="42" cy="42" r="40" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round"
              strokeDasharray={C} strokeDashoffset={holding ? 0 : C} className={cx('gk-sos-ring', !holding && 'rewind')} />
          </svg>
          <Siren size={32} aria-hidden />
        </button>
        {/* Pill backing so the label stays readable over list content scrolling underneath. */}
        <span className="mt-1.5 flex flex-col items-center rounded-control bg-surface-raised/95 px-2 py-0.5 leading-tight shadow-raised">
          <span className="text-label text-fg-heading">SOS</span>
          <span className="text-caption text-fg-subtle">{holding ? 'Keep holding…' : 'Hold 2 s'}</span>
        </span>
        <span className="sr-only" aria-live="assertive">{holding ? 'Hold for 2 seconds' : ''}</span>
      </div>
      <SosSheet open={sheet} onClose={() => setSheet(false)} />
    </>
  );
}

export function SosSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [type, setType] = useState<SosType | null>(null);
  const [message, setMessage] = useState('');
  const [sentId, setSentId] = useState<string | null>(null);
  const mine = useGet<List<SosAlert>>(sentId ? '/sos' : null, { limit: 10 });
  const send = useAct(() => post<SosAlert>('/sos', { type, message: message.trim() || undefined }), {
    quiet: true, onSuccess: (a) => setSentId(a.id),
  });
  const alert = mine.data?.items.find((a) => a.id === sentId) ?? (send.data?.id === sentId ? send.data : undefined);
  const close = () => { onClose(); setType(null); setMessage(''); setSentId(null); send.reset(); };
  const steps: [string, string | null][] = alert ? [
    ['Raised', formatTime(alert.createdAt)],
    ['Acknowledged', alert.acknowledgedAt ? `${alert.acknowledgedBy?.name ?? 'Security'} is on the way · ${formatTime(alert.acknowledgedAt)}` : null],
    ['Resolved', alert.resolvedAt ? formatTime(alert.resolvedAt) : null],
  ] : [];

  return (
    <Modal open={open} onClose={close} dismissible={false} title={alert ? 'Alert sent' : "What's the emergency?"}
      footer={alert ? <Button onClick={close}>Close</Button> : (
        <>
          <Button variant="ghost" onClick={close}>Cancel</Button>
          <Button variant="danger" size="lg" icon={Siren} disabled={!type} loading={send.isPending} onClick={() => send.mutate()}>Send alert</Button>
        </>
      )}>
      {alert ? (
        <div className="space-y-5">
          <p className="rounded-card bg-status-danger-bg p-4 text-body text-status-danger-fg">Alert sent at {formatTime(alert.createdAt)}. Security has been notified. Stay where you are if it is safe.</p>
          <ol className="space-y-4">
            {steps.map(([label, detail]) => (
              <li key={label} className="flex items-start gap-3">
                <span className={cx('mt-1 h-3 w-3 shrink-0 rounded-full', detail ? 'bg-status-success-dot' : 'border-2 border-line-strong')} aria-hidden />
                <span><span className="block text-label">{label}</span><span className="text-body-sm text-fg-muted">{detail ?? 'Waiting…'}</span></span>
              </li>
            ))}
          </ol>
          <p className="text-caption text-fg-subtle">Only security or the committee can close an alert, so it can't be cancelled by accident.</p>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Emergency type">
            {(Object.keys(SOS_TYPE) as SosType[]).map((t) => {
              const T = SOS_TYPE[t];
              return (
                <button key={t} type="button" role="radio" aria-checked={type === t} onClick={() => setType(t)}
                  className={cx('flex h-[88px] flex-col items-center justify-center gap-2 rounded-card border-2 text-label transition-colors', type === t ? 'border-danger-600 bg-status-danger-bg text-status-danger-fg' : 'border-line-strong text-fg hover:bg-surface-sunken')}>
                  <T.icon size={32} strokeWidth={1.75} aria-hidden />{T.label}
                </button>
              );
            })}
          </div>
          <Field label="Message" optional><Input value={message} maxLength={300} onChange={(e) => setMessage(e.target.value)} placeholder="e.g. Elderly parent fainted" /></Field>
          {send.isError && <p role="alert" className="rounded-control bg-status-danger-bg p-3 text-body-sm text-status-danger-fg">Alert not sent. {send.error.message} Call the gate directly, then try again.</p>}
          {type && <p className="text-body-sm text-fg-muted">Send a {SOS_TYPE[type].label.toLowerCase()} alert to security now? Guards on duty and the committee will be alerted with your flat number.</p>}
        </div>
      )}
    </Modal>
  );
}

/* ── Home ──────────────────────────────────────────────────────────── */
export default function ResidentHome() {
  const { user, active } = useAuth();
  const flatId = active?.flat?.id;
  const flatLabel = active?.flat ? `${active.flat.block.name}-${active.flat.number}` : '';
  const pending = useGet<List<Visitor>>('/visitors', { status: 'PENDING_APPROVAL' });
  const today = useGet<List<Visitor>>('/visitors', { date: todayIST(), limit: 5 });
  const staff = useGet<List<Staff>>(flatId ? '/staff' : null, { flatId });
  const invoices = useGet<List<Invoice>>('/invoices', { limit: 12 });
  const notices = useGet<List<Notice>>('/notices', { limit: 2 });
  const live = (pending.data?.items ?? []).filter((v) => v.expiresAt && new Date(v.expiresAt).getTime() > Date.now());
  const dues = (invoices.data?.items ?? []).filter((i) => i.status !== 'PAID');
  const inside = (staff.data?.items ?? []).filter((s) => s.isInside);

  const quick = [
    { to: '/app/home/visitors?invite=1', label: 'Invite guest', icon: Ticket },
    { to: '/app/home/services?tab=helpdesk&new=1', label: 'Raise request', icon: LifeBuoy },
    { to: '/app/home/services?tab=amenities', label: 'Book amenity', icon: CalendarDays },
    { to: '/app/home/payments', label: 'Pay dues', icon: IndianRupee },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-[2rem] font-medium leading-tight tracking-[-0.015em] sm:text-display-lg">{greeting()}, {user?.name.split(' ')[0]}</h1>
        <p className="mt-1 text-body text-fg-muted">{flatLabel}, {active?.society.name} · {formatLongDay()}</p>
      </div>

      {live.length > 0 && <div className="space-y-4">{live.map((v) => <ApprovalCard key={v.id} v={v} />)}</div>}
      <Parcels />

      <nav aria-label="Quick actions" className="grid grid-cols-4 gap-2 sm:gap-4">
        {quick.map((q) => (
          <Link key={q.label} to={q.to} className="group flex flex-col items-center gap-2 rounded-card p-2 text-center text-caption font-semibold text-fg-heading hover:bg-surface-sunken">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-surface text-brand-fg shadow-card dark:border dark:border-line sm:h-[72px] sm:w-[72px]"><q.icon size={24} strokeWidth={1.75} aria-hidden /></span>
            {q.label}
          </Link>
        ))}
      </nav>

      <Card title={`Today at ${flatLabel}`} actions={<Link to="/app/home/visitors?tab=today" className="text-label text-brand-fg hover:underline">See all</Link>}>
        {inside.length > 0 && (
          <ul className="mb-3 space-y-2">
            {inside.map((s) => (
              <li key={s.id} className="flex items-center gap-3 text-body-sm">
                <StatusChip spec={STATUS.staff.INSIDE} /> <span className="font-semibold">{s.name}</span><span className="text-fg-muted">{STAFF_CAT[s.category].label}</span>
              </li>
            ))}
          </ul>
        )}
        <Async q={today} empty={inside.length ? null : <EmptyState icon={UserRoundCheck} title="No visitors yet today." body="Expecting someone? Pre-approve them for a faster entry." action={<ButtonLink to="/app/home/visitors?invite=1" variant="outline">Pre-approve guest</ButtonLink>} />}>
          {(d) => <ul className="-my-3 divide-y divide-line">{d.items.map((v) => <VisitorRow key={v.id} v={v} />)}</ul>}
        </Async>
      </Card>

      {invoices.isPending ? <Skeleton className="h-32 !rounded-card" /> : dues.length > 0 ? (
        <Card title={`${formatPeriod(dues[0].period)} maintenance`} actions={<StatusChip spec={STATUS.invoice[dues[0].status]} />}>
          <p className="text-numeric-lg tabular-nums text-fg-heading">{formatINR(dues.reduce((s, i) => s + i.amount, 0))}</p>
          <p className="mt-1 text-body-sm text-fg-muted">{dues.length > 1 ? `${dues.length} bills due · ` : ''}Due {formatISODate(dues[0].dueDate)}</p>
          <ButtonLink to="/app/home/payments" full className="mt-4" icon={IndianRupee}>Pay {formatINR(dues[0].amount)}</ButtonLink>
        </Card>
      ) : invoices.isSuccess ? (
        <Card><p className="flex items-center gap-2 text-body-sm text-fg-muted"><Check size={18} className="text-status-success-dot" aria-hidden />You're all paid up. New maintenance bills appear here on the 1st.</p></Card>
      ) : null}

      <Card title="Notices" actions={<Link to="/app/home/community" className="text-label text-brand-fg hover:underline">See all</Link>}>
        <Async q={notices} empty={<EmptyState icon={Megaphone} title="No notices yet." body="Notices from the committee will appear here." />} skeleton={<Skeleton className="h-16" />}>
          {(d) => (
            <ul className="-my-2 divide-y divide-line">
              {d.items.map((n) => {
                const Cat = NOTICE_CAT[n.category];
                return (
                  <li key={n.id}>
                    <Link to="/app/home/community" className="flex items-center gap-3 py-3">
                      <Cat.icon size={20} className="shrink-0 text-fg-subtle" aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2"><span className="truncate font-semibold text-fg-heading">{n.title}</span>{n.isPinned && <Badge icon={Pin}>Pinned</Badge>}</span>
                        <span className="block truncate text-body-sm text-fg-muted">{n.body}</span>
                      </span>
                      <span className="hidden text-caption text-fg-subtle sm:block">{formatRelative(n.createdAt)}</span>
                      <ChevronRight size={18} className="text-fg-subtle" aria-hidden />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Async>
      </Card>

      <SosButton />
    </div>
  );
}
