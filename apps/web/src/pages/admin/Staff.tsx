import { useState, type FormEvent } from 'react';
import { Eye, EyeOff, HandHelping, Link2, UserRoundPlus } from 'lucide-react';
import { patch, post, useAct, useGet } from '../../lib/api';
import { cleanPhone, formatPasscode, formatPhone } from '../../lib/format';
import { STAFF_CAT, STATUS } from '../../lib/status';
import type { Flat, List, Staff, StaffCategory } from '../../lib/types';
import {
  Async, Badge, Button, Card, EmptyState, Field, IconButton, Input, Modal, PageHeader, Select, StatusChip, Table, Who,
  options, td, tr,
} from '../../components/ui';
import { AttendanceModal } from '../resident/Services';

function AddStaffModal({ open, onClose, flats }: { open: boolean; onClose: () => void; flats: Flat[] }) {
  const init = { name: '', phone: '', category: 'MAID' as StaffCategory, flatIds: [] as string[] };
  const [f, setF] = useState(init);
  const [err, setErr] = useState<string | null>(null);
  const [created, setCreated] = useState<Staff | null>(null);
  const add = useAct(() => post<Staff>('/staff', { name: f.name.trim(), phone: cleanPhone(f.phone) || undefined, category: f.category, flatIds: f.flatIds }), {
    success: (s) => `${s.name} registered.`, onSuccess: (s) => setCreated(s),
  });
  const close = () => { onClose(); setF(init); setCreated(null); setErr(null); };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!f.name.trim()) return setErr('Enter their name.');
    if (f.phone && !/^\d{10,15}$/.test(cleanPhone(f.phone))) return setErr('Enter a 10-digit phone number or leave it empty.');
    setErr(null); add.mutate();
  };
  return (
    <Modal open={open} onClose={close} title={created ? 'Staff registered' : 'Add daily help'} size="md">
      {created ? (
        <div className="space-y-4 text-center">
          <p className="text-body text-fg-muted">Share this passcode with {created.name}. They enter it at the gate to check in and out.</p>
          <p className="text-[40px] font-semibold tabular-nums tracking-[0.12em] text-fg-heading">{formatPasscode(created.passcode ?? '')}</p>
          <Button onClick={close}>Done</Button>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name"><Input value={f.name} maxLength={80} onChange={(e) => setF({ ...f, name: e.target.value })} autoFocus /></Field>
            <Field label="Category"><Select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value as StaffCategory })}>{options(STAFF_CAT)}</Select></Field>
          </div>
          <Field label="Phone" optional><Input type="tel" inputMode="numeric" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
          <fieldset>
            <legend className="mb-1.5 text-label">Works at</legend>
            <div className="grid max-h-48 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-5">
              {flats.map((x) => (
                <label key={x.id} className="flex h-11 cursor-pointer items-center gap-2 rounded-control border border-line-strong px-3 text-body-sm tabular-nums has-[:checked]:border-brand has-[:checked]:bg-status-success-bg">
                  <input type="checkbox" className="h-4 w-4 accent-[rgb(var(--gk-brand))]" checked={f.flatIds.includes(x.id)}
                    onChange={(e) => setF({ ...f, flatIds: e.target.checked ? [...f.flatIds, x.id] : f.flatIds.filter((i) => i !== x.id) })} />
                  {x.label}
                </label>
              ))}
            </div>
          </fieldset>
          {err && <p role="alert" className="text-body-sm text-critical-fg">{err}</p>}
          <Button type="submit" full loading={add.isPending} icon={UserRoundPlus}>Register staff</Button>
        </form>
      )}
    </Modal>
  );
}

function LinkFlatModal({ staff, flats, onClose }: { staff: Staff | null; flats: Flat[]; onClose: () => void }) {
  const [flatId, setFlatId] = useState('');
  const link = useAct(() => post<Staff>(`/staff/${staff!.id}/flats`, { flatId }), { success: (s) => `${s.name} linked.`, onSuccess: () => { setFlatId(''); onClose(); } });
  const avail = flats.filter((f) => !staff?.flats.some((x) => x.id === f.id));
  return (
    <Modal open={!!staff} onClose={onClose} title={`Link ${staff?.name ?? ''} to a flat`} footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={!flatId} loading={link.isPending} onClick={() => link.mutate()}>Link flat</Button></>}>
      <Field label="Flat"><Select value={flatId} onChange={(e) => setFlatId(e.target.value)}><option value="">Choose a flat</option>{avail.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}</Select></Field>
    </Modal>
  );
}

