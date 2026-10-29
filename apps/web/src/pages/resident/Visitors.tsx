import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Ban, Check, Copy, History, Package, PackageCheck, Share2, Ticket, UserRoundCheck, X } from 'lucide-react';
import { del, post, useAct, useGet } from '../../lib/api';
import {
  cleanPhone, formatCountdown, formatDateTime, formatPasscode, formatRelative, formatTime, fromISTInput,
  maskPhone, todayIST, toISTInput,
} from '../../lib/format';
import { STATUS, VISITOR_TYPE } from '../../lib/status';
import type { List, PreApproval, Visitor, VisitorType } from '../../lib/types';
import { useAuth } from '../../auth/AuthContext';
import {
  Async, Avatar, Badge, Button, Card, ConfirmModal, cx, EmptyState, Field, Input, Modal, PageHeader, StatusChip,
  Tabs, useNow, useToast,
} from '../../components/ui';
import { LogoMark, Threshold } from '../../components/Logo';

/* ── Approval card (hero component, docs/09 §4.20) ─────────────────── */
export function ApprovalCard({ v, full, onDone }: { v: Visitor; full?: boolean; onDone?: () => void }) {
  const now = useNow();
  const [confirmDeny, setConfirmDeny] = useState(false);
  const [result, setResult] = useState<null | 'APPROVE' | 'DENY' | 'LEAVE_AT_GATE'>(null);
  const decide = useAct((d: 'APPROVE' | 'DENY' | 'LEAVE_AT_GATE') => post<Visitor>(`/visitors/${v.id}/decision`, { decision: d }), {
    success: (_, d) => d === 'APPROVE' ? 'Entry approved. The guard at the gate has been told.'
      : d === 'DENY' ? 'Entry denied. The guard at the gate has been told.'
        : "The guard will keep the parcel at the gate. We'll remind you to collect it.",
    onSuccess: (_, d) => { setResult(d); setConfirmDeny(false); if (onDone) setTimeout(onDone, 2500); },
  });
  const left = v.expiresAt ? new Date(v.expiresAt).getTime() - now : 0;
  const T = VISITOR_TYPE[v.type];
  const busy = decide.isPending ? decide.variables : null;
  const meta = [T.label, v.company, `arrived ${formatTime(v.createdAt)}`].filter(Boolean).join(' · ');

  const band = result && (
    <div role="status" className={cx('flex items-center gap-3 rounded-control px-4 py-3 text-body-sm font-semibold',
      result === 'APPROVE' ? 'bg-status-success-bg text-status-success-fg' : result === 'DENY' ? 'bg-status-danger-bg text-status-danger-fg' : 'bg-status-gold-bg text-status-gold-fg')}>
      {result === 'APPROVE' ? <Check size={20} aria-hidden /> : result === 'DENY' ? <Ban size={20} aria-hidden /> : <Package size={20} aria-hidden />}
      {result === 'APPROVE' ? `Entry approved · ${formatTime(new Date())}` : result === 'DENY' ? `Entry denied · ${formatTime(new Date())}` : 'Parcel will be kept at the gate'}
    </div>
  );
  const actions = !result && (
    <div className={cx('flex gap-3', full ? 'flex-col-reverse sm:flex-row sm:justify-end' : 'flex-wrap')}>
      <Button variant="danger-outline" size={full ? 'lg' : 'md'} icon={X} disabled={!!busy || left <= 0} onClick={() => setConfirmDeny(true)}>Deny</Button>
      {v.type === 'DELIVERY' && (
        <Button variant="outline" size={full ? 'lg' : 'md'} icon={Package} loading={busy === 'LEAVE_AT_GATE'} disabled={!!busy || left <= 0} onClick={() => decide.mutate('LEAVE_AT_GATE')}>Leave at gate</Button>
      )}
      <Button size={full ? 'lg' : 'md'} icon={Check} loading={busy === 'APPROVE'} disabled={!!busy || left <= 0} onClick={() => decide.mutate('APPROVE')} className={full ? '' : 'flex-1 sm:flex-none'}>
        {busy === 'APPROVE' ? 'Approving…' : 'Approve entry'}
      </Button>
    </div>
  );

  return (
    <article aria-label={`Visitor at the gate: ${v.name}, ${T.label} for ${v.flat.label}`} className={cx(full ? '' : 'rounded-card bg-surface p-5 shadow-card dark:border dark:border-line')}>
      <Threshold open={result === 'APPROVE'} className="mb-4" />
      <div className="flex items-center justify-between gap-3 text-caption text-fg-muted">
        <span>At Main Gate · logged by {v.loggedBy.name.split(' ')[0]}</span>
        {!result && (left > 0
          ? <StatusChip spec={{ ...STATUS.visitor.PENDING_APPROVAL, label: `${formatCountdown(left)} left`, tone: left < 120_000 ? 'danger' : 'warning' }} />
          : <StatusChip spec={STATUS.visitor.EXPIRED} />)}
      </div>
      {full ? (
        <div className="mt-6 flex flex-col items-center text-center">
          <Avatar name={v.name} size={80} icon={v.type === 'GUEST' ? undefined : T.icon} />
          <h3 className="mt-4 font-display text-display-lg" tabIndex={-1}>{v.name}</h3>
          <p className="mt-2 flex items-center gap-2 text-body text-fg-muted"><Badge icon={T.icon}>{T.label}</Badge>{v.company}</p>
          <p className="mt-2 text-h4 text-fg-heading">For {v.flat.label}</p>
          <dl className="mt-6 grid w-full grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-left text-body-sm">
            <dt className="text-fg-subtle">Arrived</dt><dd className="tabular-nums">{formatTime(v.createdAt)}</dd>
            {v.phone && <><dt className="text-fg-subtle">Phone</dt><dd className="tabular-nums">{maskPhone(v.phone)}</dd></>}
            {v.vehicleNo && <><dt className="text-fg-subtle">Vehicle</dt><dd>{v.vehicleNo}</dd></>}
            {v.purpose && <><dt className="text-fg-subtle">Purpose</dt><dd>{v.purpose}</dd></>}
          </dl>
        </div>
      ) : (
        <div className="mt-3 flex items-center gap-3">
          <Avatar name={v.name} size={48} icon={v.type === 'GUEST' ? undefined : T.icon} />
          <div className="min-w-0">
            <h3 className="truncate text-h4">{v.name}</h3>
            <p className="truncate text-body-sm text-fg-muted">{meta}</p>
          </div>
        </div>
      )}
      <div className="mt-5">{band || (left > 0 ? actions : <p className="text-body-sm text-fg-muted">This request expired at {formatTime(v.expiresAt!)}. The visitor was not let in.</p>)}</div>
      {full && !result && left > 0 && <p className="mt-4 text-center text-caption text-fg-subtle">Respond within 10 minutes. After that the request expires and the guard will call you.</p>}
      <ConfirmModal open={confirmDeny} onClose={() => setConfirmDeny(false)} title={`Deny entry to ${v.name}?`}
        body="The guard will ask them to leave." confirmLabel="Deny entry" loading={busy === 'DENY'} onConfirm={() => decide.mutate('DENY')} />
    </article>
  );
}

