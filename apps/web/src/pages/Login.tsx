import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, CircleAlert } from 'lucide-react';
import { ApiError, post } from '../lib/api';
import { cleanPhone, formatPhone } from '../lib/format';
import type { AuthResponse } from '../lib/types';
import { useAuth } from '../auth/AuthContext';
import { Button, Field, Input } from '../components/ui';
import { Logo, LogoMark, Threshold } from '../components/Logo';
import { OtpInput } from '../components/OtpInput';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from;
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [needName, setNeedName] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [wrong, setWrong] = useState(0);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const digits = cleanPhone(phone);

  const requestCode = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!/^\d{10,15}$/.test(digits)) { setError('Enter a 10-digit mobile number.'); return; }
    setBusy(true); setError(null);
    try {
      const r = await post<{ sent: boolean; devCode?: string }>('/auth/otp/request', { phone: digits });
      setDevCode(r.devCode ?? null);
      setStep('otp'); setCode(''); setWrong(0); setResendIn(30);
    } catch (err) {
      const a = err as ApiError;
      setError(a.code === 'RATE_LIMITED' ? 'Too many requests. Try again in 10 minutes.' : a.message);
    } finally { setBusy(false); }
  };

  const verify = async (c = code) => {
    if (c.length !== 6) return;
    if (needName && !name.trim()) { setError('Tell us your name to finish creating your account.'); return; }
    setBusy(true); setError(null);
    try {
      const r = await post<AuthResponse>('/auth/otp/verify', { phone: digits, code: c, ...(needName ? { name: name.trim() } : {}) });
      login(r);
      navigate(from && from.startsWith('/app') ? from : '/app', { replace: true });
    } catch (err) {
      const a = err as ApiError;
      if (a.code === 'NAME_REQUIRED') { setNeedName(true); setError(null); }
      else if (a.code === 'OTP_INVALID') {
        const n = wrong + 1; setWrong(n); setCode('');
        setError(`That code isn't right. ${Math.max(0, 5 - n)} attempts left.`);
      } else if (a.code === 'OTP_EXPIRED') { setCode(''); setError('This code expired. Request a new one.'); }
      else if (a.code === 'OTP_TOO_MANY_ATTEMPTS') { setCode(''); setError('Too many attempts. Request a new code.'); }
      else setError(a.message);
    } finally { setBusy(false); }
  };

  return (
    <div className="grid min-h-dvh bg-paper lg:grid-cols-2">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-navy-950 p-12 text-paper lg:flex">
        <div aria-hidden className="gk-siteplan absolute inset-0 opacity-60" />
        <Link to="/" className="relative self-start"><Logo reversed /></Link>
        <div className="relative max-w-md">
          <LogoMark size={64} />
          <p className="mt-8 font-display text-display-lg text-paper">Every arrival, accounted for.</p>
          <Threshold className="mt-8 max-w-xs" />
          <p className="mt-6 text-body-lg text-navy-200">Sign in with your phone. No passwords to remember, and every entry stays on record.</p>
        </div>
        <p className="relative text-caption text-navy-300">© 2026 Gatekeeper</p>
      </aside>

      <main className="flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-[420px]">
          <div className="mb-8 lg:hidden"><Link to="/"><Logo /></Link></div>
          {step === 'phone' ? (
            <form onSubmit={requestCode} noValidate>
              <h1 className="font-display text-display-md">Sign in</h1>
              <p className="mt-2 text-body text-slate-600">We'll text a 6-digit code to your mobile number.</p>
              <Field label="Mobile number" error={error} className="mt-8">
                <div className="flex">
                  <span className="inline-flex h-[52px] items-center rounded-l-control border border-r-0 border-slate-450 bg-slate-50 px-3 text-body text-slate-600">+91</span>
                  <Input type="tel" inputMode="numeric" autoComplete="tel-national" autoFocus placeholder="98765 43210"
                    className="!h-[52px] rounded-l-none tabular-nums" value={phone} aria-invalid={!!error}
                    onChange={(e) => { setPhone(e.target.value.replace(/[^\d\s+-]/g, '')); setError(null); }} />
                </div>
              </Field>
              <Button type="submit" size="lg" full className="mt-6" loading={busy}>Send code</Button>
              <p className="mt-6 text-body-sm text-slate-600">New to Gatekeeper? Sign in with your number and you can create your society next.</p>
            </form>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); verify(); }} noValidate>
              <button type="button" onClick={() => { setStep('phone'); setNeedName(false); setError(null); }} className="-ml-2 mb-6 inline-flex h-11 items-center gap-1 rounded-control px-2 text-label text-slate-600 hover:text-ink-900">
                <ArrowLeft size={18} aria-hidden /> Change number
              </button>
              <h1 className="font-display text-display-md">Enter the code</h1>
              <p className="mt-2 text-body text-slate-600">We sent a 6-digit code to <span className="font-semibold tabular-nums text-ink-900">{formatPhone(digits)}</span>.</p>
              <Threshold className="my-8" />
              {devCode && (
                <p className="mb-4 rounded-control border border-dashed border-gold-500 bg-gold-50 px-3 py-2 text-body-sm text-gold-800">
                  Dev code: <span className="font-semibold tabular-nums tracking-wider">{devCode}</span>
                </p>
              )}
              <OtpInput value={code} onChange={(v) => { setCode(v); setError(null); }} onComplete={(v) => !needName && verify(v)} invalid={!!error && !needName} disabled={busy} />
              <div aria-live="assertive">
                {error && <p className="mt-3 flex items-center gap-1.5 text-body-sm text-danger-700"><CircleAlert size={16} aria-hidden />{error}</p>}
              </div>
              {needName && (
                <Field label="What should we call you?" hint="This is how guards and your neighbours will see you." className="mt-6">
                  <Input autoFocus autoComplete="name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
                </Field>
              )}
              <Button type="submit" size="lg" full className="mt-6" loading={busy} disabled={code.length !== 6}>{needName ? 'Create account' : 'Verify'}</Button>
              <p className="mt-4 text-body-sm tabular-nums text-slate-600">
                {resendIn > 0 ? `Resend code in 0:${String(resendIn).padStart(2, '0')}` : (
                  <Button variant="link" onClick={() => requestCode()}>Resend code</Button>
                )}
              </p>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
