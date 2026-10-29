import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Ban, CalendarClock, Check, CircleAlert, DoorOpen, HandHelping, Hourglass, KeyRound, LogIn, LogOut,
  Package, PackageCheck, Phone, Send, TimerOff, UserRoundPlus,
} from 'lucide-react';
import { ApiError, post, useAct, useGet } from '../../lib/api';
import { cleanPhone, formatCountdown, formatRelative, formatTime, maskPhone, todayIST } from '../../lib/format';
import { STAFF_CAT, STATUS, VISITOR_TYPE } from '../../lib/status';
import type { Flat, GateVerifyResult, List, Member, PreApproval, Staff, Visitor, VisitorType } from '../../lib/types';
import { Keypad } from '../../components/Keypad';
import {
  Async, Avatar, Button, ButtonLink, Card, cx, EmptyState, Field, Input, StatusChip, useNow,
} from '../../components/ui';
import { SosBoard } from '../admin/Sos';

const H1 = ({ children, actions }: { children: ReactNode; actions?: ReactNode }) => (
  <div className="mb-6 flex flex-wrap items-center justify-between gap-4"><h1 className="text-guard-xl">{children}</h1>{actions}</div>
);
const Back = ({ to = '/app/gate' }: { to?: string }) => (
  <Link to={to} className="inline-flex h-16 items-center gap-2 rounded-control border border-line-strong bg-surface px-5 text-guard-body font-semibold text-fg-heading hover:bg-surface-sunken">
    <ArrowLeft size={24} aria-hidden /> Back
  </Link>
);

/** One big guard row: identity on the left, action on the right. */
function Row({ v, action, extra }: { v: Visitor; action?: ReactNode; extra?: ReactNode }) {
  const T = VISITOR_TYPE[v.type];
  return (
    <li className="flex flex-wrap items-center gap-4 py-4">
      <Avatar name={v.name} size={48} icon={v.type === 'GUEST' ? undefined : T.icon} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-guard-body font-semibold text-fg-heading">{v.name}{v.company && <span className="font-medium text-fg-muted"> · {v.company}</span>}</p>
        <p className="text-body tabular-nums text-fg-muted">{v.flat.label} · {T.label}{extra}</p>
      </div>
      {action}
    </li>
  );
}

/* ── Verify passcode (home) ────────────────────────────────────────── */
type Outcome = { tone: 'success' | 'danger'; title: string; body: string };
function outcomeOf(r: GateVerifyResult): Outcome {
  if (r.kind === 'VISITOR') {
    const v = r.visitor;
    return { tone: 'success', title: 'Passcode accepted', body: `${v.name}, ${VISITOR_TYPE[v.type].label.toLowerCase()} of ${v.flat.label}. Checked in at ${formatTime(v.checkInAt ?? new Date())}.` };
  }
  const s = r.staff, cat = STAFF_CAT[s.category].label.toLowerCase();
  return r.action === 'CHECK_IN'
    ? { tone: 'success', title: 'Staff checked in', body: `${s.name} (${cat}) checked in at ${formatTime(r.attendance.checkInAt)}.` }
    : { tone: 'success', title: 'Staff checked out', body: `${s.name} (${cat}) checked out at ${formatTime(r.attendance.checkOutAt ?? new Date())}.` };
}
function failureOf(e: ApiError): Outcome {
  const reason = (e.details as { reason?: string } | undefined)?.reason;
  if (e.code === 'PASSCODE_INVALID' && reason === 'EXPIRED') return { tone: 'danger', title: 'Passcode expired', body: 'This invite has expired. Ask the resident to send a new invite.' };
  if (e.code === 'PASSCODE_INVALID' && reason === 'NOT_YET_VALID') return { tone: 'danger', title: 'Not valid yet', body: "This invite isn't valid yet. Ask the guest to come back within the invite window, or log them manually." };
  if (e.code === 'PASSCODE_INVALID') return { tone: 'danger', title: 'Passcode not recognised', body: "That passcode doesn't match any active invite. Check the digits or log the visitor manually." };
  return { tone: 'danger', title: 'Could not verify', body: e.message };
}

