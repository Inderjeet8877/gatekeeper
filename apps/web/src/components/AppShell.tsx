import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell, Building, CalendarClock, CalendarDays, Check, ChevronsUpDown, CircleUserRound, ConciergeBell, DoorOpen,
  HandHelping, Hourglass, House, IndianRupee, KeyRound, LayoutDashboard, LifeBuoy, LogOut, Megaphone, Menu, Moon,
  Phone, ReceiptIndianRupee, Settings, Siren, Sun, UserRoundCheck, UserRoundPlus, UsersRound, Vote, Wallet, X,
  type LucideIcon,
} from 'lucide-react';
import { useAuth, roleHome } from '../auth/AuthContext';
import { patch, post, useAct, useGet } from '../lib/api';
import { useEvents } from '../lib/sse';
import { formatRelative, formatTime, maskPhone } from '../lib/format';
import { SOS_TYPE } from '../lib/status';
import type { List, Notification, ReportSummary, Role, SosAlert, Visitor } from '../lib/types';
import { Avatar, Badge, Button, cx, EmptyState, IconButton, Modal, useToast, Async } from './ui';
import { Logo } from './Logo';
import { ApprovalTakeover } from '../pages/resident/Visitors';

/* ── Theme (app only; marketing stays light) ───────────────────────── */
export type ThemePref = 'system' | 'light' | 'dark';
export const getThemePref = (): ThemePref => {
  try { return (localStorage.getItem('gk-theme') as ThemePref) || 'system'; } catch { return 'system'; }
};
const systemDark = () => matchMedia('(prefers-color-scheme: dark)').matches;
const applyTheme = () => {
  const p = getThemePref();
  const dark = p === 'dark' || (p === 'system' && systemDark());
  document.documentElement.classList.toggle('dark', dark);
  return dark;
};
export function setThemePref(p: ThemePref) {
  try { if (p === 'system') localStorage.removeItem('gk-theme'); else localStorage.setItem('gk-theme', p); } catch { /* private mode */ }
  applyTheme();
  window.dispatchEvent(new Event('gk-theme'));
}
function useAppTheme() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  useEffect(() => {
    const sync = () => setDark(applyTheme());
    sync();
    const mq = matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', sync);
    window.addEventListener('gk-theme', sync);
    return () => {
      mq.removeEventListener('change', sync);
      window.removeEventListener('gk-theme', sync);
      document.documentElement.classList.remove('dark');
    };
  }, []);
  return dark;
}

