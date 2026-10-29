import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Minus } from 'lucide-react';
import { Badge, btnClass, cx } from '../components/ui';
import { Container } from './MarketingLayout';

// Illustrative tiers only — prices to be confirmed with the business before launch.
export const TIERS = [
  { id: 'essential', name: 'Essential', price: 2, unit: 'per flat / month', blurb: 'The gate, done properly.', cta: 'Start with Essential', to: '/contact',
    points: ['Visitor approvals and passcodes', 'Daily help attendance', 'Notices and SOS alerts', 'Guard console for any tablet'] },
  { id: 'professional', name: 'Professional', price: 4, unit: 'per flat / month', blurb: 'Everything a committee runs.', cta: 'Book a demo', to: '/contact', featured: true,
    points: ['Everything in Essential', 'Maintenance billing and online dues', 'Helpdesk, polls and amenity booking', 'Expenses and collection dashboard'] },
  { id: 'enterprise', name: 'Enterprise', price: null, unit: 'for townships and managers', blurb: 'Many societies, one view.', cta: 'Talk to us', to: '/contact',
    points: ['Everything in Professional', 'Multiple societies per account', 'Onboarding for every tower', 'Priority support and review calls'] },
] as const;

export function TierCards({ yearly = false }: { yearly?: boolean }) {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {TIERS.map((t) => {
        const featured = 'featured' in t && t.featured;
        const price = t.price === null ? null : yearly ? +(t.price * 0.85).toFixed(2) : t.price;
        return (
          <article key={t.id} className={cx('flex flex-col rounded-panel p-8', featured ? 'bg-navy-900 text-paper shadow-overlay' : 'bg-white shadow-card')}>
            <div className="flex items-center justify-between gap-3">
              <h3 className={cx('font-display text-[1.75rem] font-semibold', featured ? '!text-paper' : '')}>{t.name}</h3>
              {featured && <Badge variant="gold">Recommended</Badge>}
            </div>
            <p className={cx('mt-1 text-body', featured ? 'text-navy-200' : 'text-slate-600')}>{t.blurb}</p>
            <p className="mt-6 flex items-baseline gap-2">
              <span className={cx('font-display text-display-md tabular-nums', featured ? 'text-paper' : 'text-navy-900')}>{price === null ? 'Custom' : `₹${price}`}</span>
              <span className={cx('text-body-sm', featured ? 'text-navy-200' : 'text-slate-600')}>{t.unit}</span>
            </p>
            <ul className="mt-6 flex-1 space-y-3">
              {t.points.map((p) => (
                <li key={p} className="flex gap-3 text-body-sm">
                  <Check size={18} className={cx('mt-0.5 shrink-0', featured ? 'text-gold-500' : 'text-emerald-600')} aria-hidden />{p}
                </li>
              ))}
            </ul>
            <Link to={t.to} className={cx(btnClass(featured ? 'primary' : 'outline', 'lg', true), 'mt-8')}>{t.cta}</Link>
          </article>
        );
      })}
    </div>
  );
}

const ROWS: [string, boolean | string, boolean | string, boolean | string][] = [
  ['Visitor approvals, passcodes, gate console', true, true, true],
  ['Daily help attendance', true, true, true],
  ['Notices and SOS alerts', true, true, true],
  ['Polls and helpdesk', false, true, true],
  ['Amenity booking', false, true, true],
  ['Maintenance billing and dues collection', false, true, true],
  ['Expenses and committee dashboard', false, true, true],
  ['Multiple societies', false, false, true],
  ['Support', 'Email', 'Email and phone', 'Named manager'],
];

export default function Pricing() {
  const [yearly, setYearly] = useState(false);
  return (
    <>
      <Container className="py-16 md:py-24">
        <div className="max-w-2xl">
          <h1 className="font-display text-[2.5rem] font-medium leading-tight tracking-[-0.02em] md:text-display-xl">Priced per flat, so it scales with your society.</h1>
          <p className="mt-4 text-body-lg text-slate-600">No setup fee and no charge for guards or committee members. Every resident in a flat is included.</p>
        </div>
        <div role="radiogroup" aria-label="Billing period" className="mt-10 inline-flex rounded-control bg-slate-100 p-1">
          {[[false, 'Monthly'], [true, 'Yearly · save 15%']].map(([v, l]) => (
            <button key={String(v)} type="button" role="radio" aria-checked={yearly === v} onClick={() => setYearly(v as boolean)}
              className={cx('h-10 rounded-[8px] px-4 text-label', yearly === v ? 'bg-white text-navy-900 shadow-xs' : 'text-slate-600')}>{l as string}</button>
          ))}
        </div>
        <div className="mt-8"><TierCards yearly={yearly} /></div>
      </Container>

      <Container className="pb-16 md:pb-24">
        <h2 className="font-display text-display-md">Compare plans</h2>
        <div className="mt-6 overflow-x-auto rounded-card bg-white shadow-card">
          <table className="w-full min-w-[640px] text-left text-body-sm">
            <caption className="sr-only">Plan comparison</caption>
            <thead className="bg-slate-50"><tr><th scope="col" className="px-5 py-4 font-semibold text-slate-600">Feature</th>{TIERS.map((t) => <th key={t.id} scope="col" className="px-5 py-4 font-semibold text-navy-900">{t.name}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-200">
              {ROWS.map(([f, ...vals]) => (
                <tr key={f}>
                  <th scope="row" className="px-5 py-4 font-medium text-ink-900">{f}</th>
                  {vals.map((v, i) => (
                    <td key={i} className="px-5 py-4">
                      {v === true ? <Check size={18} className="text-emerald-600" aria-label="Included" /> : v === false ? <Minus size={18} className="text-slate-400" aria-label="Not included" /> : v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2 className="mt-16 font-display text-display-md">Billing questions</h2>
        <div className="mt-6 max-w-3xl divide-y divide-slate-200 border-y border-slate-200">
          {[
            ['Who pays — the society or each resident?', 'The society pays one invoice for all its flats. How the cost is recovered from residents is up to the committee.'],
            ['Do vacant flats count?', 'You pay for flats that have at least one resident signed in during the month.'],
            ['Can we switch plans later?', 'Yes. Upgrades apply immediately; downgrades apply from the next billing month.'],
            ['Is there a contract?', 'Monthly plans can be cancelled with 30 days notice. Yearly plans are paid upfront at the discounted rate.'],
          ].map(([q, a]) => (
            <details key={q} className="group py-5">
              <summary className="flex items-center justify-between gap-4 text-h4 text-navy-900">{q}<span aria-hidden className="text-h3 text-slate-500 transition-transform group-open:rotate-45">+</span></summary>
              <p className="mt-3 max-w-prose text-body text-slate-600">{a}</p>
            </details>
          ))}
        </div>
      </Container>
    </>
  );
}