export function GateVerify() {
  const qc = useQueryClient();
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const verify = useMutation<GateVerifyResult, ApiError, string>({
    mutationFn: (passcode) => post('/gate/verify', { passcode }),
    onSuccess: (r) => { setOutcome(outcomeOf(r)); qc.invalidateQueries(); },
    onError: (e) => setOutcome(failureOf(e)),
  });
  useEffect(() => {
    if (!outcome) return;
    const t = setTimeout(() => setOutcome(null), 6000);
    return () => clearTimeout(t);
  }, [outcome]);
  const today = useGet<List<Visitor>>('/visitors', { date: todayIST(), limit: 8 });

  return (
    <div className="grid gap-8 lg:grid-cols-[3fr_2fr]">
      <section aria-labelledby="verify-h">
        <h1 id="verify-h" className="mb-6 text-guard-xl">Verify passcode</h1>
        {outcome ? (
          <div role="alert" className="mx-auto max-w-[480px] overflow-hidden rounded-card bg-surface shadow-raised dark:border dark:border-line">
            <div className={cx('flex items-center gap-3 px-6 py-5 text-white', outcome.tone === 'success' ? 'bg-brand' : 'bg-danger-600')}>
              {outcome.tone === 'success' ? <Check size={32} aria-hidden /> : <CircleAlert size={32} aria-hidden />}
              <p className="text-[24px] font-bold">{outcome.title}</p>
            </div>
            <div className="space-y-6 p-6">
              <p className="text-guard-body text-fg">{outcome.body}</p>
              <div className="flex flex-wrap gap-3">
                <Button size="xl" onClick={() => setOutcome(null)} variant={outcome.tone === 'success' ? 'primary' : 'outline'}>{outcome.tone === 'success' ? 'Done' : 'Try again'}</Button>
                {outcome.tone === 'danger' && <ButtonLink to="/app/gate/log" size="xl" variant="secondary" icon={UserRoundPlus}>Log manually</ButtonLink>}
              </div>
            </div>
          </div>
        ) : (
          <Keypad onSubmit={(c) => verify.mutate(c)} busy={verify.isPending} />
        )}
      </section>
      <section aria-labelledby="today-h" className="space-y-4">
        <ButtonLink to="/app/gate/log" size="xl" variant="secondary" full icon={UserRoundPlus}>Log a walk-in visitor</ButtonLink>
        <Card title={<span id="today-h">Today at the gate</span>}>
          <Async q={today} empty={<p className="text-guard-body text-fg-muted">No visitors yet today.</p>}>
            {(d) => (
              <ul className="-my-2 divide-y divide-line">
                {d.items.map((v) => (
                  <li key={v.id} className="flex items-center gap-3 py-3">
                    <span className="w-20 shrink-0 text-body tabular-nums text-fg-muted">{formatTime(v.createdAt)}</span>
                    <span className="min-w-0 flex-1"><span className="block truncate text-body font-semibold">{v.name}</span><span className="text-body-sm text-fg-muted">{v.flat.label}</span></span>
                    <StatusChip spec={STATUS.visitor[v.status]} />
                  </li>
                ))}
              </ul>
            )}
          </Async>
        </Card>
      </section>
    </div>
  );
}

/* ── Log visitor: type → flat → details → waiting ──────────────────── */
const COMPANIES: Record<VisitorType, string[]> = {
  DELIVERY: ['Swiggy', 'Zomato', 'Amazon', 'Flipkart', 'Blinkit', 'Zepto'],
  CAB: ['Uber', 'Ola', 'Rapido'],
  SERVICE: ['Urban Company'],
  GUEST: [],
};

