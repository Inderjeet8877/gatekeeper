import { cx } from './ui';

/** Shield + G + keyhole mark (docs/09 §1.4). Hairline dropped below 24px. */
export function LogoMark({ size = 32, title }: { size?: number; title?: string }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} role={title ? 'img' : undefined} aria-hidden={title ? undefined : true} className="shrink-0">
      {title && <title>{title}</title>}
      <path d="M24 3 41 9v13c0 11-7.5 19.5-17 23C14.5 41.5 7 33 7 22V9Z" fill="#0B1B3F" stroke="#13285A" strokeWidth="1" />
      {size >= 24 && (
        <path d="M24 6.2 38.2 11.2V22c0 9.4-6.1 16.6-14.2 19.8C15.9 38.6 9.8 31.4 9.8 22V11.2Z" fill="none" stroke="#C8A04A" strokeWidth=".75" />
      )}
      <path d="M30.9 17.2A9 9 0 1 0 33 23h-4.4" fill="none" stroke="#FBFAF7" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M22.9 23.7A2.2 2.2 0 1 1 25.1 23.7L25.7 27.6H22.3Z" fill="#C8A04A" />
    </svg>
  );
}

/** Lockup: mark + live Fraunces wordmark. `reversed` for navy backgrounds. */
export function Logo({ size = 32, reversed, className }: { size?: number; reversed?: boolean; className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-2.5', className)}>
      <LogoMark size={size} />
      <span className={cx('font-display text-[22px] font-semibold tracking-tight', reversed ? 'text-paper' : 'text-navy-900 dark:text-white')}>Gatekeeper</span>
    </span>
  );
}

/** The Threshold: a gold hairline with a keyhole notch. `open` parts the halves (approval moment). */
export function Threshold({ className, open }: { className?: string; open?: boolean }) {
  const half = 'h-px flex-1 bg-accent-gold transition-transform duration-slow ease-decelerate';
  return (
    <div aria-hidden className={cx('flex items-center', className)}>
      <span className={cx(half, open && '-translate-x-2')} />
      <svg width="14" height="14" viewBox="0 0 14 14" className="mx-1.5 shrink-0 text-accent-gold">
        <path d="M7 .8 13.2 7 7 13.2.8 7Z" fill="none" stroke="currentColor" strokeWidth=".9" />
        <circle cx="7" cy="6" r="1.5" fill="currentColor" />
        <path d="M6.3 6.8h1.4l.4 2.8H5.9Z" fill="currentColor" />
      </svg>
      <span className={cx(half, open && 'translate-x-2')} />
    </div>
  );
}