/** Full-screen approval when a visitor for my flat arrives (driven by the live pending list). */
export function ApprovalTakeover() {
  const q = useGet<List<Visitor>>('/visitors', { status: 'PENDING_APPROVAL' });
  const [dismissed, setDismissed] = useState<string[]>([]);
  const v = q.data?.items.find((x) => !dismissed.includes(x.id) && x.expiresAt && new Date(x.expiresAt).getTime() > Date.now());
  if (!v) return null;
  const close = () => setDismissed((d) => [...d, v.id]);
  return (
    <Modal open onClose={close} title={<span className="sr-only">Visitor at the gate</span>}>
      <ApprovalCard key={v.id} v={v} full onDone={close} />
    </Modal>
  );
}

export function VisitorRow({ v }: { v: Visitor }) {
  const T = VISITOR_TYPE[v.type];
  const times = [v.checkInAt && `In ${formatTime(v.checkInAt)}`, v.checkOutAt && `Out ${formatTime(v.checkOutAt)}`].filter(Boolean).join(' · ');
  return (
    <li className="flex items-center gap-3 py-3">
      <Avatar name={v.name} size={40} icon={v.type === 'GUEST' ? undefined : T.icon} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-h4 text-fg-heading">{v.name}</p>
        <p className="truncate text-body-sm text-fg-muted">{[T.label, v.company, v.preApprovalId && 'Invited'].filter(Boolean).join(' · ')}</p>
        <p className="text-caption tabular-nums text-fg-subtle">{times || formatRelative(v.createdAt)}</p>
      </div>
      <StatusChip spec={STATUS.visitor[v.status]} />
    </li>
  );
}