function Waiting({ created, onAgain }: { created: Visitor; onAgain: () => void }) {
  const now = useNow();
  const list = useGet<List<Visitor>>('/visitors', { date: todayIST(), limit: 200 });
  const residents = useGet<List<Member>>('/members', { flatId: created.flat.id });
  const v = list.data?.items.find((x) => x.id === created.id) ?? created;
  const checkIn = useAct(() => post(`/visitors/${v.id}/check-in`), { success: `${v.name} checked in.` });
  const left = v.expiresAt ? new Date(v.expiresAt).getTime() - now : 0;
  const people = residents.data?.items ?? [];
  const notified = people.length ? `${people[0].user.name}${people.length > 1 ? ` and ${people.length - 1} other${people.length > 2 ? 's' : ''}` : ''}` : 'Nobody';
  const status = v.status === 'PENDING_APPROVAL' && left <= 0 ? 'EXPIRED' : v.status;

  const panel: Record<string, { tone: string; icon: typeof Check; text: string }> = {
    PENDING_APPROVAL: { tone: 'bg-status-warning-bg text-status-warning-fg', icon: Hourglass, text: `Waiting for ${v.flat.label} to respond… ${notified} ${people.length === 1 ? 'has' : 'have'} been notified.` },
    APPROVED: { tone: 'bg-status-success-bg text-status-success-fg', icon: Check, text: `Approved by ${v.decidedBy?.name ?? 'the resident'} (${v.flat.label}). Let them in, then tap Check in.` },
    DENIED: { tone: 'bg-status-danger-bg text-status-danger-fg', icon: Ban, text: `Denied by ${v.flat.label}. Please ask the visitor to leave politely.` },
    LEFT_AT_GATE: { tone: 'bg-status-gold-bg text-status-gold-fg', icon: Package, text: 'Keep the parcel at the gate. The resident will collect it.' },
    EXPIRED: { tone: 'bg-status-neutral-bg text-status-neutral-fg', icon: TimerOff, text: `No response from ${v.flat.label} in 10 minutes. Call the flat or deny entry.` },
    CHECKED_IN: { tone: 'bg-status-info-bg text-status-info-fg', icon: LogIn, text: `${v.name} checked in at ${v.checkInAt ? formatTime(v.checkInAt) : ''}.` },
  };
  const p = panel[status] ?? panel.CHECKED_IN;
  return (
    <div className="mx-auto max-w-2xl">
      <H1>{v.name}</H1>
      <div className={cx('rounded-card p-6', p.tone)} role="status" aria-live="polite">
        <div className="flex items-start gap-4">
          <p.icon size={32} aria-hidden className="shrink-0" />
          <p className="flex-1 text-guard-body">{p.text}</p>
          {status === 'PENDING_APPROVAL' && <span className="text-guard-xl tabular-nums">{formatCountdown(left)}</span>}
        </div>
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        {status === 'APPROVED' && <Button size="xl" variant="secondary" icon={LogIn} loading={checkIn.isPending} onClick={() => checkIn.mutate()}>Check in</Button>}
        {status === 'EXPIRED' && people.map((m) => (
          <a key={m.id} href={`tel:${m.user.phone}`} className="inline-flex h-[72px] items-center gap-3 rounded-control border border-line-strong bg-surface px-6 text-[20px] font-bold text-fg-heading">
            <Phone size={24} aria-hidden /> Call {m.user.name.split(' ')[0]} {maskPhone(m.user.phone)}
          </a>
        ))}
        <Button size="xl" variant={status === 'PENDING_APPROVAL' ? 'outline' : 'primary'} icon={UserRoundPlus} onClick={onAgain}>Log another visitor</Button>
      </div>
    </div>
  );
}

