import { useState, type FormEvent } from 'react';
import { Check, Clock, Mail, Phone } from 'lucide-react';
import { Button, Field, Input, Select, Textarea } from '../components/ui';
import { Container } from './MarketingLayout';

export default function Contact() {
  const [f, setF] = useState({ name: '', phone: '', society: '', city: '', flats: '', message: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sent, setSent] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  // ponytail: no lead endpoint in the v1 API — the form validates and confirms locally. Wire to a CRM/webhook when one exists.
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!f.name.trim()) errs.name = 'Enter your name.';
    if (!/^\d{10}$/.test(f.phone.replace(/\D/g, '').slice(-10))) errs.phone = 'Enter a 10-digit mobile number.';
    if (!f.society.trim()) errs.society = 'Enter your society name.';
    if (!f.city.trim()) errs.city = 'Enter your city.';
    setErrors(errs);
    if (!Object.keys(errs).length) setSent(true);
  };

  return (
    <Container className="grid gap-12 py-16 md:py-24 lg:grid-cols-12">
      <div className="lg:col-span-7">
        <h1 className="font-display text-[2.5rem] font-medium leading-tight tracking-[-0.02em] md:text-display-xl">Book a demo</h1>
        <p className="mt-4 max-w-xl text-body-lg text-slate-600">Tell us about your society. We'll walk your committee through Gatekeeper using your own blocks and flats.</p>
        {sent ? (
          <div role="status" className="mt-10 rounded-card bg-emerald-50 p-6 text-emerald-800">
            <p className="flex items-center gap-2 text-h3 !text-emerald-800"><Check size={22} aria-hidden />Thanks, {f.name.split(' ')[0]}.</p>
            <p className="mt-2 text-body">We'll call you within one working day to set up a time.</p>
          </div>
        ) : (
          <form onSubmit={submit} noValidate className="mt-10 grid gap-5 sm:grid-cols-2">
            <Field label="Your name" error={errors.name}><Input value={f.name} onChange={set('name')} autoComplete="name" aria-invalid={!!errors.name} /></Field>
            <Field label="Mobile number" error={errors.phone}><Input type="tel" inputMode="numeric" value={f.phone} onChange={set('phone')} autoComplete="tel-national" aria-invalid={!!errors.phone} /></Field>
            <Field label="Society name" error={errors.society}><Input value={f.society} onChange={set('society')} aria-invalid={!!errors.society} /></Field>
            <Field label="City" error={errors.city}><Input value={f.city} onChange={set('city')} autoComplete="address-level2" aria-invalid={!!errors.city} /></Field>
            <Field label="Number of flats" optional className="sm:col-span-2">
              <Select value={f.flats} onChange={set('flats')}>
                <option value="">Choose a range</option><option>Up to 100</option><option>100–300</option><option>300–1,000</option><option>More than 1,000</option>
              </Select>
            </Field>
            <Field label="Anything we should know?" optional className="sm:col-span-2"><Textarea value={f.message} onChange={set('message')} maxLength={1000} /></Field>
            <div className="sm:col-span-2"><Button type="submit" size="lg">Request a demo</Button></div>
          </form>
        )}
      </div>
      <aside className="space-y-6 rounded-panel bg-navy-900 p-8 text-navy-200 lg:col-span-5 lg:self-start">
        <p className="font-display text-[1.75rem] text-paper">Talk to a person</p>
        <p className="flex gap-3"><Mail size={20} className="mt-0.5 text-gold-500" aria-hidden /><a href="mailto:hello@gatekeeper.example" className="text-paper underline-offset-4 hover:underline">hello@gatekeeper.example</a></p>
        <p className="flex gap-3"><Phone size={20} className="mt-0.5 text-gold-500" aria-hidden /><span className="tabular-nums text-paper">+91 80 4000 0000</span></p>
        <p className="flex gap-3"><Clock size={20} className="mt-0.5 text-gold-500" aria-hidden />We reply within one working day, Monday to Saturday.</p>
      </aside>
    </Container>
  );
}
