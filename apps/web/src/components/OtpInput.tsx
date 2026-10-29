import { useState } from 'react';
import { cx } from './ui';

/** One real input (paste, SMS autofill, screen readers) drives six visual boxes. */
export function OtpInput({ value, onChange, onComplete, invalid, disabled }: {
  value: string; onChange: (v: string) => void; onComplete?: (v: string) => void; invalid?: boolean; disabled?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div className="relative">
      <input
        aria-label="6-digit verification code"
        aria-invalid={invalid || undefined}
        autoComplete="one-time-code"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={6}
        autoFocus
        disabled={disabled}
        value={value}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) => {
          const v = e.target.value.replace(/\D/g, '').slice(0, 6);
          onChange(v);
          if (v.length === 6) onComplete?.(v);
        }}
        className="absolute inset-0 z-10 h-full w-full cursor-text bg-transparent text-transparent caret-transparent outline-none selection:bg-transparent"
      />
      <div aria-hidden className="grid grid-cols-6 gap-2">
        {Array.from({ length: 6 }, (_, i) => {
          const active = focused && (i === value.length || (i === 5 && value.length === 6));
          return (
            <div key={i} className={cx(
              'flex h-14 items-center justify-center rounded-control border bg-surface text-[28px] font-semibold tabular-nums text-fg-heading transition-colors duration-fast',
              invalid ? 'border-2 border-critical' : active ? 'border-2 border-focus' : 'border-line-strong',
            )}>
              {value[i] ?? (active ? <span className="h-7 w-px animate-dot-pulse bg-fg" /> : '')}
            </div>
          );
        })}
      </div>
    </div>
  );
}