export function GateLog() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [type, setType] = useState<VisitorType | null>(null);
  const [flat, setFlat] = useState<Flat | null>(null);
  const [block, setBlock] = useState<string | null>(null);
  const [f, setF] = useState({ company: '', other: false, name: '', phone: '', vehicleNo: '', purpose: '' });
  const [err, setErr] = useState<string | null>(null);
  const [created, setCreated] = useState<Visitor | null>(null);
  const flats = useGet<List<Flat>>('/flats');
  const residents = useGet<List<Member>>(flat ? '/members' : null, { flatId: flat?.id });
  const create = useAct(() => post<Visitor>('/visitors', {
    flatId: flat!.id, type, name: (f.name.trim() || f.company.trim()),
    company: f.company.trim() || undefined, phone: cleanPhone(f.phone) || undefined,
    vehicleNo: f.vehicleNo.replace(/\s+/g, '').toUpperCase() || undefined, purpose: f.purpose.trim() || undefined,
  }), { success: 'Sent for approval.', onSuccess: (v) => setCreated(v) });

  const reset = () => { setStep(1); setType(null); setFlat(null); setCreated(null); setErr(null); setF({ company: '', other: false, name: '', phone: '', vehicleNo: '', purpose: '' }); };
  if (created) return <Waiting created={created} onAgain={reset} />;

  const blocks = [...new Set((flats.data?.items ?? []).map((x) => x.block.name))];
  const activeBlock = block ?? blocks[0];
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!f.name.trim() && !(type === 'DELIVERY' && f.company.trim())) return setErr(type === 'DELIVERY' ? 'Enter a name or pick the company.' : "Enter the visitor's name.");
    if (f.phone && !/^\d{10,15}$/.test(cleanPhone(f.phone))) return setErr('Enter a 10-digit phone number or leave it empty.');
    setErr(null); create.mutate();
  };
  const stepper = ['Type', 'Flat', 'Details'];
  const T = type ? VISITOR_TYPE[type] : null;
  const tile = 'flex flex-col items-center justify-center gap-3 rounded-card border-2 bg-surface text-guard-body font-bold transition-colors hover:bg-surface-sunken active:scale-[.98]';

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-4">
        {step > 1 ? <button type="button" onClick={() => setStep((s) => (s - 1) as 1 | 2)} className="inline-flex h-16 items-center gap-2 rounded-control border border-line-strong bg-surface px-5 text-guard-body font-semibold"><ArrowLeft size={24} aria-hidden />Back</button> : <Back />}
        <h1 className="text-guard-xl">Log visitor</h1>
        <ol className="ml-auto flex gap-2 text-body" aria-label="Progress">
          {stepper.map((s, i) => (
            <li key={s} aria-current={step === i + 1 ? 'step' : undefined} className={cx('flex items-center gap-2 rounded-full px-3 py-1.5', step === i + 1 ? 'bg-navy-900 text-white dark:bg-navy-200 dark:text-navy-950' : step > i + 1 ? 'text-status-success-fg' : 'text-fg-muted')}>
              {step > i + 1 ? <Check size={18} aria-hidden /> : <span className="tabular-nums">{i + 1}</span>} {s}
            </li>
          ))}
        </ol>
      </div>

      {step === 1 && (
        <div className="grid grid-cols-2 gap-4">
          {(Object.keys(VISITOR_TYPE) as VisitorType[]).map((t) => {
            const V = VISITOR_TYPE[t];
            return (
              <button key={t} type="button" onClick={() => { setType(t); setStep(2); }} className={cx(tile, 'h-40', type === t ? 'border-brand' : 'border-line-strong')}>
                <V.icon size={40} strokeWidth={2} aria-hidden />{V.label}
              </button>
            );
          })}
        </div>
      )}

      {step === 2 && (
        <Async q={flats} empty={<EmptyState icon={DoorOpen} title="No flats set up yet." body="Ask the committee to add blocks and flats." />}>
          {(d) => (
            <>
              <div role="tablist" aria-label="Block" className="mb-4 flex flex-wrap gap-2">
                {blocks.map((b) => (
                  <button key={b} role="tab" aria-selected={b === activeBlock} type="button" onClick={() => setBlock(b)}
                    className={cx('h-16 min-w-[96px] rounded-control border-2 px-6 text-guard-body font-bold', b === activeBlock ? 'border-navy-900 bg-navy-900 text-white dark:border-navy-200 dark:bg-navy-200 dark:text-navy-950' : 'border-line-strong bg-surface')}>
                    Block {b}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                {d.items.filter((x) => x.block.name === activeBlock).map((x) => (
                  <button key={x.id} type="button" onClick={() => { setFlat(x); setStep(3); }}
                    className={cx(tile, 'h-20 gap-0 text-[24px]', x.residentCount ? 'border-line-strong' : 'border-dashed border-warning-500')}>
                    <span className="tabular-nums">{x.number}</span>
                    <span className="text-caption font-medium text-fg-muted">{x.residentCount ? `${x.residentCount} resident${x.residentCount > 1 ? 's' : ''}` : 'No residents'}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </Async>
      )}

      {step === 3 && T && flat && (
        <form onSubmit={submit} noValidate className="max-w-3xl space-y-6">
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => setStep(1)} className="inline-flex h-16 items-center gap-3 rounded-card border border-line-strong bg-surface px-5 text-guard-body font-semibold"><T.icon size={24} aria-hidden />{T.label}<span className="text-body text-brand-fg">Change</span></button>
            <button type="button" onClick={() => setStep(2)} className="inline-flex h-16 items-center gap-3 rounded-card border border-line-strong bg-surface px-5 text-guard-body font-semibold"><DoorOpen size={24} aria-hidden />{flat.label}<span className="text-body text-fg-muted">· {residents.data?.items.length ?? flat.residentCount} residents</span><span className="text-body text-brand-fg">Change</span></button>
          </div>
          {flat.residentCount === 0 && (
            <p role="alert" className="flex gap-3 rounded-card bg-status-warning-bg p-4 text-guard-body text-status-warning-fg"><CircleAlert size={24} className="shrink-0" aria-hidden />{flat.label} has no residents on Gatekeeper. Call the committee or deny entry.</p>
          )}
          {COMPANIES[type!].length > 0 && (
            <fieldset>
              <legend className="mb-2 text-guard-body font-semibold">Company</legend>
              <div className="flex flex-wrap gap-2">
                {[...COMPANIES[type!], 'Other'].map((c) => {
                  const on = c === 'Other' ? f.other : !f.other && f.company === c;
                  return (
                    <button key={c} type="button" aria-pressed={on} onClick={() => setF({ ...f, company: c === 'Other' ? '' : c, other: c === 'Other' })}
                      className={cx('h-14 rounded-full border-2 px-5 text-body font-semibold', on ? 'border-brand bg-status-success-bg text-status-success-fg' : 'border-line-strong bg-surface')}>{c}</button>
                  );
                })}
              </div>
              {f.other && <Input className="mt-3 !h-16 !text-guard-body" placeholder="Company name" value={f.company} maxLength={80} onChange={(e) => setF({ ...f, company: e.target.value })} aria-label="Company name" />}
            </fieldset>
          )}
          <Field label={type === 'DELIVERY' ? 'Name (optional for deliveries)' : 'Name'}>
            <Input className="!h-16 !text-guard-body" value={f.name} maxLength={80} onChange={(e) => setF({ ...f, name: e.target.value })} autoFocus />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Phone" optional><Input className="!h-16 !text-guard-body tabular-nums" type="tel" inputMode="numeric" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
            <Field label="Vehicle number" optional><Input className="!h-16 !text-guard-body uppercase" value={f.vehicleNo} maxLength={20} onChange={(e) => setF({ ...f, vehicleNo: e.target.value.toUpperCase() })} placeholder="KA 01 AB 1234" /></Field>
          </div>
          <Field label="Purpose" optional><Input className="!h-16 !text-guard-body" value={f.purpose} maxLength={200} onChange={(e) => setF({ ...f, purpose: e.target.value })} /></Field>
          {err && <p role="alert" className="text-guard-body text-critical-fg">{err}</p>}
          <Button type="submit" size="xl" full icon={Send} loading={create.isPending}>Send for approval</Button>
        </form>
      )}
    </div>
  );
}

/* ── Awaiting approval ─────────────────────────────────────────────── */
export function GatePending() {
  const now = useNow();
  const q = useGet<List<Visitor>>('/visitors', { status: 'PENDING_APPROVAL' });
  return (
    <>
      <H1 actions={<ButtonLink to="/app/gate/log" size="lg" variant="secondary" icon={UserRoundPlus}>Log visitor</ButtonLink>}>Awaiting approval</H1>
      <Card>
        <Async q={q} empty={<EmptyState icon={Hourglass} title="Nobody is waiting." body="Visitors you log appear here until the flat responds." positive />}>
          {(d) => (
            <ul className="-my-4 divide-y divide-line">
              {d.items.map((v) => {
                const left = v.expiresAt ? new Date(v.expiresAt).getTime() - now : 0;
                return <Row key={v.id} v={v} extra={` · logged ${formatTime(v.createdAt)}`} action={
                  <StatusChip big spec={left > 0 ? { ...STATUS.visitor.PENDING_APPROVAL, label: `${formatCountdown(left)} left`, tone: left < 120_000 ? 'danger' : 'warning' } : STATUS.visitor.EXPIRED} />
                } />;
              })}
            </ul>
          )}
        </Async>
      </Card>
    </>
  );
}

/* ── Expected: approved-not-in + today's invites ───────────────────── */
function CheckInButton({ v }: { v: Visitor }) {
  const m = useAct(() => post(`/visitors/${v.id}/check-in`), { success: `${v.name} checked in.` });
  return <Button size="lg" variant="secondary" icon={LogIn} loading={m.isPending} onClick={() => m.mutate()} className="!h-16">Check in</Button>;
}
export function GateExpected() {
  const approved = useGet<List<Visitor>>('/visitors', { status: 'APPROVED' });
  const invites = useGet<List<PreApproval>>('/preapprovals', { status: 'ACTIVE' });
  return (
    <>
      <H1>Expected</H1>
      <div className="space-y-6">
        <Card title="Approved, not yet in">
          <Async q={approved} empty={<p className="text-guard-body text-fg-muted">No approved visitors waiting.</p>}>
            {(d) => <ul className="-my-4 divide-y divide-line">{d.items.map((v) => <Row key={v.id} v={v} extra={v.decidedAt ? ` · approved ${formatTime(v.decidedAt)}` : ''} action={<CheckInButton v={v} />} />)}</ul>}
          </Async>
        </Card>
        <Card title="Invited guests today" description="Ask the guest for their 6-digit passcode, then verify it.">
          <Async q={invites} empty={<EmptyState icon={CalendarClock} title="No guests expected today." body="Pre-approved guests appear here." />}>
            {(d) => (
              <ul className="-my-4 divide-y divide-line">
                {d.items.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center gap-4 py-4">
                    <Avatar name={p.guestName} size={48} />
                    <div className="min-w-0 flex-1">
                      <p className="text-guard-body font-semibold text-fg-heading">{p.guestName}</p>
                      <p className="text-body tabular-nums text-fg-muted">{p.flat.label} · {VISITOR_TYPE[p.type].label} · until {formatTime(p.validTo)} · {p.maxUses - p.usedCount} entr{p.maxUses - p.usedCount === 1 ? 'y' : 'ies'} left</p>
                    </div>
                    <ButtonLink to="/app/gate" size="lg" variant="outline" icon={KeyRound} className="!h-16">Verify passcode</ButtonLink>
                  </li>
                ))}
              </ul>
            )}
          </Async>
        </Card>
      </div>
    </>
  );
}

/* ── Inside now ────────────────────────────────────────────────────── */
function RowAction({ v, kind }: { v: Visitor; kind: 'out' | 'collect' }) {
  const m = useAct(() => post(`/visitors/${v.id}/${kind === 'out' ? 'check-out' : 'collect'}`), { success: kind === 'out' ? `${v.name} checked out.` : 'Parcel marked as collected.' });
  return <Button size="lg" variant="outline" className="!h-16" icon={kind === 'out' ? LogOut : PackageCheck} loading={m.isPending} onClick={() => m.mutate()}>{kind === 'out' ? 'Check out' : 'Collected'}</Button>;
}
export function GateInside() {
  const inside = useGet<List<Visitor>>('/visitors', { status: 'CHECKED_IN', limit: 200 });
  const parcels = useGet<List<Visitor>>('/visitors', { status: 'LEFT_AT_GATE', limit: 200 });
  const staff = useGet<List<Staff>>('/staff');
  const now = useNow(60_000);
  const staffIn = (staff.data?.items ?? []).filter((s) => s.isInside);
  const dur = (iso: string | null) => { if (!iso) return ''; const m = Math.round((now - new Date(iso).getTime()) / 60000); return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`; };
  return (
    <>
      <H1>Inside now</H1>
      <div className="space-y-6">
        <Card title="Visitors inside">
          <Async q={inside} empty={<EmptyState icon={DoorOpen} title="Nobody is inside right now." body="Checked-in visitors will appear here." />}>
            {(d) => <ul className="-my-4 divide-y divide-line">{d.items.map((v) => <Row key={v.id} v={v} extra={v.checkInAt ? ` · in ${formatTime(v.checkInAt)} · ${dur(v.checkInAt)}` : ''} action={<RowAction v={v} kind="out" />} />)}</ul>}
          </Async>
        </Card>
        {!!parcels.data?.items.length && (
          <Card title="Parcels at the gate">
            <ul className="-my-4 divide-y divide-line">{parcels.data.items.map((v) => <Row key={v.id} v={v} extra={` · left ${formatRelative(v.decidedAt ?? v.createdAt)}`} action={<RowAction v={v} kind="collect" />} />)}</ul>
          </Card>
        )}
        <Card title="Daily help inside">
          <Async q={staff} isEmpty={() => !staffIn.length} empty={<p className="text-guard-body text-fg-muted">No daily help inside.</p>}>
            {() => (
              <ul className="-my-3 divide-y divide-line">
                {staffIn.map((s) => (
                  <li key={s.id} className="flex items-center gap-4 py-3 text-guard-body">
                    <Avatar name={s.name} seed={s.id} size={40} /><span className="flex-1 font-semibold">{s.name}</span>
                    <span className="text-body text-fg-muted">{STAFF_CAT[s.category].label} · {s.flats.map((x) => x.label).join(', ')}</span>
                  </li>
                ))}
              </ul>
            )}
          </Async>
        </Card>
      </div>
    </>
  );
}

/* ── Staff ─────────────────────────────────────────────────────────── */
export function GateStaff() {
  const q = useGet<List<Staff>>('/staff');
  const [search, setSearch] = useState('');
  const navigate = useNavigate();
  const list = (q.data?.items ?? []).filter((s) => `${s.name} ${s.flats.map((f) => f.label).join(' ')}`.toLowerCase().includes(search.toLowerCase()));
  return (
    <>
      <H1>Staff</H1>
      <p className="-mt-3 mb-5 text-guard-body text-fg-muted">Daily help check in and out with their passcode on the Verify screen.</p>
      <Input type="search" className="mb-5 !h-16 max-w-md !text-guard-body" placeholder="Search by name or flat" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search staff" />
      <Async q={q} isEmpty={() => !list.length} empty={<Card><EmptyState icon={HandHelping} title={search ? `No results for “${search}”.` : 'No daily help registered.'} body={search ? 'Check the name or flat number.' : 'The committee registers daily help.'} /></Card>}>
        {() => (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {list.map((s) => {
              const C = STAFF_CAT[s.category];
              return (
                <li key={s.id} className="flex items-center gap-4 rounded-card bg-surface p-4 shadow-card dark:border dark:border-line">
                  <Avatar name={s.name} seed={s.id} size={56} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-guard-body font-semibold">{s.name}</p>
                    <p className="flex items-center gap-1.5 text-body text-fg-muted"><C.icon size={16} aria-hidden />{C.label} · {s.flats.map((f) => f.label).join(', ') || 'No flat'}</p>
                    <div className="mt-2"><StatusChip spec={s.isInside ? STATUS.staff.INSIDE : STATUS.staff.OUT} /></div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Async>
      <Button className="mt-6" size="lg" icon={KeyRound} onClick={() => navigate('/app/gate')}>Go to Verify</Button>
    </>
  );
}

export function GateSos() {
  return (<><H1>SOS alerts</H1><SosBoard big /></>);
}
