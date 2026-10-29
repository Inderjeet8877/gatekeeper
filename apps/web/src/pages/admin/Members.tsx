import { useState, type FormEvent } from 'react';
import { Building, Plus, UserRoundPlus, Users } from 'lucide-react';
import { patch, post, useAct, useGet } from '../../lib/api';
import { cleanPhone, formatPhone, parseNumbers } from '../../lib/format';
import { STATUS } from '../../lib/status';
import type { Block, Flat, List, Member, ResidentType, Role } from '../../lib/types';
import { useAuth } from '../../auth/AuthContext';
import {
  Async, Badge, Button, Card, ConfirmModal, EmptyState, Field, Input, Modal, PageHeader, Select, StatusChip, Table, Tabs,
  Who, td, tr,
} from '../../components/ui';

const ROLE_LABEL: Record<Role, string> = { ADMIN: 'Admin', RESIDENT: 'Resident', GUARD: 'Guard' };
const TYPE_LABEL: Record<ResidentType, string> = { OWNER: 'Owner', TENANT: 'Tenant', FAMILY: 'Family' };
const flatOf = (m: Member) => (m.flat ? `${m.flat.block.name}-${m.flat.number}` : null);

export function BlockModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState('');
  const add = useAct(() => post<Block>('/blocks', { name: name.trim() }), { success: (b) => `Block ${b.name} added.`, onSuccess: () => { setName(''); onClose(); } });
  return (
    <Modal open={open} onClose={onClose} title="Add a block" footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button loading={add.isPending} disabled={!name.trim()} onClick={() => add.mutate()}>Add block</Button></>}>
      <Field label="Block or tower name" hint="For example A, B or Tower 1"><Input value={name} maxLength={20} onChange={(e) => setName(e.target.value)} autoFocus /></Field>
    </Modal>
  );
}

function FlatsModal({ open, onClose, blocks }: { open: boolean; onClose: () => void; blocks: Block[] }) {
  const [blockId, setBlockId] = useState('');
  const [numbers, setNumbers] = useState('');
  const list = parseNumbers(numbers);
  const add = useAct(() => post<{ items: Flat[]; skipped: string[] }>('/flats/bulk', { blockId: blockId || blocks[0]?.id, numbers: list }), {
    success: (r) => `${r.items.length} flat${r.items.length === 1 ? '' : 's'} added${r.skipped.length ? `, ${r.skipped.length} already existed` : ''}.`,
    onSuccess: () => { setNumbers(''); onClose(); },
  });
  return (
    <Modal open={open} onClose={onClose} title="Add flats" footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button loading={add.isPending} disabled={!list.length || !blocks.length} onClick={() => add.mutate()}>Add {list.length || ''} flats</Button></>}>
      <div className="space-y-5">
        <Field label="Block"><Select value={blockId || blocks[0]?.id} onChange={(e) => setBlockId(e.target.value)}>{blocks.map((b) => <option key={b.id} value={b.id}>Block {b.name}</option>)}</Select></Field>
        <Field label="Flat numbers" hint={list.length ? `${list.length} flats: ${list.slice(0, 8).join(', ')}${list.length > 8 ? '…' : ''}` : 'Ranges and lists both work, e.g. 101-104, 201-204'}>
          <Input value={numbers} onChange={(e) => setNumbers(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

function MemberModal({ open, onClose, flats }: { open: boolean; onClose: () => void; flats: Flat[] }) {
  const init = { phone: '', name: '', role: 'RESIDENT' as Role, flatId: '', residentType: 'OWNER' as ResidentType };
  const [f, setF] = useState(init);
  const [err, setErr] = useState<string | null>(null);
  const add = useAct(() => post<Member>('/members', {
    phone: cleanPhone(f.phone), name: f.name.trim(), role: f.role,
    ...(f.role === 'RESIDENT' ? { flatId: f.flatId, residentType: f.residentType } : {}),
  }), { quiet: true, success: (m) => `${m.user.name} added as ${ROLE_LABEL[m.role].toLowerCase()}.`, onSuccess: () => { setF(init); onClose(); } });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!/^\d{10,15}$/.test(cleanPhone(f.phone))) return setErr('Enter a 10-digit mobile number.');
    if (!f.name.trim()) return setErr('Enter their name.');
    if (f.role === 'RESIDENT' && !f.flatId) return setErr('Choose the flat this resident lives in.');
    setErr(null); add.mutate();
  };
  const apiErr = add.error ? (add.error.code === 'CONFLICT' ? 'This phone is already a member. Reactivate them from the members list.' : add.error.message) : null;
  return (
    <Modal open={open} onClose={onClose} title="Add a member">
      <form onSubmit={submit} noValidate className="space-y-5">
        <Field label="Mobile number" hint="They sign in with this number."><Input type="tel" inputMode="numeric" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} autoFocus /></Field>
        <Field label="Name"><Input value={f.name} maxLength={80} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Role">
          <Select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as Role })}>
            <option value="RESIDENT">Resident</option><option value="GUARD">Guard</option><option value="ADMIN">Admin</option>
          </Select>
        </Field>
        {f.role === 'RESIDENT' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Flat"><Select value={f.flatId} onChange={(e) => setF({ ...f, flatId: e.target.value })}><option value="">Choose a flat</option>{flats.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</Select></Field>
            <Field label="Resident type"><Select value={f.residentType} onChange={(e) => setF({ ...f, residentType: e.target.value as ResidentType })}>{Object.entries(TYPE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
          </div>
        )}
        {(err || apiErr) && <p role="alert" className="text-body-sm text-critical-fg">{err || apiErr}</p>}
        <Button type="submit" full loading={add.isPending} icon={UserRoundPlus}>Add member</Button>
      </form>
    </Modal>
  );
}

