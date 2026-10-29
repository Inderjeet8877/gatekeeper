import { useState, type FormEvent } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { CalendarCheck, CalendarDays, ChevronRight, HandHelping, LifeBuoy, Plus, UserRoundPlus } from 'lucide-react';
import { del, post, useAct, useGet } from '../../lib/api';
import { formatDate, formatDateTime, formatINR, formatRelative, formatTime, todayIST } from '../../lib/format';
import { STAFF_CAT, STATUS, TICKET_CAT } from '../../lib/status';
import type {
  Amenity, AvailabilitySlot, Booking, List, Staff, StaffAttendance, Ticket, TicketCategory, TicketPriority,
} from '../../lib/types';
import { useAuth } from '../../auth/AuthContext';
import {
  Async, Button, Card, ConfirmModal, cx, EmptyState, Field, Input, Modal, PageHeader, StatusChip, Tabs,
  Textarea, Who,
} from '../../components/ui';
import { TicketDetail } from '../admin/Helpdesk';

/* ── Helpdesk ──────────────────────────────────────────────────────── */
function NewTicketModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [f, setF] = useState({ category: '' as TicketCategory | '', title: '', description: '', priority: 'MEDIUM' as TicketPriority });
  const [err, setErr] = useState<string | null>(null);
  const create = useAct(() => post('/tickets', f), { success: 'Request raised. The committee has been notified.', onSuccess: () => { onClose(); setF({ category: '', title: '', description: '', priority: 'MEDIUM' }); } });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!f.category) return setErr('Choose what the request is about.');
    if (!f.title.trim() || !f.description.trim()) return setErr('Add a short title and a description.');
    setErr(null); create.mutate();
  };
  return (
    <Modal open={open} onClose={onClose} title="Raise a request" size="md">
      <form onSubmit={submit} noValidate className="space-y-5">
        <fieldset>
          <legend className="mb-1.5 text-label">Category</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(Object.keys(TICKET_CAT) as TicketCategory[]).map((c) => {
              const C = TICKET_CAT[c];
              return (
                <label key={c} className={cx('flex h-[72px] cursor-pointer flex-col items-center justify-center gap-1 rounded-card border text-label has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-focus', f.category === c ? 'border-brand bg-status-success-bg text-status-success-fg' : 'border-line-strong hover:bg-surface-sunken')}>
                  <input type="radio" name="tcat" className="sr-only" checked={f.category === c} onChange={() => setF({ ...f, category: c })} />
                  <C.icon size={22} aria-hidden />{C.label}
                </label>
              );
            })}
          </div>
        </fieldset>
        <Field label="Title"><Input value={f.title} maxLength={120} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Kitchen sink leaking" /></Field>
        <Field label="Description"><Textarea value={f.description} maxLength={2000} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        <fieldset>
          <legend className="mb-1.5 text-label">Priority</legend>
          <div className="inline-flex rounded-control bg-surface-sunken p-1">
            {(['LOW', 'MEDIUM', 'HIGH'] as TicketPriority[]).map((p) => (
              <label key={p} className={cx('flex h-9 cursor-pointer items-center rounded-[8px] px-4 text-label has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-focus', f.priority === p ? 'bg-surface text-fg-heading shadow-xs' : 'text-fg-muted')}>
                <input type="radio" name="tprio" className="sr-only" checked={f.priority === p} onChange={() => setF({ ...f, priority: p })} />
                {STATUS.priority[p].label}
              </label>
            ))}
          </div>
        </fieldset>
        {err && <p role="alert" className="text-body-sm text-critical-fg">{err}</p>}
        <Button type="submit" full size="lg" loading={create.isPending}>Raise request</Button>
      </form>
    </Modal>
  );
}

