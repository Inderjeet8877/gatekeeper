import {
  createContext, forwardRef, useCallback, useContext, useEffect, useId, useRef, useState,
  type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes,
  type TextareaHTMLAttributes, type KeyboardEvent,
} from 'react';
import { Link } from 'react-router-dom';
import type { UseQueryResult } from '@tanstack/react-query';
import {
  Check, ChevronDown, CircleAlert, CircleX, Info, LoaderCircle, RotateCw, X, type LucideIcon,
} from 'lucide-react';
import type { Spec, Tone } from '../lib/status';
import type { ApiError } from '../lib/api';

export const cx = (...c: (string | false | 0 | null | undefined)[]) => c.filter(Boolean).join(' ');

/** Re-render every `ms` (for countdowns and clocks). */
export function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(t); }, [ms]);
  return now;
}

/* ── Button ─────────────────────────────────────────────────────────── */
type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'danger-outline' | 'link';
type Size = 'sm' | 'md' | 'lg' | 'xl';
const VARIANT: Record<Variant, string> = {
  primary: 'bg-brand text-fg-on-brand hover:bg-brand-hover',
  secondary: 'bg-primary text-white hover:bg-primary-hover',
  outline: 'border border-line-strong bg-surface text-fg-heading hover:bg-surface-sunken',
  ghost: 'text-fg-muted hover:bg-surface-sunken hover:text-fg',
  danger: 'bg-critical text-white hover:bg-critical-hover',
  'danger-outline': 'border border-danger-600 text-critical-fg hover:bg-status-danger-bg',
  link: 'text-brand-fg underline-offset-4 hover:underline !px-0 !h-auto',
};
const SIZE: Record<Size, string> = {
  sm: 'h-9 px-3 text-[14px] gap-1.5',
  md: 'h-11 px-4 text-[15px] gap-2',
  lg: 'h-[52px] px-5 text-[16px] gap-2',
  xl: 'h-[72px] px-7 text-[20px] font-bold gap-3',
};
export const btnClass = (variant: Variant = 'primary', size: Size = 'md', full = false) =>
  cx(
    'inline-flex select-none items-center justify-center whitespace-nowrap rounded-control font-semibold',
    'transition-colors duration-fast ease-standard active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-40',
    VARIANT[variant], SIZE[size], full && 'w-full',
  );

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant; size?: Size; icon?: LucideIcon; loading?: boolean; full?: boolean;
};
export function Button({ variant, size = 'md', icon: Icon, loading, full, children, className, disabled, type = 'button', ...rest }: BtnProps) {
  const iconSize = size === 'xl' ? 28 : size === 'sm' ? 16 : 20;
  return (
    <button type={type} className={cx(btnClass(variant, size, full), className)} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading ? <LoaderCircle size={iconSize} className="animate-spin" aria-hidden /> : Icon && <Icon size={iconSize} strokeWidth={size === 'xl' ? 2 : 1.75} aria-hidden />}
      {children}
    </button>
  );
}
export function ButtonLink({ to, variant, size, icon: Icon, full, children, className }: { to: string; variant?: Variant; size?: Size; icon?: LucideIcon; full?: boolean; children: ReactNode; className?: string }) {
  return (
    <Link to={to} className={cx(btnClass(variant, size, full), className)}>
      {Icon && <Icon size={size === 'xl' ? 28 : 20} strokeWidth={1.75} aria-hidden />}
      {children}
    </Link>
  );
}

export function IconButton({ label, icon: Icon, className, badge, size = 44, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; icon: LucideIcon; badge?: number; size?: 44 | 64 }) {
  return (
    <button type="button" aria-label={label} title={label} className={cx('relative inline-flex shrink-0 items-center justify-center rounded-full text-fg-muted transition-colors duration-fast hover:bg-surface-sunken hover:text-fg', size === 64 ? 'h-16 w-16' : 'h-11 w-11', className)} {...rest}>
      <Icon size={size === 64 ? 28 : 20} strokeWidth={1.75} aria-hidden />
      {!!badge && <span className="absolute right-0.5 top-0.5"><Badge variant="count">{badge > 99 ? '99+' : badge}</Badge></span>}
    </button>
  );
}

export const Spinner = ({ className }: { className?: string }) => <LoaderCircle className={cx('animate-spin', className)} size={20} aria-hidden />;