function StaffRow({ s, onLink, onAttendance }: { s: Staff; onLink: () => void; onAttendance: () => void }) {
  const [reveal, setReveal] = useState(false);
  const toggle = useAct(() => patch<Staff>(`/staff/${s.id}`, { isActive: !s.isActive }), { success: (r) => `${r.name} ${r.isActive ? 'reactivated' : 'deactivated. Their passcode no longer works'}.` });
  return (
    <tr className={tr}>
      <td className={td}><Who name={s.name} seed={s.id} icon={undefined} sub={[STAFF_CAT[s.category].label, s.phone && formatPhone(s.phone)].filter(Boolean).join(' · ')} /></td>
      <td className={td}><div className="flex max-w-[220px] flex-wrap gap-1">{s.flats.length ? s.flats.map((f) => <Badge key={f.id} variant="outline">{f.label}</Badge>) : <span className="text-fg-subtle">None</span>}</div></td>
      <td className={td}><StatusChip spec={s.isInside ? STATUS.staff.INSIDE : STATUS.staff.OUT} /></td>
      <td className={td}><StatusChip spec={s.isActive ? STATUS.staff.ACTIVE : STATUS.staff.INACTIVE} /></td>
      <td className={`${td} whitespace-nowrap tabular-nums`}>
        {s.passcode && (
          <span className="inline-flex items-center gap-1">
            {reveal ? formatPasscode(s.passcode) : `••• •${s.passcode.slice(-2)}`}
            <IconButton label={reveal ? 'Hide passcode' : 'Show passcode'} icon={reveal ? EyeOff : Eye} onClick={() => setReveal(!reveal)} />
          </span>
        )}
      </td>
      <td className={`${td} whitespace-nowrap text-right`}>
        <Button size="sm" variant="ghost" onClick={onAttendance}>Attendance</Button>
        <Button size="sm" variant="ghost" icon={Link2} onClick={onLink}>Link flat</Button>
        <Button size="sm" variant="ghost" loading={toggle.isPending} onClick={() => toggle.mutate()}>{s.isActive ? 'Deactivate' : 'Reactivate'}</Button>
      </td>
    </tr>
  );
}

export default function AdminStaff() {
  const [category, setCategory] = useState('');
  const q = useGet<List<Staff>>('/staff', { category: category || undefined });
  const flats = useGet<List<Flat>>('/flats');
  const [adding, setAdding] = useState(false);
  const [linking, setLinking] = useState<Staff | null>(null);
  const [att, setAtt] = useState<Staff | null>(null);
  return (
    <>
      <PageHeader title="Staff" description="Daily help registered with the society. Each has a passcode for the gate."
        actions={<Button icon={UserRoundPlus} onClick={() => setAdding(true)}>Add staff</Button>} />
      <div className="mb-4 max-w-xs"><Select aria-label="Category" value={category} onChange={(e) => setCategory(e.target.value)}><option value="">All categories</option>{options(STAFF_CAT)}</Select></div>
      <Async q={q} empty={<Card><EmptyState icon={HandHelping} title="No daily help registered yet." body="Register maids, cooks and drivers so the gate recognises them." action={<Button onClick={() => setAdding(true)}>Add staff</Button>} /></Card>}>
        {(d) => (
          <Table caption="Staff directory" head={['Name', 'Flats', 'Today', 'Status', 'Passcode', '']} right={[5]}>
            {d.items.map((s) => <StaffRow key={s.id} s={s} onLink={() => setLinking(s)} onAttendance={() => setAtt(s)} />)}
          </Table>
        )}
      </Async>
      <AddStaffModal open={adding} onClose={() => setAdding(false)} flats={flats.data?.items ?? []} />
      <LinkFlatModal staff={linking} flats={flats.data?.items ?? []} onClose={() => setLinking(null)} />
      <AttendanceModal staff={att} onClose={() => setAtt(null)} />
    </>
  );
}