function MemberRow({ m, self }: { m: Member; self: boolean }) {
  const [confirm, setConfirm] = useState(false);
  const change = useAct((b: { status?: string; role?: Role }) => patch<Member>(`/members/${m.id}`, b), {
    success: (r) => `${r.user.name} is now ${r.status === 'INACTIVE' ? 'inactive' : `${ROLE_LABEL[r.role].toLowerCase()}, active`}.`,
    onSuccess: () => setConfirm(false),
  });
  return (
    <tr className={tr}>
      <td className={td}><Who name={m.user.name} seed={m.user.id} sub={<span className="tabular-nums">{formatPhone(m.user.phone)}</span>} /></td>
      <td className={td}>
        <Select aria-label={`Role for ${m.user.name}`} value={m.role} className="w-36" disabled={change.isPending} onChange={(e) => change.mutate({ role: e.target.value as Role })}>
          <option value="ADMIN">Admin</option><option value="GUARD">Guard</option><option value="RESIDENT" disabled={!m.flat}>Resident</option>
        </Select>
      </td>
      <td className={td}>{flatOf(m) ? <Badge variant="outline">{flatOf(m)}</Badge> : '—'}</td>
      <td className={td}>{m.residentType ? <Badge>{TYPE_LABEL[m.residentType]}</Badge> : '—'}</td>
      <td className={td}><StatusChip spec={STATUS.membership[m.status]} /></td>
      <td className={`${td} text-right`}>
        {m.status === 'ACTIVE'
          ? <Button size="sm" variant="ghost" onClick={() => setConfirm(true)}>{self ? 'Leave' : 'Deactivate'}</Button>
          : <Button size="sm" variant="outline" loading={change.isPending} onClick={() => change.mutate({ status: 'ACTIVE' })}>Reactivate</Button>}
        <ConfirmModal open={confirm} onClose={() => setConfirm(false)} title={`Deactivate ${m.user.name}?`}
          body="They will lose access to this society straight away. You can reactivate them later." confirmLabel="Deactivate" loading={change.isPending} onConfirm={() => change.mutate({ status: 'INACTIVE' })} />
      </td>
    </tr>
  );
}