function ParcelCard({ v }: { v: Visitor }) {
  const collect = useAct(() => post(`/visitors/${v.id}/collect`), { success: 'Parcel marked as collected.' });
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-card bg-status-gold-bg p-4">
      <Package size={24} className="text-status-gold-dot" aria-hidden />
      <div className="min-w-0 flex-1 text-status-gold-fg">
        <p className="font-semibold">Parcel waiting at the gate</p>
        <p className="text-body-sm">{[v.company, v.name].filter(Boolean).join(' · ')} · left {formatRelative(v.decidedAt ?? v.createdAt)}</p>
      </div>
      <Button size="sm" variant="outline" icon={PackageCheck} loading={collect.isPending} onClick={() => collect.mutate()}>Mark collected</Button>
    </div>
  );
}
export function Parcels() {
  const q = useGet<List<Visitor>>('/visitors', { status: 'LEFT_AT_GATE' });
  if (!q.data?.items.length) return null;
  return <div className="space-y-3">{q.data.items.map((v) => <ParcelCard key={v.id} v={v} />)}</div>;
}

/* ── Invites ───────────────────────────────────────────────────────── */
function shareText(p: PreApproval, society: string) {
  return `You're invited to ${society} (${p.flat.label}). Show passcode ${formatPasscode(p.passcode ?? '')} to security at the Main Gate. Valid ${formatDateTime(p.validFrom)} – ${formatDateTime(p.validTo)}. — sent via Gatekeeper`;
}

export function PassCard({ p }: { p: PreApproval }) {
  const { active } = useAuth();
  return (
    <div className="rounded-card bg-navy-950 p-6 text-paper shadow-raised">
      <Threshold />
      <div className="mt-5 flex items-center gap-2 text-body-sm text-navy-200"><LogoMark size={24} />{active?.society.name}</div>
      <p className="mt-4 text-caption text-navy-300">Guest pass</p>
      <p className="font-display text-display-md text-paper">{p.guestName}</p>
      <p className="text-body-sm text-navy-200">Visiting {p.flat.label}</p>
      {p.passcode && <p className="mt-6 text-[40px] font-semibold tabular-nums tracking-[0.12em] text-gold-400" aria-label={`Passcode ${p.passcode.split('').join(' ')}`}>{formatPasscode(p.passcode)}</p>}
      <p className="mt-4 text-body-sm tabular-nums text-navy-200">Valid {formatDateTime(p.validFrom)} until {formatDateTime(p.validTo)}</p>
      <p className="text-body-sm text-navy-200">{p.maxUses} {p.maxUses === 1 ? 'entry' : 'entries'} · Main Gate · show this code to security</p>
    </div>
  );
}

function ShareActions({ p, onCancel }: { p: PreApproval; onCancel?: () => void }) {
  const { active } = useAuth();
  const toast = useToast();
  const share = async () => {
    const text = shareText(p, active?.society.name ?? 'our society');
    if (navigator.share) { try { await navigator.share({ title: 'Gatekeeper guest pass', text }); return; } catch { /* cancelled */ return; } }
    await navigator.clipboard?.writeText(text);
    toast('Invite copied. Paste it into any messaging app.', 'info');
  };
  return (
    <div className="flex flex-wrap gap-3">
      <Button icon={Share2} onClick={share}>Share invite</Button>
      <Button variant="outline" icon={Copy} onClick={async () => { await navigator.clipboard?.writeText(p.passcode ?? ''); toast('Passcode copied.', 'info'); }}>Copy passcode</Button>
      {onCancel && <Button variant="ghost" className="!text-critical-fg" onClick={onCancel}>Cancel invite</Button>}
    </div>
  );
}

