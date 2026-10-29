import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Monitor, Moon, Siren, Sun } from 'lucide-react';
import { patch, useAct, useGet } from '../../lib/api';
import { formatDateTime, formatPhone } from '../../lib/format';
import { SOS_TYPE, STATUS } from '../../lib/status';
import type { List, SosAlert, User } from '../../lib/types';
import { useAuth, roleHome } from '../../auth/AuthContext';
import { getThemePref, setThemePref, type ThemePref } from '../../components/AppShell';
import { Async, Avatar, Badge, Button, Card, cx, EmptyState, Field, Input, PageHeader, StatusChip } from '../../components/ui';
import { SosSheet } from './Home';

export function AccountForm() {
  const { user, update } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [err, setErr] = useState<string | null>(null);
  const save = useAct(() => patch<User>('/me', { name: name.trim(), email: email.trim() || null }), {
    success: 'Changes saved.', onSuccess: (u) => update({ user: u }),
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setErr('Enter your name.');
    if (email && !/^\S+@\S+\.\S+$/.test(email)) return setErr('Enter a valid email address, or leave it empty.');
    setErr(null); save.mutate();
  };
  return (
    <Card title="Account">
      <form onSubmit={submit} noValidate className="space-y-5">
        <div className="flex items-center gap-4">
          <Avatar name={user?.name ?? '?'} seed={user?.id} size={56} />
          <div><p className="text-h4">{user?.name}</p><p className="text-body-sm tabular-nums text-fg-muted">{user ? formatPhone(user.phone) : ''}</p></div>
        </div>
        <Field label="Name"><Input value={name} maxLength={80} onChange={(e) => setName(e.target.value)} autoComplete="name" /></Field>
        <Field label="Email" optional><Input type="email" value={email} maxLength={254} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></Field>
        {err && <p role="alert" className="text-body-sm text-critical-fg">{err}</p>}
        <Button type="submit" loading={save.isPending}>Save changes</Button>
      </form>
    </Card>
  );
}

export function Appearance() {
  const [pref, setPref] = useState<ThemePref>(getThemePref);
  const opts: [ThemePref, string, typeof Sun][] = [['system', 'System', Monitor], ['light', 'Light', Sun], ['dark', 'Dark', Moon]];
  return (
    <Card title="Appearance" description="System follows your device's light or dark setting.">
      <div role="radiogroup" aria-label="Theme" className="inline-flex rounded-control bg-surface-sunken p-1">
        {opts.map(([v, l, I]) => (
          <button key={v} type="button" role="radio" aria-checked={pref === v} onClick={() => { setPref(v); setThemePref(v); }}
            className={cx('inline-flex h-9 items-center gap-2 rounded-[8px] px-4 text-label', pref === v ? 'bg-surface text-fg-heading shadow-xs' : 'text-fg-muted hover:text-fg')}>
            <I size={16} aria-hidden />{l}
          </button>
        ))}
      </div>
    </Card>
  );
}

export function Memberships() {
  const { memberships, active, select } = useAuth();
  const navigate = useNavigate();
  return (
    <Card title="Societies">
      <ul className="-my-3 divide-y divide-line">
        {memberships.map((m) => (
          <li key={m.id} className="flex flex-wrap items-center gap-3 py-3">
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{m.society.name}</span>
              <span className="text-body-sm text-fg-muted">{m.society.city}{m.flat ? ` · ${m.flat.block.name}-${m.flat.number}` : ''}</span>
            </span>
            <Badge>{m.role === 'ADMIN' ? 'Admin' : m.role === 'GUARD' ? 'Guard' : m.residentType ? m.residentType.charAt(0) + m.residentType.slice(1).toLowerCase() : 'Resident'}</Badge>
            {m.id === active?.id ? <span className="text-caption text-fg-subtle">Current</span> : (
              <Button size="sm" variant="outline" onClick={() => { select(m.id); navigate(roleHome(m)); }}>Switch</Button>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

export default function Profile() {
  const { logout } = useAuth();
  const [sos, setSos] = useState(false);
  const alerts = useGet<List<SosAlert>>('/sos', { limit: 10 });
  return (
    <>
      <PageHeader title="Profile" />
      <div className="space-y-6">
        <AccountForm />
        <Memberships />
        <Appearance />
        <Card title="Emergency alerts" description="Alerts you've raised. The SOS button on Home works by pressing and holding."
          actions={<Button variant="danger-outline" size="sm" icon={Siren} onClick={() => setSos(true)}>Raise SOS</Button>}>
          <Async q={alerts} empty={<EmptyState icon={Siren} title="No alerts raised." body="We hope it stays that way." />} skeleton={<div className="h-12" />}>
            {(d) => (
              <ul className="-my-3 divide-y divide-line">
                {d.items.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 py-3">
                    <span className="min-w-0 flex-1"><span className="block font-semibold">{SOS_TYPE[a.type].label}</span><span className="text-body-sm tabular-nums text-fg-muted">{formatDateTime(a.createdAt)}{a.acknowledgedBy ? ` · ${a.acknowledgedBy.name} responded` : ''}</span></span>
                    <StatusChip spec={STATUS.sos[a.status]} />
                  </li>
                ))}
              </ul>
            )}
          </Async>
        </Card>
        <Button variant="outline" icon={LogOut} onClick={logout}>Sign out</Button>
      </div>
      <SosSheet open={sos} onClose={() => setSos(false)} />
    </>
  );
}