/* ── Navigation config ─────────────────────────────────────────────── */
type Item = { to: string; label: string; icon: LucideIcon; end?: boolean; badge?: 'pending' | 'sos' };
type Group = { label?: string; items: Item[] };
const NAV: Record<Role, Group[]> = {
  ADMIN: [
    { label: 'Gate', items: [
      { to: '/app/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
      { to: '/app/admin/visitors', label: 'Visitors', icon: UserRoundCheck, badge: 'pending' },
      { to: '/app/admin/staff', label: 'Staff', icon: HandHelping },
      { to: '/app/admin/sos', label: 'SOS', icon: Siren, badge: 'sos' },
    ] },
    { label: 'Community', items: [
      { to: '/app/admin/residents', label: 'Residents & flats', icon: Building },
      { to: '/app/admin/notices', label: 'Notices', icon: Megaphone },
      { to: '/app/admin/polls', label: 'Polls', icon: Vote },
      { to: '/app/admin/helpdesk', label: 'Helpdesk', icon: LifeBuoy },
      { to: '/app/admin/amenities', label: 'Amenities', icon: CalendarDays },
    ] },
    { label: 'Accounts', items: [
      { to: '/app/admin/billing', label: 'Billing', icon: ReceiptIndianRupee },
      { to: '/app/admin/expenses', label: 'Expenses', icon: Wallet },
    ] },
    { items: [{ to: '/app/admin/settings', label: 'Settings', icon: Settings }] },
  ],
  RESIDENT: [
    { items: [
      { to: '/app/home', label: 'Home', icon: House, end: true },
      { to: '/app/home/visitors', label: 'Visitors', icon: UserRoundCheck, badge: 'pending' },
      { to: '/app/home/community', label: 'Community', icon: UsersRound },
      { to: '/app/home/services', label: 'Services', icon: ConciergeBell },
      { to: '/app/home/payments', label: 'Payments', icon: IndianRupee },
      { to: '/app/home/profile', label: 'Profile', icon: CircleUserRound },
    ] },
  ],
  GUARD: [
    { items: [
      { to: '/app/gate', label: 'Verify passcode', icon: KeyRound, end: true },
      { to: '/app/gate/log', label: 'Log visitor', icon: UserRoundPlus },
      { to: '/app/gate/pending', label: 'Awaiting approval', icon: Hourglass, badge: 'pending' },
      { to: '/app/gate/expected', label: 'Expected', icon: CalendarClock },
      { to: '/app/gate/inside', label: 'Inside now', icon: DoorOpen },
      { to: '/app/gate/staff', label: 'Staff', icon: HandHelping },
      { to: '/app/gate/sos', label: 'SOS alerts', icon: Siren, badge: 'sos' },
    ] },
  ],
};

function useBadges(role: Role) {
  const summary = useGet<ReportSummary>(role === 'ADMIN' ? '/reports/summary' : null);
  const pending = useGet<List<Visitor>>(role !== 'ADMIN' ? '/visitors' : null, { status: 'PENDING_APPROVAL' });
  const sos = useGet<List<SosAlert>>(role === 'GUARD' ? '/sos' : null, { status: 'RAISED,ACKNOWLEDGED' });
  return {
    pending: role === 'ADMIN' ? summary.data?.pendingApprovals ?? 0 : pending.data?.items.length ?? 0,
    sos: role === 'ADMIN' ? summary.data?.sosActive ?? 0 : sos.data?.items.length ?? 0,
  };
}

/* ── Shell ─────────────────────────────────────────────────────────── */
export function AppShell({ role }: { role: Role }) {
  const { user, active, memberships, logout, select } = useAuth();
  const dark = useAppTheme();
  const live = useEvents();
  const badges = useBadges(role);
  const loc = useLocation();
  const navigate = useNavigate();
  const toast = useToast();
  const [drawer, setDrawer] = useState(false);
  const [switcher, setSwitcher] = useState(false);
  const [bell, setBell] = useState(false);
  const notifs = useGet<List<Notification> & { unreadCount: number }>('/notifications', { limit: 30 });

  useEffect(() => setDrawer(false), [loc.pathname]);

  const nav = NAV[role];
  const flat = active?.flat ? `${active.flat.block.name}-${active.flat.number}` : null;

  const sidebar = (
    <nav aria-label="Main" className="flex h-full flex-col bg-navy-900 text-navy-200 dark:border-r dark:border-navy-800">
      <div className="px-6 pb-5 pt-6"><Logo reversed /></div>
      <div aria-hidden className="mx-6 h-px bg-gold-500/40" />
      <div className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
        {nav.map((g, i) => (
          <div key={i}>
            {g.label && <p className="mb-1.5 px-3 text-caption text-navy-300">{g.label}</p>}
            <ul className="space-y-0.5">
              {g.items.map((it) => {
                const count = it.badge ? badges[it.badge] : 0;
                return (
                  <li key={it.to}>
                    <NavLink to={it.to} end={it.end} className={({ isActive }) => cx(
                      'relative flex h-11 items-center gap-3 rounded-control px-3 text-label transition-colors duration-fast',
                      isActive ? 'bg-navy-800 text-white' : 'hover:bg-navy-800 hover:text-white',
                    )}>
                      {({ isActive }) => (
                        <>
                          {isActive && <span aria-hidden className="absolute bottom-2 left-0 top-2 w-[3px] rounded-r bg-emerald-500" />}
                          <it.icon size={20} strokeWidth={1.75} aria-hidden className={isActive ? 'text-emerald-300' : ''} />
                          <span className="flex-1">{it.label}</span>
                          {count > 0 && <Badge variant={it.badge === 'sos' ? 'count-alert' : 'count'} className={it.badge === 'pending' ? '!bg-white !text-navy-900' : ''}>{count}</Badge>}
                        </>
                      )}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3 border-t border-navy-800 px-4 py-4">
        <Avatar name={user?.name ?? '?'} seed={user?.id} size={32} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-label text-white">{user?.name}</p>
          <p className="text-caption text-navy-300">{role === 'ADMIN' ? 'Admin' : role === 'GUARD' ? 'Guard · on duty' : flat ?? 'Resident'}</p>
        </div>
        <button type="button" onClick={logout} aria-label={role === 'GUARD' ? 'End shift' : 'Sign out'} title="Sign out" className="flex h-11 w-11 items-center justify-center rounded-full text-navy-200 hover:bg-navy-800 hover:text-white">
          <LogOut size={20} strokeWidth={1.75} aria-hidden />
        </button>
      </div>
    </nav>
  );

  return (
    <div className={cx('min-h-dvh lg:pl-[264px]', role === 'RESIDENT' ? 'bg-canvas' : 'bg-canvas-tint')}>
      <a href="#main" className="sr-only z-tooltip rounded-control bg-surface px-4 py-2 focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Skip to content</a>

      <aside className="fixed inset-y-0 left-0 z-sidebar hidden w-[264px] lg:block">{sidebar}</aside>
      {drawer && (
        <div className="fixed inset-0 z-sidebar lg:hidden">
          <div className="absolute inset-0" style={{ background: 'var(--gk-overlay)' }} onClick={() => setDrawer(false)} aria-hidden />
          <aside className="absolute inset-y-0 left-0 w-[280px] max-w-[85vw] animate-rise">{sidebar}</aside>
          <IconButton label="Close menu" icon={X} onClick={() => setDrawer(false)} className="absolute right-3 top-3 !text-white" />
        </div>
      )}

      <header className={cx('sticky top-0 z-sticky border-b border-line backdrop-blur', role === 'RESIDENT' ? 'bg-canvas/90' : 'bg-canvas-tint/90')}>
        <div className="mx-auto flex h-16 max-w-app items-center gap-2 px-4 md:px-6">
          <IconButton label="Open menu" icon={Menu} onClick={() => setDrawer(true)} className={cx('lg:hidden', role === 'RESIDENT' && 'hidden')} />
          {memberships.length > 1 ? (
            <button type="button" onClick={() => setSwitcher(true)} aria-haspopup="dialog" className="flex min-w-0 items-center gap-2 rounded-control px-2 py-2 hover:bg-surface-sunken">
              <SocietyTile name={active?.society.name ?? ''} />
              <span className="truncate text-h4 text-fg-heading">{active?.society.name}</span>
              {flat && <span className="hidden text-body-sm text-fg-muted sm:inline">· {flat}</span>}
              <ChevronsUpDown size={16} className="shrink-0 text-fg-subtle" aria-hidden />
            </button>
          ) : (
            <div className="flex min-w-0 items-center gap-2 px-2">
              <SocietyTile name={active?.society.name ?? ''} />
              <span className="truncate text-h4 text-fg-heading">{active?.society.name}</span>
              {flat && <span className="hidden text-body-sm text-fg-muted sm:inline">· {flat}</span>}
              {role === 'GUARD' && <span className="hidden text-body-sm text-fg-muted sm:inline">· Main Gate</span>}
            </div>
          )}
          <div className="ml-auto flex items-center gap-1">
            {role === 'ADMIN' && badges.sos > 0 && (
              <button type="button" onClick={() => navigate('/app/admin/sos')} className="mr-1 inline-flex h-9 items-center gap-1.5 rounded-full bg-danger-600 px-3 text-label text-white">
                <Siren size={16} aria-hidden /> {badges.sos} active SOS
              </button>
            )}
            {role === 'GUARD' && <GuardClock live={live} />}
            <IconButton label={dark ? 'Switch to light mode' : 'Switch to dark mode'} icon={dark ? Sun : Moon} onClick={() => setThemePref(dark ? 'light' : 'dark')} />
            <IconButton label="Open notifications" icon={Bell} badge={notifs.data?.unreadCount} onClick={() => setBell(true)} />
            {role === 'RESIDENT' && (
              <button type="button" onClick={() => navigate('/app/home/profile')} aria-label="Profile" className="ml-1 rounded-full">
                <Avatar name={user?.name ?? '?'} seed={user?.id} size={36} />
              </button>
            )}
          </div>
        </div>
      </header>

      <main id="main" className={cx('mx-auto px-4 py-6 md:px-6 lg:py-10', role === 'RESIDENT' ? 'max-w-3xl pb-28 lg:pb-10' : 'max-w-app')}>
        <Outlet />
      </main>

      {role === 'RESIDENT' && (
        <nav aria-label="Tabs" className="fixed inset-x-0 bottom-0 z-sticky border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden">
          <ul className="mx-auto flex max-w-xl">
            {nav[0].items.slice(0, 5).map((it) => (
              <li key={it.to} className="flex-1">
                <NavLink to={it.to} end={it.end} className={({ isActive }) => cx('relative flex h-16 flex-col items-center justify-center gap-1 text-caption', isActive ? 'text-fg-heading' : 'text-fg-subtle')}>
                  {({ isActive }) => (
                    <>
                      {isActive && <span aria-hidden className="absolute top-0 h-[3px] w-6 rounded-b bg-emerald-500" />}
                      <span className="relative">
                        <it.icon size={24} strokeWidth={1.75} aria-hidden />
                        {it.badge === 'pending' && badges.pending > 0 && <span className="absolute -right-2 -top-1"><Badge variant="count">{badges.pending}</Badge></span>}
                      </span>
                      {it.label}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {(role === 'GUARD' || role === 'ADMIN') && <SosTakeover role={role} />}
      {role === 'RESIDENT' && <ApprovalTakeover />}

      <Modal open={switcher} onClose={() => setSwitcher(false)} title="Switch society">
        <ul className="space-y-2">
          {memberships.map((m) => (
            <li key={m.id}>
              <button type="button" onClick={() => {
                select(m.id);
                setSwitcher(false);
                navigate(roleHome(m));
                toast(`Switched to ${m.society.name}.`, 'info');
              }} className="flex w-full items-center gap-3 rounded-card border border-line p-3 text-left hover:bg-surface-sunken">
                <SocietyTile name={m.society.name} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-h4 text-fg-heading">{m.society.name}</span>
                  <span className="text-caption text-fg-subtle">{m.society.city}{m.flat ? ` · ${m.flat.block.name}-${m.flat.number}` : ''}</span>
                </span>
                <Badge>{m.role === 'ADMIN' ? 'Admin' : m.role === 'GUARD' ? 'Guard' : 'Resident'}</Badge>
                {m.id === active?.id && <Check size={20} className="text-brand-fg" aria-label="Current" />}
              </button>
            </li>
          ))}
        </ul>
        <Button variant="link" className="mt-4" onClick={() => { setSwitcher(false); navigate('/app/welcome'); }}>Create a society</Button>
      </Modal>

      <NotificationsPanel open={bell} onClose={() => setBell(false)} />
    </div>
  );
}

const SocietyTile = ({ name }: { name: string }) => (
  <span aria-hidden className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm bg-navy-900 text-caption font-bold text-gold-500">{name.charAt(0)}</span>
);

function GuardClock({ live }: { live: boolean }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 15_000); return () => clearInterval(t); }, []);
  return (
    <div className="mr-2 hidden items-center gap-4 sm:flex">
      <span className="inline-flex items-center gap-2 text-body-sm font-semibold text-fg-muted" role="status">
        <span aria-hidden className={cx('h-2.5 w-2.5 rounded-full', live ? 'bg-status-success-dot' : 'bg-status-neutral-dot animate-dot-pulse')} />
        {live ? 'Live' : 'Reconnecting…'}
      </span>
      <span className="text-h3 tabular-nums text-fg-heading">{formatTime(now)}</span>
    </div>
  );
}

function NotificationsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const q = useGet<List<Notification> & { unreadCount: number }>('/notifications', { limit: 30 });
  const readAll = useAct(() => post('/notifications/read-all'), { success: 'All notifications marked as read.' });
  const read = useAct((id: string) => post(`/notifications/${id}/read`), { quiet: true });
  return (
    <Modal open={open} onClose={onClose} title="Notifications" footer={
      q.data?.unreadCount ? <Button variant="outline" loading={readAll.isPending} onClick={() => readAll.mutate()}>Mark all as read</Button> : undefined
    }>
      <Async q={q} empty={<EmptyState icon={Bell} title="You're up to date." body="Visitor requests, notices and replies will appear here." positive />}>
        {(d) => (
          <ul className="-mx-2 divide-y divide-line">
            {d.items.map((n) => (
              <li key={n.id}>
                <button type="button" onClick={() => !n.readAt && read.mutate(n.id)} className="flex w-full gap-3 rounded-control px-2 py-3 text-left hover:bg-surface-sunken">
                  <span aria-hidden className={cx('mt-2 h-2 w-2 shrink-0 rounded-full', n.readAt ? 'bg-transparent' : 'bg-navy-700 dark:bg-navy-200')} />
                  <span className="min-w-0 flex-1">
                    {!n.readAt && <span className="sr-only">Unread. </span>}
                    <span className="block text-body-sm font-semibold text-fg-heading">{n.title}</span>
                    <span className="block text-body-sm text-fg-muted">{n.body}</span>
                    <span className="mt-0.5 block text-caption tabular-nums text-fg-subtle">{formatRelative(n.createdAt)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Async>
    </Modal>
  );
}

/* ── SOS takeover (guard full-screen, admin same content, can hide) ── */
function SosTakeover({ role }: { role: Role }) {
  const q = useGet<List<SosAlert>>('/sos', { status: 'RAISED' });
  const [hidden, setHidden] = useState<string[]>([]);
  const [idx, setIdx] = useState(0);
  const alerts = (q.data?.items ?? []).filter((a) => !hidden.includes(a.id));
  const a = alerts[Math.min(idx, alerts.length - 1)];
  const ack = useAct((id: string) => patch(`/sos/${id}`, { status: 'ACKNOWLEDGED' }), { success: 'Acknowledged. The resident knows you are on the way.' });
  const resolve = useAct((id: string) => patch(`/sos/${id}`, { status: 'RESOLVED' }), { success: 'Alert marked resolved.' });

  // Repeating tone on the gate tablet until acknowledged (respects device volume).
  const alertId = a?.id;
  useEffect(() => {
    if (!alertId || role !== 'GUARD') return;
    let ctx: AudioContext | null = null;
    try { ctx = new AudioContext(); } catch { return; }
    const beep = () => {
      if (!ctx) return;
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = 880; g.gain.value = 0.12;
      o.connect(g).connect(ctx.destination);
      o.start(); o.stop(ctx.currentTime + 0.4);
    };
    beep();
    const t = setInterval(beep, 5000);
    return () => { clearInterval(t); ctx?.close(); };
  }, [alertId, role]);

  if (!a) return null;
  const T = SOS_TYPE[a.type];
  return (
    <div role="alertdialog" aria-modal="true" aria-labelledby="sos-title" aria-live="assertive" className="fixed inset-0 z-sos flex flex-col overflow-y-auto bg-canvas">
      <div className="border-b-4 border-danger-800 bg-danger-600 text-white">
        {alerts.length > 1 && (
          <div className="flex gap-1 overflow-x-auto px-4 pt-3" role="tablist" aria-label="Active alerts">
            {alerts.map((x, i) => (
              <button key={x.id} role="tab" aria-selected={x.id === a.id} onClick={() => setIdx(i)} className={cx('h-11 shrink-0 rounded-t-control px-4 text-label', x.id === a.id ? 'bg-white text-danger-700' : 'bg-danger-700 text-white')}>
                {SOS_TYPE[x.type].label} · {x.flat?.label ?? 'Society'}
              </button>
            ))}
          </div>
        )}
        <div className="mx-auto flex max-w-4xl items-center gap-4 px-6 py-6">
          <Siren size={40} aria-hidden />
          <h2 id="sos-title" className="text-guard-xl !text-white">{T.label} emergency — {a.flat?.label ?? 'Society'}</h2>
        </div>
      </div>
      <div className="mx-auto w-full max-w-4xl flex-1 px-6 py-8">
        <p className="text-guard-body text-fg">Raised by {a.raisedBy.name} at {formatTime(a.createdAt)}. Acknowledge to let them know you're on the way.</p>
        {a.message && <p className="mt-4 rounded-card bg-status-danger-bg p-4 text-guard-body text-status-danger-fg">“{a.message}”</p>}
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <Button size="xl" variant="primary" icon={Check} loading={ack.isPending} autoFocus onClick={() => ack.mutate(a.id)}>Acknowledge — I'm on the way</Button>
          <a href={`tel:${a.raisedBy.phone}`} className="inline-flex h-[72px] items-center justify-center gap-3 rounded-control border border-line-strong bg-surface px-7 text-[20px] font-bold text-fg-heading hover:bg-surface-sunken">
            <Phone size={28} aria-hidden /> Call {maskPhone(a.raisedBy.phone)}
          </a>
          <Button size="lg" variant="secondary" loading={resolve.isPending} onClick={() => resolve.mutate(a.id)}>Mark resolved</Button>
          {role === 'ADMIN' && <Button size="lg" variant="ghost" onClick={() => setHidden((h) => [...h, a.id])}>Hide for now</Button>}
        </div>
      </div>
    </div>
  );
}