export function InviteModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const init = () => ({ guestName: '', guestPhone: '', type: 'GUEST' as VisitorType, from: toISTInput(new Date()), to: toISTInput(new Date(Date.now() + 4 * 3_600_000)), maxUses: '1' });
  const [f, setF] = useState(init);
  const [err, setErr] = useState<string | null>(null);
  const [created, setCreated] = useState<PreApproval | null>(null);
  const create = useAct(() => {
    const from = new Date(fromISTInput(f.from));
    return post<PreApproval>('/preapprovals', {
      type: f.type, guestName: f.guestName.trim(), guestPhone: cleanPhone(f.guestPhone) || undefined,
      validFrom: from.getTime() > Date.now() ? from.toISOString() : undefined,
      validTo: fromISTInput(f.to), maxUses: Number(f.maxUses),
    });
  }, { success: 'Invite created.', onSuccess: (p) => setCreated(p) });
  const close = () => { onClose(); setCreated(null); setF(init()); setErr(null); };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!f.guestName.trim()) return setErr('Enter the guest’s name.');
    if (f.guestPhone && !/^\d{10,15}$/.test(cleanPhone(f.guestPhone))) return setErr('Enter a 10-digit phone number or leave it empty.');
    if (fromISTInput(f.to) <= fromISTInput(f.from)) return setErr('The end time must be after the start time.');
    setErr(null);
    create.mutate();
  };
  return (
    <Modal open={open} onClose={close} title={created ? 'Invite ready' : 'Pre-approve a guest'}>
      {created ? (
        <div className="space-y-5"><PassCard p={created} /><ShareActions p={created} /></div>
      ) : (
        <form onSubmit={submit} noValidate className="space-y-5">
          <Field label="Guest name"><Input value={f.guestName} maxLength={80} autoFocus onChange={(e) => setF({ ...f, guestName: e.target.value })} /></Field>
          <Field label="Phone" optional><Input type="tel" inputMode="numeric" value={f.guestPhone} onChange={(e) => setF({ ...f, guestPhone: e.target.value })} /></Field>
          <fieldset>
            <legend className="mb-1.5 text-label">Visitor type</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(Object.keys(VISITOR_TYPE) as VisitorType[]).map((t) => {
                const T = VISITOR_TYPE[t];
                return (
                  <label key={t} className={cx('flex h-11 cursor-pointer items-center justify-center gap-2 rounded-control border text-label has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-focus', f.type === t ? 'border-brand bg-status-success-bg text-status-success-fg' : 'border-line-strong')}>
                    <input type="radio" name="vtype" className="sr-only" checked={f.type === t} onChange={() => setF({ ...f, type: t })} />
                    <T.icon size={16} aria-hidden />{T.label}
                  </label>
                );
              })}
            </div>
          </fieldset>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Arriving from"><Input type="datetime-local" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></Field>
            <Field label="Valid until"><Input type="datetime-local" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></Field>
          </div>
          <Field label="Number of entries" hint="Up to 10. Each passcode use checks the guest in once.">
            <Input type="number" min={1} max={10} value={f.maxUses} onChange={(e) => setF({ ...f, maxUses: e.target.value })} className="max-w-[120px] tabular-nums" />
          </Field>
          {err && <p role="alert" className="text-body-sm text-critical-fg">{err}</p>}
          <Button type="submit" full size="lg" icon={Ticket} loading={create.isPending}>Create invite</Button>
        </form>
      )}
    </Modal>
  );
}