function HelpdeskTab() {
  const [params, setParams] = useSearchParams();
  const q = useGet<List<Ticket>>('/tickets', { limit: 100 });
  const open = () => setParams({ tab: 'helpdesk', new: '1' });
  return (
    <>
      <div className="mb-4 flex justify-end"><Button icon={Plus} onClick={open}>Raise request</Button></div>
      <Card>
        <Async q={q} empty={<EmptyState icon={LifeBuoy} title="No open requests." body="If something in the society needs attention, raise a request." action={<Button variant="outline" onClick={open}>Raise request</Button>} />}>
          {(d) => (
            <ul className="-my-3 divide-y divide-line">
              {d.items.map((t) => {
                const C = TICKET_CAT[t.category];
                return (
                  <li key={t.id}>
                    <Link to={`/app/home/services/tickets/${t.id}`} className="flex items-center gap-3 py-3">
                      <C.icon size={20} className="shrink-0 text-fg-subtle" aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-h4 text-fg-heading">{t.title}</span>
                        <span className="text-caption text-fg-subtle">{C.label} · {STATUS.priority[t.priority].label} priority · {formatRelative(t.createdAt)}</span>
                      </span>
                      <StatusChip spec={STATUS.ticket[t.status]} />
                      <ChevronRight size={18} className="text-fg-subtle" aria-hidden />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Async>
      </Card>
      <NewTicketModal open={params.get('new') === '1'} onClose={() => setParams({ tab: 'helpdesk' })} />
    </>
  );
}

export function ResidentTicket() {
  return <TicketDetail id={useParams().id!} role="RESIDENT" back="/app/home/services?tab=helpdesk" />;
}

/* ── Amenities ─────────────────────────────────────────────────────── */
const dayLabel = (d: string) => new Intl.DateTimeFormat('en-IN', { weekday: 'short', timeZone: 'Asia/Kolkata' }).format(new Date(`${d}T12:00:00+05:30`));

function SlotPicker({ a, mine }: { a: Amenity; mine: Booking[] }) {
  const [date, setDate] = useState(todayIST());
  const [sel, setSel] = useState<AvailabilitySlot | null>(null);
  const q = useGet<List<AvailabilitySlot>>(`/amenities/${a.id}/availability`, { date });
  const book = useAct(() => post<Booking>('/bookings', { amenityId: a.id, startAt: sel!.startAt }), {
    success: (b) => `Booked ${b.amenity.name} for ${formatDateTime(b.startAt)}.`, onSuccess: () => setSel(null),
  });
  const days = Array.from({ length: 14 }, (_, i) => todayIST(i));
  const now = Date.now();
  return (
    <div>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2" role="radiogroup" aria-label="Date">
        {days.map((d, i) => (
          <button key={d} type="button" role="radio" aria-checked={d === date} onClick={() => { setDate(d); setSel(null); }}
            className={cx('flex h-16 w-14 shrink-0 flex-col items-center justify-center rounded-control border text-caption', d === date ? 'border-navy-900 bg-navy-900 text-white dark:border-navy-200 dark:bg-navy-200 dark:text-navy-950' : 'border-line-strong text-fg-muted hover:bg-surface-sunken')}>
            {i === 0 ? 'Today' : dayLabel(d)}<span className="text-h4 tabular-nums">{Number(d.slice(8))}</span>
          </button>
        ))}
      </div>
      <div className="mt-4">
        <Async q={q} isEmpty={(d) => !d.items.some((s) => new Date(s.startAt).getTime() > now)}
          empty={<p className="py-6 text-center text-body-sm text-fg-muted">No more slots on this day. Pick another date.</p>}>
          {(d) => (
            <div role="radiogroup" aria-label="Time slot" className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {d.items.filter((s) => new Date(s.startAt).getTime() > now).map((s) => {
                const yours = mine.some((b) => b.amenity.id === a.id && b.status === 'CONFIRMED' && b.startAt === s.startAt);
                const full = s.available <= 0;
                const picked = sel?.startAt === s.startAt;
                return (
                  <button key={s.startAt} type="button" role="radio" aria-checked={picked} disabled={full || yours}
                    aria-label={`${formatTime(s.startAt)} to ${formatTime(s.endAt)}, ${yours ? 'your booking' : full ? 'full' : `${s.available} of ${s.capacity} places left`}`}
                    onClick={() => setSel(s)}
                    className={cx('flex min-h-[52px] flex-col items-center justify-center rounded-control border px-2 py-1.5 text-body-sm font-semibold tabular-nums transition-colors',
                      yours ? 'border-transparent bg-status-success-bg text-status-success-fg'
                        : picked ? 'border-brand bg-brand text-white'
                          : full ? 'cursor-not-allowed border-transparent bg-surface-sunken text-fg-subtle'
                            : 'border-line-strong text-fg hover:bg-surface-sunken')}>
                    {formatTime(s.startAt)}
                    <span className={cx('text-caption font-medium', !picked && !yours && !full && s.available <= Math.max(1, s.capacity / 4) && 'text-status-warning-fg')}>
                      {yours ? 'Your booking' : full ? 'Full' : s.capacity > 1 ? `${s.available} of ${s.capacity} left` : 'Available'}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </Async>
      </div>
      {sel && (
        <div className="sticky bottom-20 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-card bg-surface-raised p-4 shadow-overlay lg:bottom-4 dark:border dark:border-line">
          <p className="text-body-sm tabular-nums"><span className="font-semibold">{formatDate(sel.startAt)}, {formatTime(sel.startAt)}–{formatTime(sel.endAt)}</span> · {a.pricePerSlot ? formatINR(a.pricePerSlot) : 'Free'}</p>
          <Button icon={CalendarCheck} loading={book.isPending} onClick={() => book.mutate()}>Book slot</Button>
        </div>
      )}
      {a.pricePerSlot > 0 && <p className="mt-3 text-caption text-fg-subtle">The {formatINR(a.pricePerSlot)} slot charge is collected by the society office; online payment for bookings is coming later.</p>}
    </div>
  );
}

function AmenitiesTab() {
  const amenities = useGet<List<Amenity>>('/amenities');
  const bookings = useGet<List<Booking>>('/bookings', { limit: 50 });
  const [open, setOpen] = useState<string | null>(null);
  const [cancel, setCancel] = useState<Booking | null>(null);
  const doCancel = useAct(() => del(`/bookings/${cancel!.id}`), { success: 'Booking cancelled.', onSuccess: () => setCancel(null) });
  const mine = bookings.data?.items ?? [];
  const upcoming = mine.filter((b) => b.status === 'CONFIRMED' && new Date(b.startAt).getTime() > Date.now());
  return (
    <div className="space-y-6">
      <Async q={amenities} empty={<Card><EmptyState icon={CalendarDays} title="No amenities to book yet." body="The committee hasn't added any bookable amenities." /></Card>}>
        {(d) => (
          <div className="space-y-4">
            {d.items.map((a) => (
              <Card key={a.id} title={a.name} description={a.description ?? undefined}
                actions={<Button variant={open === a.id ? 'ghost' : 'outline'} onClick={() => setOpen(open === a.id ? null : a.id)} aria-expanded={open === a.id}>{open === a.id ? 'Close' : 'Book'}</Button>}>
                <p className="text-body-sm tabular-nums text-fg-muted">
                  {formatTime(`2000-01-01T${a.openTime}:00+05:30`)} – {formatTime(`2000-01-01T${a.closeTime}:00+05:30`)} · {a.slotMinutes} min slots · {a.capacity === 1 ? 'One flat per slot' : `Up to ${a.capacity} flats per slot`} · {a.pricePerSlot ? `${formatINR(a.pricePerSlot)} / slot` : 'Free'}
                </p>
                {open === a.id && <div className="mt-5 border-t border-line pt-5"><SlotPicker a={a} mine={mine} /></div>}
              </Card>
            ))}
          </div>
        )}
      </Async>
      <Card title="My bookings">
        <Async q={bookings} isEmpty={() => !upcoming.length} empty={<EmptyState icon={CalendarCheck} title="No upcoming bookings." body="Book the clubhouse, courts or pool above." />}>
          {() => (
            <ul className="-my-3 divide-y divide-line">
              {upcoming.map((b) => (
                <li key={b.id} className="flex flex-wrap items-center gap-3 py-3">
                  <CalendarCheck size={20} className="text-status-success-dot" aria-hidden />
                  <span className="min-w-0 flex-1"><span className="block font-semibold">{b.amenity.name}</span><span className="text-body-sm tabular-nums text-fg-muted">{formatDateTime(b.startAt)} – {formatTime(b.endAt)}</span></span>
                  <Button size="sm" variant="ghost" onClick={() => setCancel(b)}>Cancel</Button>
                </li>
              ))}
            </ul>
          )}
        </Async>
      </Card>
      <ConfirmModal open={!!cancel} onClose={() => setCancel(null)} title={`Cancel ${cancel?.amenity.name} booking?`}
        body={cancel ? `Your slot on ${formatDateTime(cancel.startAt)} will be released for others.` : ''} confirmLabel="Cancel booking" loading={doCancel.isPending} onConfirm={() => doCancel.mutate()} />
    </div>
  );
}

/* ── Daily help ────────────────────────────────────────────────────── */
export function AttendanceModal({ staff, onClose }: { staff: Staff | null; onClose: () => void }) {
  const q = useGet<List<StaffAttendance>>(staff ? `/staff/${staff.id}/attendance` : null, { limit: 30 });
  return (
    <Modal open={!!staff} onClose={onClose} title={staff ? `${staff.name} · attendance` : ''}>
      <Async q={q} empty={<EmptyState icon={CalendarDays} title="No visits recorded yet." body="Entries appear when the guard verifies their passcode at the gate." />}>
        {(d) => (
          <ul className="-my-2 divide-y divide-line">
            {d.items.map((r) => {
              const mins = r.checkOutAt ? Math.round((new Date(r.checkOutAt).getTime() - new Date(r.checkInAt).getTime()) / 60000) : null;
              return (
                <li key={r.id} className="flex items-center justify-between gap-3 py-3 text-body-sm tabular-nums">
                  <span><span className="font-semibold">{formatDate(r.checkInAt)}</span> · In {formatTime(r.checkInAt)}{r.checkOutAt ? ` · Out ${formatTime(r.checkOutAt)}` : ''}</span>
                  {mins !== null ? <span className="text-fg-subtle">{mins >= 60 ? `${Math.floor(mins / 60)} h ${mins % 60} min` : `${mins} min`}</span> : <StatusChip spec={STATUS.staff.INSIDE} />}
                </li>
              );
            })}
          </ul>
        )}
      </Async>
    </Modal>
  );
}

function DailyHelpTab() {
  const { active } = useAuth();
  const flatId = active?.flat?.id;
  const label = active?.flat ? `${active.flat.block.name}-${active.flat.number}` : 'your flat';
  const mine = useGet<List<Staff>>(flatId ? '/staff' : null, { flatId });
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState('');
  const all = useGet<List<Staff>>(adding ? '/staff' : null);
  const [att, setAtt] = useState<Staff | null>(null);
  const link = useAct((id: string) => post(`/staff/${id}/flats`, { flatId }), { success: `Added to ${label}.` });
  const linked = new Set(mine.data?.items.map((s) => s.id));
  const candidates = (all.data?.items ?? []).filter((s) => !linked.has(s.id) && s.name.toLowerCase().includes(search.toLowerCase()));
  return (
    <>
      <div className="mb-4 flex justify-end"><Button icon={UserRoundPlus} onClick={() => setAdding(true)}>Add daily help</Button></div>
      <Card>
        <Async q={mine} empty={<EmptyState icon={HandHelping} title={`No daily help linked to ${label}.`} body="Link your maid, cook or driver to see when they come and go." action={<Button variant="outline" onClick={() => setAdding(true)}>Add daily help</Button>} />}>
          {(d) => (
            <ul className="-my-3 divide-y divide-line">
              {d.items.map((s) => (
                <li key={s.id}>
                  <button type="button" onClick={() => setAtt(s)} className="flex w-full items-center gap-3 py-3 text-left">
                    <span className="min-w-0 flex-1"><Who name={s.name} seed={s.id} sub={`${STAFF_CAT[s.category].label} · ${s.flats.map((f) => f.label).join(', ')}`} /></span>
                    <StatusChip spec={s.isInside ? STATUS.staff.INSIDE : STATUS.staff.OUT} />
                    <ChevronRight size={18} className="text-fg-subtle" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Async>
      </Card>
      <AttendanceModal staff={att} onClose={() => setAtt(null)} />
      <Modal open={adding} onClose={() => setAdding(false)} title={`Add daily help to ${label}`}>
        <Field label="Search by name"><Input type="search" value={search} onChange={(e) => setSearch(e.target.value)} autoFocus /></Field>
        <div className="mt-4">
          <Async q={all} isEmpty={() => !candidates.length} empty={<p className="py-6 text-center text-body-sm text-fg-muted">{search ? `No results for “${search}”.` : 'Everyone registered is already linked.'} Ask the committee to register new staff.</p>}>
            {() => (
              <ul className="-my-2 divide-y divide-line">
                {candidates.map((s) => (
                  <li key={s.id} className="flex items-center gap-3 py-3">
                    <span className="min-w-0 flex-1"><Who name={s.name} seed={s.id} sub={STAFF_CAT[s.category].label} /></span>
                    <Button size="sm" variant="outline" loading={link.isPending && link.variables === s.id} onClick={() => link.mutate(s.id)}>Add to {label}</Button>
                  </li>
                ))}
              </ul>
            )}
          </Async>
        </div>
      </Modal>
    </>
  );
}

type Tab = 'helpdesk' | 'amenities' | 'help';
export default function Services() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) || 'helpdesk';
  return (
    <>
      <PageHeader title="Services" description="Raise requests, book amenities and keep track of your daily help." />
      <Tabs value={tab} onChange={(t) => setParams({ tab: t })} tabs={[
        { id: 'helpdesk', label: 'Helpdesk' }, { id: 'amenities', label: 'Amenities' }, { id: 'help', label: 'Daily help' },
      ]} />
      {tab === 'helpdesk' && <HelpdeskTab />}
      {tab === 'amenities' && <AmenitiesTab />}
      {tab === 'help' && <DailyHelpTab />}
    </>
  );
}
