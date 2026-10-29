import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ArrowLeft, Building, ChevronRight, Hourglass, RotateCw } from 'lucide-react';
import { useAuth, roleHome } from '../auth/AuthContext';
import { api, post, type ApiError } from '../lib/api';
import { formatPhone, parseNumbers } from '../lib/format';
import type { Block, Membership, Society, User } from '../lib/types';
import { Badge, Button, Card, Field, Input, Select, useToast } from '../components/ui';
import { Logo } from '../components/Logo';

const STATES = ['Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'];

function Frame({ children }: { children: ReactNode }) {
  const { logout } = useAuth();
  return (
    <div className="min-h-dvh bg-canvas">
      <header className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4">
        <Link to="/"><Logo /></Link>
        <Button variant="ghost" size="sm" onClick={logout}>Sign out</Button>
      </header>
      <main className="mx-auto max-w-3xl px-4 pb-16 pt-6">{children}</main>
    </div>
  );
}

export function SocietyPicker() {
  const { token, memberships, select } = useAuth();
  const navigate = useNavigate();
  if (!token) return <Navigate to="/login" replace />;
  if (!memberships.length) return <Navigate to="/app/welcome" replace />;
  const go = (m: Membership) => { select(m.id); navigate(roleHome(m)); };
  return (
    <Frame>
      <h1 className="text-h1">Choose a society</h1>
      <p className="mt-1 text-body text-fg-muted">You belong to more than one. We'll remember your choice on this device.</p>
      <ul className="mt-8 grid gap-4 sm:grid-cols-2">
        {memberships.map((m) => (
          <li key={m.id}>
            <button type="button" onClick={() => go(m)} className="flex w-full items-center gap-4 rounded-card bg-surface p-5 text-left shadow-card transition-shadow duration-fast hover:shadow-raised dark:border dark:border-line">
              <span aria-hidden className="flex h-12 w-12 items-center justify-center rounded-control bg-navy-900 font-display text-h2 text-gold-500">{m.society.name.charAt(0)}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-h3 text-fg-heading">{m.society.name}</span>
                <span className="mt-1 flex flex-wrap items-center gap-2 text-body-sm text-fg-muted">
                  {m.society.city}
                  <Badge>{m.role === 'ADMIN' ? 'Admin' : m.role === 'GUARD' ? 'Guard' : 'Resident'}</Badge>
                  {m.flat && <Badge variant="outline">{m.flat.block.name}-{m.flat.number}</Badge>}
                </span>
              </span>
              <ChevronRight size={20} className="text-fg-subtle" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </Frame>
  );
}

export function Welcome() {
  const { token, user, memberships, update, select } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState({ name: '', addressLine: '', city: '', state: 'Karnataka', pincode: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<Society | null>(null);
  const [blocks, setBlocks] = useState('A, B');
  const [flats, setFlats] = useState('101-104');
  const [checking, setChecking] = useState(false);

  if (!token) return <Navigate to="/login" replace />;
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const create = async (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (form.name.trim().length < 2) errs.name = 'Enter the society name.';
    if (!form.addressLine.trim()) errs.addressLine = 'Enter the street address.';
    if (!form.city.trim()) errs.city = 'Enter the city.';
    if (!/^[1-9]\d{5}$/.test(form.pincode)) errs.pincode = 'Enter a 6-digit pincode.';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      const r = await post<{ society: Society; membership: Membership }>('/societies', form);
      update({ memberships: [...memberships, r.membership] });
      select(r.membership.id);
      setCreated(r.society);
      toast(`${r.society.name} created. You're its admin.`);
    } catch (err) { toast((err as ApiError).message, 'danger'); } finally { setBusy(false); }
  };

  const setup = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const numbers = parseNumbers(flats);
      for (const name of blocks.split(',').map((s) => s.trim()).filter(Boolean)) {
        const b = await post<Block>('/blocks', { name });
        if (numbers.length) await post('/flats/bulk', { blockId: b.id, numbers });
      }
      toast('Blocks and flats added.');
      navigate('/app/admin');
    } catch (err) { toast((err as ApiError).message, 'danger'); } finally { setBusy(false); }
  };

  const recheck = async () => {
    setChecking(true);
    try {
      const r = await api<{ user: User; memberships: Membership[] }>('/me');
      update(r);
      if (r.memberships.length) navigate('/app');
      else toast('No invite yet. Ask your society admin to add your number.', 'info');
    } catch (err) { toast((err as ApiError).message, 'danger'); } finally { setChecking(false); }
  };

  if (created) {
    const preview = parseNumbers(flats);
    const blockList = blocks.split(',').map((s) => s.trim()).filter(Boolean);
    return (
      <Frame>
        <h1 className="text-h1">Add blocks and flats</h1>
        <p className="mt-1 text-body text-fg-muted">Set up {created.name} in one go. You can add more later under Residents & flats.</p>
        <Card className="mt-8">
          <form onSubmit={setup} className="space-y-5">
            <Field label="Blocks or towers" hint="Separate with commas, e.g. A, B, C">
              <Input value={blocks} onChange={(e) => setBlocks(e.target.value)} />
            </Field>
            <Field label="Flat numbers in each block" hint="Ranges and lists both work, e.g. 101-104, 201-204">
              <Input value={flats} onChange={(e) => setFlats(e.target.value)} />
            </Field>
            <p className="text-body-sm text-fg-muted">This will create {blockList.length} block{blockList.length === 1 ? '' : 's'} with {preview.length} flat{preview.length === 1 ? '' : 's'} each ({blockList.length * preview.length} in total).</p>
            <div className="flex flex-wrap gap-3">
              <Button type="submit" loading={busy} disabled={!blockList.length}>Add blocks and flats</Button>
              <Button variant="ghost" onClick={() => navigate('/app/admin')}>Skip for now</Button>
            </div>
          </form>
        </Card>
      </Frame>
    );
  }

  return (
    <Frame>
      {memberships.length > 0 && (
        <Link to="/app" className="-ml-2 mb-4 inline-flex h-11 items-center gap-1 rounded-control px-2 text-label text-fg-muted hover:text-fg"><ArrowLeft size={18} aria-hidden /> Back</Link>
      )}
      <h1 className="text-h1">Welcome{user?.name ? `, ${user.name.split(' ')[0]}` : ''}</h1>
      <p className="mt-1 text-body text-fg-muted">Join your society, or set up a new one as its admin.</p>

      {memberships.length === 0 && (
        <Card className="mt-8" title="Waiting for an invite" description="Residents and guards are added by the society admin.">
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-status-warning-bg text-status-warning-dot"><Hourglass size={24} aria-hidden /></span>
            <p className="min-w-0 flex-1 text-body text-fg">Ask your society admin to add <span className="font-semibold tabular-nums">{user ? formatPhone(user.phone) : 'your number'}</span>. Then check again here.</p>
            <Button variant="outline" icon={RotateCw} loading={checking} onClick={recheck}>Check again</Button>
          </div>
        </Card>
      )}

      <Card className="mt-6" title="Create a society" description="You'll become its admin and can add blocks, flats, residents and guards.">
        <form onSubmit={create} noValidate className="grid gap-5 sm:grid-cols-2">
          <Field label="Society name" error={errors.name} className="sm:col-span-2">
            <Input value={form.name} onChange={set('name')} maxLength={120} placeholder="Emerald Heights" aria-invalid={!!errors.name} />
          </Field>
          <Field label="Address line" error={errors.addressLine} className="sm:col-span-2">
            <Input value={form.addressLine} onChange={set('addressLine')} maxLength={200} aria-invalid={!!errors.addressLine} />
          </Field>
          <Field label="City" error={errors.city}>
            <Input value={form.city} onChange={set('city')} maxLength={80} aria-invalid={!!errors.city} />
          </Field>
          <Field label="State">
            <Select value={form.state} onChange={set('state')}>{STATES.map((s) => <option key={s}>{s}</option>)}</Select>
          </Field>
          <Field label="Pincode" error={errors.pincode}>
            <Input value={form.pincode} onChange={set('pincode')} inputMode="numeric" maxLength={6} className="tabular-nums" aria-invalid={!!errors.pincode} />
          </Field>
          <div className="flex items-end sm:col-span-2">
            <Button type="submit" icon={Building} loading={busy}>Create society</Button>
          </div>
        </form>
      </Card>
    </Frame>
  );
}