/* ── Form controls ─────────────────────────────────────────────────── */
const control = 'w-full rounded-control border border-line-strong bg-surface px-3 text-body text-fg shadow-xs placeholder:text-fg-subtle hover:border-fg-muted focus:border-focus focus:outline-none focus:ring-1 focus:ring-focus disabled:bg-surface-sunken disabled:text-fg-subtle aria-[invalid=true]:border-critical';

export function Field({ label, hint, error, optional, children, className }: { label: string; hint?: ReactNode; error?: string | null; optional?: boolean; children: ReactNode; className?: string }) {
  return (
    <label className={cx('block', className)}>
      <span className="mb-1.5 block text-label text-fg">
        {label}{optional && <span className="ml-1 font-medium text-fg-subtle">(optional)</span>}
      </span>
      {children}
      {error ? (
        <span role="alert" className="mt-1.5 flex items-center gap-1 text-caption text-critical-fg"><CircleAlert size={16} aria-hidden />{error}</span>
      ) : hint ? <span className="mt-1.5 block text-caption text-fg-subtle">{hint}</span> : null}
    </label>
  );
}
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...p }, ref) => (
  <input ref={ref} className={cx(control, 'h-11', className)} {...p} />
));
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...p }, ref) => (
  <textarea ref={ref} rows={3} className={cx(control, 'min-h-[88px] py-2.5', className)} {...p} />
));
export function Select({ className, children, ...p }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <span className={cx('relative block', className)}>
      <select className={cx(control, 'h-11 appearance-none pr-10')} {...p}>{children}</select>
      <ChevronDown size={18} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-fg-subtle" aria-hidden />
    </span>
  );
}
/** Native-select options from an enum label map. */
export const options = (m: Record<string, { label: string }>) =>
  Object.entries(m).map(([k, v]) => <option key={k} value={k}>{v.label}</option>);

/* ── Surfaces ──────────────────────────────────────────────────────── */
export function Card({ title, description, actions, children, className, bodyClass, as: Tag = 'section' }: { title?: ReactNode; description?: ReactNode; actions?: ReactNode; children?: ReactNode; className?: string; bodyClass?: string; as?: 'section' | 'div' | 'article' }) {
  return (
    <Tag className={cx('rounded-card bg-surface shadow-card dark:border dark:border-line', className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5 sm:px-6 sm:pt-6">
          <div className="min-w-0">
            {title && <h2 className="text-h3">{title}</h2>}
            {description && <p className="mt-0.5 text-body-sm text-fg-muted">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cx('p-5 sm:p-6', (title || actions) && 'pt-4 sm:pt-4', bodyClass)}>{children}</div>
    </Tag>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-h1">{title}</h1>
        {description && <p className="mt-1 text-body-sm text-fg-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
    </div>
  );
}

export function StatCard({ label, value, icon: Icon, context, progress, to }: { label: string; value: ReactNode; icon: LucideIcon; context?: ReactNode; progress?: number; to?: string }) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span className="text-body-sm text-fg-muted">{label}</span>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-status-neutral-bg text-status-neutral-fg"><Icon size={20} strokeWidth={1.75} aria-hidden /></span>
      </div>
      <div className="mt-2 text-numeric-xl tabular-nums text-fg-heading">{value}</div>
      {progress !== undefined && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-xs bg-slate-200 dark:bg-line" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
          <div className="h-full bg-brand" style={{ width: `${Math.min(100, progress)}%` }} />
        </div>
      )}
      {context && <div className="mt-2 text-caption text-fg-subtle">{context}</div>}
    </>
  );
  const cls = 'block rounded-card bg-surface p-5 shadow-card dark:border dark:border-line';
  return to ? <Link to={to} className={cx(cls, 'transition-shadow duration-fast hover:shadow-raised')}>{body}</Link> : <div className={cls}>{body}</div>;
}

/* ── Status & badges ───────────────────────────────────────────────── */
const TONE: Record<Tone, [string, string, string]> = {
  success: ['bg-status-success-bg text-status-success-fg', 'bg-status-success-dot', 'text-status-success-dot'],
  warning: ['bg-status-warning-bg text-status-warning-fg', 'bg-status-warning-dot', 'text-status-warning-dot'],
  danger: ['bg-status-danger-bg text-status-danger-fg', 'bg-status-danger-dot', 'text-status-danger-dot'],
  info: ['bg-status-info-bg text-status-info-fg', 'bg-status-info-dot', 'text-status-info-dot'],
  neutral: ['bg-status-neutral-bg text-status-neutral-fg', 'bg-status-neutral-dot', 'text-status-neutral-dot'],
  gold: ['bg-status-gold-bg text-status-gold-fg', 'bg-status-gold-dot', 'text-status-gold-dot'],
};
export const toneBg = (t: Tone) => TONE[t][0];

