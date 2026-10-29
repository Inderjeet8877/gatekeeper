import { useEffect, useRef, useState } from 'react';
import { Delete, KeyRound } from 'lucide-react';
import { Button, cx } from './ui';

/** Guard passcode keypad: 6 readable slots, 3×4 keys, hardware keyboard, auto-verify 250 ms after the 6th digit. */
export function Keypad({ onSubmit, busy, disabled }: { onSubmit: (code: string) => void; busy?: boolean; disabled?: boolean }) {
  const [code, setCode] = useState('');
  const submitted = useRef('');
  const submit = useRef(onSubmit);
  submit.current = onSubmit;

  const press = (k: string) => {
    if (disabled || busy) return;
    setCode((c) => (k === 'clear' ? '' : k === 'back' ? c.slice(0, -1) : (c + k).slice(0, 6)));
  };

  useEffect(() => {
    if (code.length < 6) { submitted.current = ''; return; }
    if (submitted.current === code) return;
    const t = setTimeout(() => { submitted.current = code; submit.current(code); }, 250);
    return () => clearTimeout(t);
  }, [code]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') press('back');
      else if (e.key === 'Escape') press('clear');
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const key = 'flex h-20 items-center justify-center rounded-card border border-line-strong bg-surface text-[36px] font-bold tabular-nums text-fg-heading transition-transform duration-instant hover:bg-surface-sunken active:scale-[.97] active:bg-surface-sunken disabled:opacity-40';
  return (
    <div className="mx-auto w-full max-w-[480px]">
      <div className="grid grid-cols-6 gap-2" aria-live="polite" aria-label={`Passcode entered: ${code.split('').join(' ') || 'none'}`} role="status">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className={cx('flex h-20 items-center justify-center rounded-card border-2 bg-surface text-guard-xl tabular-nums text-fg-heading', i === code.length ? 'border-focus' : 'border-line-strong')}>
            {code[i] ?? ''}
          </div>
        ))}
      </div>
      <div className="mt-6 grid grid-cols-3 gap-3">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button key={d} type="button" className={key} onClick={() => press(d)} disabled={disabled}>{d}</button>
        ))}
        <button type="button" className={cx(key, '!text-guard-body')} onClick={() => press('clear')} disabled={disabled}>Clear</button>
        <button type="button" className={key} onClick={() => press('0')} disabled={disabled}>0</button>
        <button type="button" className={key} onClick={() => press('back')} aria-label="Backspace" disabled={disabled}><Delete size={32} strokeWidth={2} /></button>
      </div>
      <Button size="xl" full className="mt-4" icon={KeyRound} loading={busy} disabled={code.length < 6 || disabled} onClick={() => onSubmit(code)}>
        {busy ? 'Verifying…' : 'Verify'}
      </Button>
    </div>
  );
}