function InviteItem({ p }: { p: PreApproval }) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const cancel = useAct(() => del(`/preapprovals/${p.id}`), { success: 'Invite cancelled. The passcode no longer works.', onSuccess: () => setConfirm(false) });
  return (
    <li className="py-3">
      <div className="flex items-center gap-3">
        <Avatar name={p.guestName} size={40} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-h4 text-fg-heading">{p.guestName}</p>
          <p className="text-body-sm tabular-nums text-fg-muted">
            {p.status === 'ACTIVE' && p.passcode ? `${formatPasscode(p.passcode)} · ` : ''}until {formatDateTime(p.validTo)} · {p.usedCount}/{p.maxUses} used
          </p>
        </div>
        <StatusChip spec={STATUS.preApproval[p.status]} />
      </div>
      {p.status === 'ACTIVE' && (
        <div className="mt-3 pl-[52px]">
          <Button variant="link" size="sm" onClick={() => setOpen((o) => !o)} aria-expanded={open}>{open ? 'Hide pass' : 'Show pass'}</Button>
          {open && <div className="mt-3 space-y-4"><PassCard p={p} /><ShareActions p={p} onCancel={() => setConfirm(true)} /></div>}
        </div>
      )}
      <ConfirmModal open={confirm} onClose={() => setConfirm(false)} title={`Cancel the invite for ${p.guestName}?`}
        body="The passcode will stop working at the gate straight away." confirmLabel="Cancel invite" loading={cancel.isPending} onConfirm={() => cancel.mutate()} />
    </li>
  );
}

/* ── Page ──────────────────────────────────────────────────────────── */
type Tab = 'pending' | 'today' | 'invites' | 'history';
export default function Visitors() {
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<Tab>((params.get('tab') as Tab) || 'pending');
  const inviteOpen = params.get('invite') === '1';
  const pending = useGet<List<Visitor>>('/visitors', { status: 'PENDING_APPROVAL' });
  const today = useGet<List<Visitor>>(tab === 'today' ? '/visitors' : null, { date: todayIST() });
  const history = useGet<List<Visitor>>(tab === 'history' ? '/visitors' : null, { limit: 100 });
  const invites = useGet<List<PreApproval>>(tab === 'invites' ? '/preapprovals' : null, { limit: 100 });
  const live = (pending.data?.items ?? []).filter((v) => v.expiresAt && new Date(v.expiresAt).getTime() > Date.now());

  const list = (q: typeof today, empty: React.ReactNode) => (
    <Card><Async q={q} empty={empty}>{(d) => <ul className="-my-3 divide-y divide-line">{d.items.map((v) => <VisitorRow key={v.id} v={v} />)}</ul>}</Async></Card>
  );

  return (
    <>
      <PageHeader title="Visitors" description="Approve arrivals, invite guests and review who came to your flat."
        actions={<Button icon={Ticket} onClick={() => setParams({ invite: '1' })}>Pre-approve guest</Button>} />
      <Tabs value={tab} onChange={setTab} tabs={[
        { id: 'pending', label: 'Pending', count: live.length },
        { id: 'today', label: 'Today' }, { id: 'invites', label: 'Invites' }, { id: 'history', label: 'History' },
      ]} />
      {tab === 'pending' && (
        <div className="space-y-4">
          <Parcels />
          <Async q={pending} isEmpty={() => !live.length} empty={
            <Card><EmptyState icon={UserRoundCheck} title="Nobody is waiting at the gate." body="When a guard logs a visitor for your flat, you can approve or deny them here." positive /></Card>
          }>
            {() => <div className="space-y-4">{live.map((v) => <ApprovalCard key={v.id} v={v} />)}</div>}
          </Async>
        </div>
      )}
      {tab === 'today' && list(today, <EmptyState icon={UserRoundCheck} title="No visitors yet today." body="Expecting someone? Pre-approve them for a faster entry." action={<Button variant="outline" onClick={() => setParams({ invite: '1' })}>Pre-approve guest</Button>} />)}
      {tab === 'history' && list(history, <EmptyState icon={History} title="No visitor history yet." body="Every entry to your flat will be recorded here." />)}
      {tab === 'invites' && (
        <Card>
          <Async q={invites} empty={<EmptyState icon={Ticket} title="No invites yet." body="Pre-approve a guest and share a 6-digit passcode for a faster entry." action={<Button variant="outline" onClick={() => setParams({ invite: '1' })}>Pre-approve guest</Button>} />}>
            {(d) => <ul className="-my-3 divide-y divide-line">{d.items.map((p) => <InviteItem key={p.id} p={p} />)}</ul>}
          </Async>
        </Card>
      )}
      <InviteModal open={inviteOpen} onClose={() => { setParams({}); setTab('invites'); }} />
    </>
  );
}