export function StatusChip({ spec, withIcon, big }: { spec: Spec; withIcon?: boolean; big?: boolean }) {
  const Icon = spec.icon;
  const [chip, dot, ico] = TONE[spec.tone];
  return (
    <span className={cx('inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full font-semibold', big ? 'h-8 px-3 text-[16px]' : 'h-6 px-2.5 text-caption', chip)}>
      {withIcon
        ? <Icon size={big ? 18 : 14} strokeWidth={1.75} aria-hidden className={ico} />
        : <span aria-hidden className={cx('h-1.5 w-1.5 rounded-full', dot, spec.pulse && 'animate-dot-pulse')} />}
      {spec.label}
    </span>
  );
}

type BadgeVariant = 'soft' | 'outline' | 'count' | 'count-alert' | 'gold';
const BADGE: Record<BadgeVariant, string> = {
  soft: 'h-5 px-2 bg-status-neutral-bg text-status-neutral-fg text-caption',
  outline: 'h-5 px-2 border border-line-strong text-fg-muted text-caption tabular-nums',
  count: 'min-w-[18px] h-[18px] px-1 bg-navy-900 text-white text-[11px] font-bold tabular-nums dark:bg-navy-200 dark:text-navy-950',
  'count-alert': 'min-w-[18px] h-[18px] px-1 bg-danger-600 text-white text-[11px] font-bold tabular-nums',
  gold: 'h-6 px-2.5 bg-navy-900 text-gold-500 ring-1 ring-gold-500 text-caption',
};
export function Badge({ variant = 'soft', icon: Icon, children, className }: { variant?: BadgeVariant; icon?: LucideIcon; children: ReactNode; className?: string }) {
  return (
    <span className={cx('inline-flex shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-full font-semibold', BADGE[variant], className)}>
      {Icon && <Icon size={14} strokeWidth={1.75} aria-hidden />}{children}
    </span>
  );
}

const TINTS = [
  'bg-navy-50 text-navy-800', 'bg-emerald-50 text-emerald-800', 'bg-gold-100 text-gold-800',
  'bg-slate-100 text-slate-700', 'bg-info-50 text-info-800', 'bg-warning-50 text-warning-800',
];
export function Avatar({ name, seed, size = 40, icon: Icon }: { name: string; seed?: string; size?: number; icon?: LucideIcon }) {
  const s = seed ?? name;
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  const words = name.trim().split(/\s+/);
  const initials = ((words[0]?.[0] ?? '') + (words.length > 1 ? words[words.length - 1][0] : '')).toUpperCase();
  return (
    <span aria-hidden className={cx('inline-flex shrink-0 items-center justify-center rounded-full font-semibold', Icon ? 'bg-status-neutral-bg text-status-neutral-fg' : TINTS[h % TINTS.length])} style={{ width: size, height: size, fontSize: size * 0.4 }}>
      {Icon ? <Icon size={size * 0.5} strokeWidth={1.75} /> : initials}
    </span>
  );
}