export default function Members() {
  const { active } = useAuth();
  const [tab, setTab] = useState<'flats' | 'members'>('flats');
  const [modal, setModal] = useState<null | 'block' | 'flats' | 'member'>(null);
  const [role, setRole] = useState('');
  const [blockFilter, setBlockFilter] = useState('');
  const blocks = useGet<List<Block>>('/blocks');
  const flats = useGet<List<Flat>>('/flats');
  const members = useGet<List<Member>>('/members', { role: role || undefined });
  const blockList = blocks.data?.items ?? [];
  const shown = blockFilter ? blockList.filter((b) => b.id === blockFilter) : blockList;

  return (
    <>
      <PageHeader title="Residents & flats" description="Blocks, flats and everyone who can sign in to this society."
        actions={tab === 'flats' ? (
          <><Button variant="outline" icon={Plus} onClick={() => setModal('block')}>Add block</Button><Button icon={Building} disabled={!blockList.length} onClick={() => setModal('flats')}>Add flats</Button></>
        ) : <Button icon={UserRoundPlus} onClick={() => setModal('member')}>Add member</Button>} />
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'flats', label: 'Flats' }, { id: 'members', label: 'Members' }]} />

      {tab === 'flats' ? (
        <Async q={blocks} empty={<Card><EmptyState icon={Building} title="No blocks yet." body="Add your first block or tower, then add its flats." action={<Button onClick={() => setModal('block')}>Add block</Button>} /></Card>}>
          {() => (
            <>
              <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Filter by block">
                {[{ id: '', name: 'All blocks' }, ...blockList.map((b) => ({ id: b.id, name: `Block ${b.name}` }))].map((b) => (
                  <button key={b.id} type="button" aria-pressed={blockFilter === b.id} onClick={() => setBlockFilter(b.id)}
                    className={`h-11 rounded-full border px-4 text-label ${blockFilter === b.id ? 'border-navy-900 bg-navy-900 text-white dark:border-navy-200 dark:bg-navy-200 dark:text-navy-950' : 'border-line-strong text-fg-muted'}`}>{b.name}</button>
                ))}
              </div>
              <div className="space-y-6">
                {shown.map((b) => {
                  const list = (flats.data?.items ?? []).filter((f) => f.block.id === b.id);
                  return (
                    <Card key={b.id} title={`Block ${b.name}`} description={`${b.flatCount} flat${b.flatCount === 1 ? '' : 's'}`}>
                      {list.length ? (
                        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                          {list.map((f) => (
                            <li key={f.id} className="rounded-control border border-line p-3">
                              <p className="text-h4 tabular-nums">{f.label}</p>
                              <p className="text-caption text-fg-subtle">{f.residentCount ? `${f.residentCount} resident${f.residentCount > 1 ? 's' : ''}` : 'Vacant on app'}</p>
                            </li>
                          ))}
                        </ul>
                      ) : <EmptyState icon={Building} title={`No flats yet in block ${b.name}.`} action={<Button variant="outline" onClick={() => setModal('flats')}>Add flats</Button>} />}
                    </Card>
                  );
                })}
              </div>
            </>
          )}
        </Async>
      ) : (
        <>
          <div className="mb-4 max-w-xs">
            <Select aria-label="Role" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="">All roles</option><option value="RESIDENT">Residents</option><option value="GUARD">Guards</option><option value="ADMIN">Admins</option>
            </Select>
          </div>
          <Async q={members} empty={<Card><EmptyState icon={Users} title="No members yet." body="Add residents and guards by phone number. They can sign in straight away." action={<Button onClick={() => setModal('member')}>Add member</Button>} /></Card>}>
            {(d) => (
              <Table caption="Members" head={['Name', 'Role', 'Flat', 'Type', 'Status', '']} right={[5]}>
                {d.items.map((m) => <MemberRow key={m.id} m={m} self={m.id === active?.id} />)}
              </Table>
            )}
          </Async>
        </>
      )}

      <BlockModal open={modal === 'block'} onClose={() => setModal(null)} />
      <FlatsModal open={modal === 'flats'} onClose={() => setModal(null)} blocks={blockList} />
      <MemberModal open={modal === 'member'} onClose={() => setModal(null)} flats={flats.data?.items ?? []} />
    </>
  );
}
