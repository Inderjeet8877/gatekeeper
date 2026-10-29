import { useState, type FormEvent } from 'react';
import { CalendarDays, CalendarX, Pencil, Plus } from 'lucide-react';
import { del, patch, post, useAct, useGet } from '../../lib/api';
import { formatDateTime, formatINR, formatTime, rupeesToPaise, todayIST } from '../../lib/format';
import { STATUS } from '../../lib/status';
import type { Amenity, Booking, List } from '../../lib/types';
import {
  Async, Badge, Button, Card, ConfirmModal, EmptyState, Field, Input, Modal, PageHeader, Select, StatusChip, Table, Tabs,
  Textarea, td, tr,
} from '../../components/ui';

const hm = (t: string) => formatTime(`2000-01-01T${t}:00+05:30`);

function AmenityModal({ amenity, onClose }: { amenity: Amenity | 'new'; onClose: () => void }) {
  const a = amenity === 'new' ? null : amenity;
  const [f, setF] = useState({
    name: a?.name ?? '', description: a?.description ?? '', openTime: a?.openTime ?? '06:00', closeTime: a?.closeTime ?? '22:00',
    slotMinutes: String(a?.slotMinutes ?? 60), capacity: String(a?.capacity ?? 1), price: a ? String(a.pricePerSlot / 100) : '0', isActive: a?.isActive ?? true,
  });
  const [err, setErr] = useState<string | null>(null);
  const body = () => ({
    name: f.name.trim(), description: f.description.trim() || (a ? null : undefined), openTime: f.openTime, closeTime: f.closeTime,
    slotMinutes: Number(f.slotMinutes), capacity: Number(f.capacity), pricePerSlot: rupeesToPaise(f.price), isActive: f.isActive,
  });
  const save = useAct(() => (a ? patch<Amenity>(`/amenities/${a.id}`, body()) : post<Amenity>('/amenities', body())), {
    success: (r) => `${r.name} ${a ? 'updated' : 'added'}.`, onSuccess: onClose,
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
    if (!f.name.trim()) return setErr('Enter a name.');
    if (mins(f.closeTime) <= mins(f.openTime)) return setErr('Closing time must be after opening time.');
    if (Number(f.slotMinutes) < 15 || Number(f.slotMinutes) > 480) return setErr('Slots must be between 15 and 480 minutes.');
    if (mins(f.closeTime) - mins(f.openTime) < Number(f.slotMinutes)) return setErr('Opening hours must fit at least one slot.');
    if (!(Number(f.capacity) >= 1 && Number(f.capacity) <= 500)) return setErr('Capacity must be between 1 and 500.');
    if (rupeesToPaise(f.price) === null) return setErr('Enter a price in rupees, e.g. 500 or 250.50.');
    setErr(null); save.mutate();
  };
  return (
    <Modal open onClose={onClose} title={a ? `Edit ${a.name}` : 'Add an amenity'} size="md">
      <form onSubmit={submit} noValidate className="grid gap-5 sm:grid-cols-2">
        <Field label="Name" className="sm:col-span-2"><Input value={f.name} maxLength={80} onChange={(e) => setF({ ...f, name: e.target.value })} autoFocus /></Field>
        <Field label="Description" optional className="sm:col-span-2"><Textarea value={f.description} maxLength={500} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        <Field label="Opens at"><Input type="time" value={f.openTime} onChange={(e) => setF({ ...f, openTime: e.target.value })} /></Field>
        <Field label="Closes at"><Input type="time" value={f.closeTime} onChange={(e) => setF({ ...f, closeTime: e.target.value })} /></Field>
        <Field label="Slot length (minutes)"><Input type="number" min={15} max={480} step={15} value={f.slotMinutes} onChange={(e) => setF({ ...f, slotMinutes: e.target.value })} /></Field>
        <Field label="Flats per slot"><Input type="number" min={1} max={500} value={f.capacity} onChange={(e) => setF({ ...f, capacity: e.target.value })} /></Field>
        <Field label="Price per slot (₹)" hint="0 for free"><Input inputMode="decimal" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} /></Field>
        <Field label="Availability"><Select value={f.isActive ? '1' : '0'} onChange={(e) => setF({ ...f, isActive: e.target.value === '1' })}><option value="1">Open for booking</option><option value="0">Closed for booking</option></Select></Field>
        {err && <p role="alert" className="text-body-sm text-critical-fg sm:col-span-2">{err}</p>}
        <Button type="submit" className="sm:col-span-2" loading={save.isPending}>{a ? 'Save changes' : 'Add amenity'}</Button>
      </form>
    </Modal>
  );
}