/* ── Modal (native <dialog>: focus trap, Esc, inert background for free) ── */
export function Modal({ open, onClose, title, children, footer, size = 'sm', dismissible = true, hideClose }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; size?: 'sm' | 'md' | 'lg'; dismissible?: boolean; hideClose?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  const w = size === 'lg' ? 'sm:w-[880px]' : size === 'md' ? 'sm:w-[640px]' : 'sm:w-[480px]';
  return (
    <dialog
      ref={ref}
      className="gk-modal"
      aria-labelledby={id}
      onCancel={(e) => { e.preventDefault(); if (dismissible) onClose(); }}
      onClick={(e) => { if (e.target === ref.current && dismissible) onClose(); }}
    >
      {open && (
        <div className={cx('flex max-h-[92dvh] w-full flex-col rounded-t-sheet bg-surface-raised text-fg shadow-overlay sm:max-w-[calc(100vw-32px)] sm:rounded-[16px] dark:border dark:border-line', w)}>
          <div className="flex items-start justify-between gap-4 px-6 pb-2 pt-5">
            <h2 id={id} className="text-h2">{title}</h2>
            {!hideClose && dismissible && <IconButton label="Close" icon={X} onClick={onClose} className="-mr-2 -mt-1" />}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-2">{children}</div>
          {footer && <div className="flex flex-wrap justify-end gap-3 border-t border-line px-6 py-4 pb-[max(16px,env(safe-area-inset-bottom))]">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}

export function ConfirmModal({ open, title, body, confirmLabel, onConfirm, onClose, loading, danger = true }: { open: boolean; title: string; body: ReactNode; confirmLabel: string; onConfirm: () => void; onClose: () => void; loading?: boolean; danger?: boolean }) {
  return (
    <Modal open={open} onClose={onClose} title={title} footer={
      <>
        <Button variant="outline" onClick={onClose} autoFocus>Cancel</Button>
        <Button variant={danger ? 'danger' : 'primary'} loading={loading} onClick={onConfirm}>{confirmLabel}</Button>
      </>
    }>
      <p className="text-body text-fg-muted">{body}</p>
    </Modal>
  );
}

/* ── Toasts ────────────────────────────────────────────────────────── */
type ToastTone = 'success' | 'info' | 'warning' | 'danger';
type ToastItem = { id: number; msg: string; tone: ToastTone; title?: string };
const ToastCtx = createContext<(msg: string, tone?: ToastTone, title?: string) => void>(() => {});
export const useToast = () => useContext(ToastCtx);
const TOAST_ICON: Record<ToastTone, LucideIcon> = { success: Check, info: Info, warning: CircleAlert, danger: CircleX };
const TOAST_BAR: Record<ToastTone, string> = { success: 'bg-status-success-dot', info: 'bg-status-info-dot', warning: 'bg-status-warning-dot', danger: 'bg-status-danger-dot' };

export function ToastProvider({ children }: { children: ReactNode }) {
  const [list, setList] = useState<ToastItem[]>([]);
  const dismiss = useCallback((id: number) => setList((l) => l.filter((t) => t.id !== id)), []);
  const push = useCallback((msg: string, tone: ToastTone = 'success', title?: string) => {
    const id = Date.now() + Math.random();
    setList((l) => [...l.slice(-2), { id, msg, tone, title }]);
    setTimeout(() => dismiss(id), 5000);
  }, [dismiss]);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-4 bottom-20 z-toast flex flex-col items-center gap-2 sm:inset-x-auto sm:bottom-6 sm:right-6 sm:items-end lg:bottom-6">
        {list.map((t) => {
          const Icon = TOAST_ICON[t.tone];
          return (
            <div key={t.id} className="pointer-events-auto flex w-full max-w-[420px] animate-rise overflow-hidden rounded-card bg-surface-raised shadow-overlay dark:border dark:border-line">
              <span aria-hidden className={cx('w-1 shrink-0', TOAST_BAR[t.tone])} />
              <div className="flex flex-1 items-start gap-3 p-4">
                <Icon size={20} className={cx('mt-0.5 shrink-0', TONE[t.tone][2])} aria-hidden />
                <div className="min-w-0 flex-1 text-body-sm">
                  {t.title && <p className="font-semibold text-fg-heading">{t.title}</p>}
                  <p className="text-fg">{t.msg}</p>
                </div>
                <button type="button" onClick={() => dismiss(t.id)} aria-label="Dismiss" className="-m-2 rounded-full p-2 text-fg-subtle hover:text-fg"><X size={16} /></button>
              </div>
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}

/* ── States ────────────────────────────────────────────────────────── */
export function EmptyState({ icon: Icon, title, body, action, positive }: { icon: LucideIcon; title: string; body?: ReactNode; action?: ReactNode; positive?: boolean }) {
  return (
    <div className="mx-auto flex max-w-[360px] flex-col items-center px-4 py-10 text-center">
      <span className={cx('flex h-[72px] w-[72px] items-center justify-center rounded-full', positive ? 'bg-status-success-bg text-status-success-dot' : 'bg-status-neutral-bg text-fg-subtle')}>
        <Icon size={32} strokeWidth={1.5} aria-hidden />
      </span>
      <h3 className="mt-4 text-h3">{title}</h3>
      {body && <p className="mt-1 text-body-sm text-fg-muted">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export const Skeleton = ({ className }: { className?: string }) => <span aria-hidden className={cx('gk-skeleton block rounded-xs', className)} />;
export function SkeletonRows({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 !rounded-full" />
          <div className="flex-1 space-y-2"><Skeleton className="h-3.5 w-2/5" /><Skeleton className="h-3 w-1/4" /></div>
          <Skeleton className="h-6 w-20 !rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function ErrorBanner({ error, retry }: { error: ApiError | Error; retry?: () => void }) {
  const status = (error as ApiError).status;
  const msg = status === 403
    ? "You don't have access to this in your society. Ask the society admin if you need it."
    : error.message || "Couldn't load this. Check your connection and try again.";
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 rounded-card bg-status-danger-bg px-4 py-3 text-body-sm text-status-danger-fg">
      <CircleAlert size={20} aria-hidden className="shrink-0" />
      <span className="flex-1">{msg}</span>
      {retry && status !== 403 && <Button size="sm" variant="outline" icon={RotateCw} onClick={retry}>Retry</Button>}
    </div>
  );
}

/** Loading → skeleton, error → banner with retry, empty → empty state, else render. */
export function Async<T>({ q, children, empty, isEmpty, skeleton }: { q: UseQueryResult<T, ApiError>; children: (d: T) => ReactNode; empty?: ReactNode; isEmpty?: (d: T) => boolean; skeleton?: ReactNode }) {
  if (q.isPending) return <div aria-busy="true">{skeleton ?? <SkeletonRows />}<span className="sr-only">Loading</span></div>;
  if (q.isError) return <ErrorBanner error={q.error} retry={() => q.refetch()} />;
  const blank = isEmpty ? isEmpty(q.data) : (q.data as { items?: unknown[] })?.items?.length === 0;
  if (blank && empty) return <>{empty}</>;
  return <>{children(q.data)}</>;
}

/* ── Tabs ──────────────────────────────────────────────────────────── */
export function Tabs<T extends string>({ tabs, value, onChange, className }: { tabs: { id: T; label: string; count?: number }[]; value: T; onChange: (v: T) => void; className?: string }) {
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = tabs.findIndex((t) => t.id === value);
    const next = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : null;
    if (next === null) return;
    e.preventDefault();
    const t = tabs[(next + tabs.length) % tabs.length];
    onChange(t.id);
    (e.currentTarget.querySelector(`[data-tab="${t.id}"]`) as HTMLElement | null)?.focus();
  };
  return (
    <div role="tablist" onKeyDown={onKey} className={cx('-mx-4 mb-6 flex gap-1 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0', className)}>
      {tabs.map((t) => {
        const active = t.id === value;
        return (
          <button key={t.id} data-tab={t.id} role="tab" type="button" aria-selected={active} tabIndex={active ? 0 : -1} onClick={() => onChange(t.id)}
            className={cx('relative inline-flex h-11 shrink-0 items-center gap-2 px-3 text-label transition-colors duration-fast', active ? 'text-fg-heading' : 'text-fg-muted hover:text-fg')}>
            {t.label}
            {!!t.count && <Badge variant="count">{t.count}</Badge>}
            <span aria-hidden className={cx('absolute inset-x-2 -bottom-px h-0.5 rounded-full transition-colors duration-base', active ? 'bg-brand' : 'bg-transparent')} />
          </button>
        );
      })}
    </div>
  );
}

/* ── Table ─────────────────────────────────────────────────────────── */
export function Table({ caption, head, children, right = [] }: { caption: string; head: string[]; children: ReactNode; right?: number[] }) {
  return (
    <div className="overflow-hidden rounded-card bg-surface shadow-card dark:border dark:border-line">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-left text-body-sm">
          <caption className="sr-only">{caption}</caption>
          <thead className="bg-surface-sunken">
            <tr>{head.map((h, i) => <th key={h + i} scope="col" className={cx('whitespace-nowrap px-4 py-3 text-caption font-semibold text-fg-muted', right.includes(i) && 'text-right')}>{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-line">{children}</tbody>
        </table>
      </div>
    </div>
  );
}
export const td = 'px-4 py-3 align-middle';
export const tr = 'transition-colors duration-fast hover:bg-surface-sunken dark:hover:bg-surface-raised';

/** Name + secondary line identity cell. */
export function Who({ name, sub, seed, icon }: { name: string; sub?: ReactNode; seed?: string; icon?: LucideIcon }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar name={name} seed={seed} size={32} icon={icon} />
      <div className="min-w-0">
        <div className="truncate font-semibold text-fg">{name}</div>
        {sub && <div className="truncate text-caption text-fg-subtle">{sub}</div>}
      </div>
    </div>
  );
}