function Bookings({ amenities }: { amenities: Amenity[] }) {
  const [amenityId, setAmenityId] = useState('');
  const [date, setDate] = useState(todayIST());
  const [cancel, setCancel] = useState<Booking | null>(null);
  const q = useGet<List<Booking>>('/bookings', { amenityId: amenityId || undefined, date: date || undefined, limit: 200 });
  const doCancel = useAct(() => del(`/bookings/${cancel!.id}`), { success: 'Booking cancelled.', onSuccess: () => setCancel(null) });
  return (
    <>
      <div className="mb-4 grid max-w-xl gap-3 sm:grid-cols-2">
        <Field label="Amenity"><Select value={amenityId} onChange={(e) => setAmenityId(e.target.value)}><option value="">All amenities</option>{amenities.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select></Field>
        <Field label="Date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      </div>
      <Async q={q} empty={<Card><EmptyState icon={CalendarDays} title="No bookings for this day." body="Pick another date or amenity." /></Card>}>
        {(d) => (
          <Table caption="Bookings" head={['Amenity', 'Flat', 'Slot', 'Booked by', 'Status', '']} right={[5]}>
            {d.items.map((b) => (
              <tr key={b.id} className={tr}>
                <td className={`${td} font-semibold`}>{b.amenity.name}</td>
                <td className={td}><Badge variant="outline">{b.flat.label}</Badge></td>
                <td className={`${td} tabular-nums`}>{formatDateTime(b.startAt)} – {formatTime(b.endAt)}</td>
                <td className={td}>{b.bookedBy.name}</td>
                <td className={td}><StatusChip spec={STATUS.booking[b.status]} /></td>
                <td className={`${td} text-right`}>{b.status === 'CONFIRMED' && new Date(b.startAt) > new Date() && <Button size="sm" variant="ghost" icon={CalendarX} onClick={() => setCancel(b)}>Cancel</Button>}</td>
              </tr>
            ))}
          </Table>
        )}
      </Async>
      <ConfirmModal open={!!cancel} onClose={() => setCancel(null)} title={`Cancel ${cancel?.flat.label}'s booking?`} body={cancel ? `${cancel.amenity.name}, ${formatDateTime(cancel.startAt)}. The flat's residents will see it as cancelled.` : ''}
        confirmLabel="Cancel booking" loading={doCancel.isPending} onConfirm={() => doCancel.mutate()} />
    </>
  );
}

export default function Amenities() {
  const [tab, setTab] = useState<'amenities' | 'bookings'>('amenities');
  const [editing, setEditing] = useState<Amenity | 'new' | null>(null);
  const q = useGet<List<Amenity>>('/amenities');
  return (
    <>
      <PageHeader title="Amenities" description="Facilities residents can book by the slot." actions={<Button icon={Plus} onClick={() => setEditing('new')}>Add amenity</Button>} />
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'amenities', label: 'Amenities' }, { id: 'bookings', label: 'Bookings' }]} />
      {tab === 'amenities' ? (
        <Async q={q} empty={<Card><EmptyState icon={CalendarDays} title="No amenities yet." body="Add the clubhouse, pool or courts residents can book." action={<Button onClick={() => setEditing('new')}>Add amenity</Button>} /></Card>}>
          {(d) => (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {d.items.map((a) => (
                <Card key={a.id} title={a.name} description={a.description ?? undefined}
                  actions={<Button size="sm" variant="ghost" icon={Pencil} onClick={() => setEditing(a)} aria-label={`Edit ${a.name}`}>Edit</Button>}>
                  <dl className="grid grid-cols-2 gap-y-2 text-body-sm">
                    <dt className="text-fg-subtle">Hours</dt><dd className="tabular-nums">{hm(a.openTime)} – {hm(a.closeTime)}</dd>
                    <dt className="text-fg-subtle">Slot</dt><dd>{a.slotMinutes} min</dd>
                    <dt className="text-fg-subtle">Capacity</dt><dd>{a.capacity} flat{a.capacity > 1 ? 's' : ''} per slot</dd>
                    <dt className="text-fg-subtle">Price</dt><dd className="tabular-nums">{a.pricePerSlot ? `${formatINR(a.pricePerSlot)} / slot` : 'Free'}</dd>
                  </dl>
                  <div className="mt-4"><StatusChip spec={a.isActive ? STATUS.membership.ACTIVE : { ...STATUS.membership.INACTIVE, label: 'Closed for booking' }} /></div>
                </Card>
              ))}
            </div>
          )}
        </Async>
      ) : <Bookings amenities={q.data?.items ?? []} />}
      {editing && <AmenityModal key={editing === 'new' ? 'new' : editing.id} amenity={editing} onClose={() => setEditing(null)} />}
    </>
  );
}
