import { Link } from 'react-router-dom';
import {
  BadgeCheck, Building, Check, ClipboardList, Fingerprint, House, KeyRound, Lock, Package, ScrollText, ShieldCheck,
  Smartphone, Timer, X,
} from 'lucide-react';
import { STATUS } from '../lib/status';
import { Badge, btnClass, cx, StatusChip } from '../components/ui';
import { LogoMark, Threshold } from '../components/Logo';
import { Container, Divider } from './MarketingLayout';
import { TierCards } from './Pricing';

/* Scripted demo entries for the hero ledger (Emerald Heights demo data). */
const LEDGER = [
  { t: '5:42 pm', who: 'Ravi', sub: 'Swiggy', flat: 'A-101', s: STATUS.visitor.LEFT_AT_GATE },
  { t: '5:38 pm', who: 'Meera Shah', sub: 'Guest', flat: 'B-201', s: STATUS.visitor.CHECKED_IN },
  { t: '5:21 pm', who: 'Uber', sub: 'KA 01 AB 4471', flat: 'A-103', s: STATUS.visitor.CHECKED_OUT },
  { t: '5:02 pm', who: 'Lakshmi', sub: 'Maid', flat: 'A-101', s: STATUS.visitor.CHECKED_IN },
  { t: '4:47 pm', who: 'Plumber', sub: 'Urban Company', flat: 'B-204', s: STATUS.visitor.APPROVED },
];

function Ledger({ rows }: { rows: number }) {
  return (
    <div className="rounded-[16px] bg-white p-5 text-ink-900 shadow-overlay sm:p-6">
      <div className="flex items-center justify-between">
        <p className="text-h4 text-navy-900">Main Gate · Today</p>
        <span className="inline-flex items-center gap-1.5 text-caption font-semibold text-emerald-700"><span className="h-2 w-2 animate-dot-pulse rounded-full bg-emerald-600" />Live</span>
      </div>
      <ol className="mt-4 divide-y divide-slate-200">
        {LEDGER.slice(0, rows).map((r, i) => (
          <li key={r.t} className="flex animate-ledger-in items-center gap-3 py-3 text-body-sm" style={{ animationDelay: `${300 + i * 60}ms` }}>
            <span className="w-14 shrink-0 tabular-nums text-slate-500">{r.t}</span>
            <span className="min-w-0 flex-1 truncate"><span className="font-semibold">{r.who}</span><span className="text-slate-600"> · {r.sub}</span></span>
            <span className="hidden tabular-nums text-slate-600 sm:inline">{r.flat}</span>
            <StatusChip spec={r.s} />
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Stylised phone showing the resident approval card. */
function PhoneMock({ className }: { className?: string }) {
  return (
    <div className={cx('w-[248px] rounded-[40px] border-[9px] border-navy-800 bg-paper p-4 shadow-overlay', className)}>
      <div className="mx-auto mb-4 h-1.5 w-16 rounded-full bg-slate-300" />
      <Threshold />
      <div className="mt-3 flex items-center justify-between text-[11px] text-slate-600">
        <span>Main Gate · Suresh</span>
        <span className="inline-flex items-center gap-1 rounded-full bg-warning-50 px-2 py-0.5 font-semibold tabular-nums text-warning-800"><span className="h-1.5 w-1.5 animate-dot-pulse rounded-full bg-warning-500" />8:41</span>
      </div>
      <div className="mt-5 flex flex-col items-center text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-700"><Package size={26} strokeWidth={1.75} /></span>
        <p className="mt-3 font-display text-[1.75rem] leading-none text-navy-900">Ravi</p>
        <p className="mt-1.5 text-[12px] text-slate-600">Delivery · Swiggy</p>
        <p className="mt-1 text-[13px] font-semibold text-navy-900">For A-101</p>
      </div>
      <div className="mt-5 space-y-2 text-[13px] font-semibold">
        <div className="flex h-10 items-center justify-center gap-1.5 rounded-control border border-slate-450 text-navy-900"><Package size={15} />Leave at gate</div>
        <div className="flex h-10 items-center justify-center gap-1.5 rounded-control border border-danger-600 text-danger-700"><X size={15} />Deny</div>
        <div className="flex h-10 items-center justify-center gap-1.5 rounded-control bg-emerald-650 text-white"><Check size={15} />Approve entry</div>
      </div>
    </div>
  );
}

/* Product shots for the role sections, drawn in HTML/CSS. */
function PassShot() {
  return (
    <div className="mx-auto w-full max-w-sm rounded-card bg-navy-950 p-6 text-paper shadow-overlay">
      <Threshold />
      <div className="mt-5 flex items-center gap-2 text-body-sm text-navy-200"><LogoMark size={24} />Emerald Heights</div>
      <p className="mt-4 text-caption text-navy-300">Guest pass</p>
      <p className="font-display text-[1.75rem]">Meera Shah</p>
      <p className="text-body-sm text-navy-200">Visiting A-101</p>
      <p className="mt-6 text-[40px] font-semibold tabular-nums tracking-[0.12em] text-gold-400">135 790</p>
      <p className="mt-2 text-body-sm text-navy-200">Valid today, 6:00 – 10:00 pm · 1 entry</p>
    </div>
  );
}
function GateShot() {
  return (
    <div className="mx-auto w-full max-w-md rounded-card bg-white p-6 shadow-overlay">
      <p className="text-h3 text-navy-900">Verify passcode</p>
      <div className="mt-4 grid grid-cols-6 gap-2">
        {'135790'.split('').map((d, i) => <div key={i} className="flex h-14 items-center justify-center rounded-control border-2 border-slate-450 text-[26px] font-bold tabular-nums text-navy-900">{d}</div>)}
      </div>
      <div className="mt-5 overflow-hidden rounded-card">
        <div className="flex items-center gap-2 bg-emerald-650 px-4 py-3 font-bold text-white"><Check size={20} />Passcode accepted</div>
        <p className="bg-emerald-50 px-4 py-3 text-body-sm text-emerald-800">Meera Shah, guest of A-101. Checked in at 6:05 pm.</p>
      </div>
    </div>
  );
}
function CommitteeShot() {
  return (
    <div className="mx-auto w-full max-w-md space-y-3">
      <div className="rounded-card bg-navy-900 p-5 text-paper shadow-overlay">
        <p className="text-body-sm text-navy-200">Collection · October 2026</p>
        <p className="mt-1 text-numeric-xl tabular-nums">78%</p>
        <div className="mt-3 h-1.5 rounded-xs bg-navy-800"><div className="h-full w-[78%] rounded-xs bg-emerald-500" /></div>
      </div>
      <div className="rounded-card bg-white p-5 shadow-card">
        {[['A-101', '₹3,500', STATUS.invoice.PAID], ['A-102', '₹3,500', STATUS.invoice.UNPAID], ['B-203', '₹3,500', STATUS.invoice.OVERDUE]].map(([f, a, s]) => (
          <div key={f as string} className="flex items-center justify-between border-b border-slate-200 py-2.5 text-body-sm last:border-0">
            <span className="font-semibold tabular-nums">{f as string}</span><span className="tabular-nums text-slate-600">{a as string}</span><StatusChip spec={s as typeof STATUS.invoice.PAID} />
          </div>
        ))}
      </div>
    </div>
  );
}

const ROLES = [
  { badge: 'Residents', icon: House, title: 'Answer the gate from wherever you are.', shot: <PassShot />,
    points: ['Approve visitors from your phone, with the name and flat in front of you', 'Invite guests with a 6-digit passcode they show at the gate', 'Pay maintenance and book the clubhouse in a few taps'] },
  { badge: 'Guards', icon: BadgeCheck, title: 'A console built for gloved hands and bright sun.', shot: <GateShot />,
    points: ['Verify a passcode in one step', 'Log walk-ins with tiles and chips, not long forms', "See who's inside at a glance, and check them out in one tap"] },
  { badge: 'Committees', icon: Building, title: 'The society accounts, kept in order.', shot: <CommitteeShot />,
    points: ['Bill every flat in one go and record cash payments', 'Track dues, collection and expenses month by month', 'Post notices, run polls and close helpdesk requests'] },
];

const FAQ = [
  ['Do guards need smartphones?', 'No. The gate console runs in the browser of any tablet or laptop at the gate. One shared device is enough for a shift.'],
  ["What if a resident doesn't respond?", 'The request expires after 10 minutes and the guard sees it straight away, with an option to call the flat. Nobody is let in by default.'],
  ['Can tenants and family members use it?', 'Yes. The admin adds each person by phone number as an owner, tenant or family member of a flat. Everyone in the flat can approve visitors.'],
  ['How are maintenance payments handled?', 'The committee generates monthly bills for every flat. Residents pay online and the admin can record cash payments. Collection updates on the dashboard immediately.'],
  ['Is our data shared with anyone?', "No. Each society's records are kept separate from every other society, and we never sell or share resident data."],
  ['How long does setup take?', 'Most societies are running within a day: create the society, add blocks and flats in one step, then add residents and guards by phone number.'],
];

export default function Home() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-navy-950 pt-[72px] text-paper">
        <div aria-hidden className="gk-siteplan absolute inset-0" />
        <Container className="relative grid min-h-[88vh] items-center gap-12 py-16 lg:grid-cols-12 lg:py-24">
          <div className="lg:col-span-6">
            <h1 className="font-display text-[2.75rem] font-medium leading-[1.04] tracking-[-0.02em] !text-paper sm:text-display-xl xl:text-display-2xl">Every arrival, accounted for.</h1>
            <p className="mt-6 max-w-[30rem] text-body-lg text-navy-200">Gatekeeper runs the gate, the helpdesk and the society accounts for gated communities — quietly, precisely, and with every entry on record.</p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <Link to="/contact" className={btnClass('primary', 'lg')}>Book a demo</Link>
              <a href="#how" className="inline-flex h-[52px] items-center justify-center rounded-control border border-paper/40 px-5 text-[16px] font-semibold text-paper transition-colors hover:bg-navy-800">See how it works</a>
            </div>
          </div>
          <div className="relative lg:col-span-6">
            <p className="sr-only">Example: the Main Gate ledger for today, and a resident's phone showing a delivery waiting for approval.</p>
            <div aria-hidden className="xl:pb-24">
              <div className="lg:hidden"><Ledger rows={3} /></div>
              <div className="ml-auto hidden max-w-[460px] lg:block xl:max-w-[372px]"><Ledger rows={5} /></div>
              <PhoneMock className="absolute bottom-0 -left-16 hidden animate-ledger-in xl:block [animation-delay:700ms]" />
            </div>
          </div>
        </Container>
        <Container className="relative pb-10"><Threshold /></Container>
      </section>

      {/* Trust strip */}
      <section aria-label="Why societies trust Gatekeeper" className="border-b border-slate-200">
        <Container className="grid grid-cols-1 gap-6 py-10 sm:grid-cols-2 lg:grid-cols-4">
          {[
            [Smartphone, 'OTP sign-in, no passwords', 'Residents and guards sign in with their phone.'],
            [Timer, 'Every entry time-stamped', 'Who came, who approved, when they left.'],
            [Lock, 'Data scoped to your society', 'Records never mix across societies.'],
            [ClipboardList, 'Works on any phone and gate tablet', 'Nothing to install at the gate.'],
          ].map(([I, t, d]) => {
            const Icon = I as typeof Lock;
            return (
              <div key={t as string} className="flex gap-3">
                <Icon size={22} className="mt-0.5 shrink-0 text-emerald-600" aria-hidden />
                <div><p className="text-h4 text-navy-900">{t as string}</p><p className="text-caption text-slate-600">{d as string}</p></div>
              </div>
            );
          })}
        </Container>
      </section>

      {/* Roles */}
      <section aria-labelledby="roles-h" className="py-20 md:py-24">
        <Container>
          <h2 id="roles-h" className="max-w-2xl font-display text-[2rem] font-medium leading-tight md:text-display-lg">One calm system for everyone at the gate.</h2>
        </Container>
        <div className="mt-16 space-y-20 md:space-y-28">
          {ROLES.map((r, i) => (
            <Container key={r.badge} className="grid items-center gap-10 lg:grid-cols-12">
              <div className={cx('lg:col-span-5', i % 2 && 'lg:order-2 lg:col-start-8')}>
                <Badge icon={r.icon}>{r.badge}</Badge>
                <h3 className="mt-4 font-display text-display-md">{r.title}</h3>
                <ul className="mt-6 space-y-3">
                  {r.points.map((p) => <li key={p} className="flex gap-3 text-body text-slate-600"><Check size={20} className="mt-0.5 shrink-0 text-emerald-600" aria-hidden />{p}</li>)}
                </ul>
              </div>
              <div aria-hidden className={cx('rounded-panel bg-slate-100 px-6 py-12 sm:px-12 lg:col-span-7', i % 2 && 'lg:order-1')}>{r.shot}</div>
            </Container>
          ))}
        </div>
      </section>

      <Divider />

      {/* How it works — a true sequence */}
      <section id="how" aria-labelledby="how-h" className="scroll-mt-24 py-20 md:py-24">
        <Container>
          <h2 id="how-h" className="font-display text-[2rem] font-medium leading-tight md:text-display-lg">How a walk-in visitor gets in</h2>
          <ol className="relative mt-12 grid gap-10 md:grid-cols-4 md:gap-6">
            <span aria-hidden className="absolute left-5 top-5 hidden h-px w-[calc(100%-40px)] bg-slate-300 md:block" />
            {[
              ['The guard logs the visitor', 'Type, flat and name, in a few taps on the gate tablet.'],
              ['The resident is notified', 'The approval card opens on every phone in that flat.'],
              ['They approve, deny or ask to leave it', 'Deliveries can wait at the gate to be collected later.'],
              ['The guard checks them in and out', 'Each step is time-stamped and kept in the visitor log.'],
            ].map(([t, d], i) => (
              <li key={t} className="relative flex gap-4 md:flex-col">
                <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-navy-900 bg-paper text-label tabular-nums text-navy-900">{i + 1}</span>
                <div><p className="text-h4 text-navy-900">{t}</p><p className="mt-1 text-body-sm text-slate-600">{d}</p></div>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      {/* Security & privacy */}
      <section aria-labelledby="sec-h" className="bg-navy-900 py-20 text-paper md:py-24">
        <Container className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <h2 id="sec-h" className="font-display text-[2rem] font-medium leading-tight !text-paper md:text-display-lg">Built to be trusted with your front door.</h2>
            <p className="mt-4 text-body-lg text-navy-200">Security is a set of small, deliberate decisions. These are ours.</p>
            <Link to="/privacy" className="mt-6 inline-block text-label text-gold-400 underline-offset-4 hover:underline">Read our privacy approach</Link>
          </div>
          <ul className="grid gap-8 sm:grid-cols-2 lg:col-span-7">
            {[
              [Fingerprint, 'Phone OTP with attempt limits', 'Codes expire in five minutes and lock after five wrong tries.'],
              [ShieldCheck, "Your society's data stays yours", 'Every record is isolated from every other society on the platform.'],
              [KeyRound, 'Numbers masked at the gate', 'Shared gate devices show only the last digits of a phone number.'],
              [ScrollText, 'A full audit trail', 'Who approved, when, and from which flat — for every single entry.'],
            ].map(([I, t, d]) => {
              const Icon = I as typeof Lock;
              return (
                <li key={t as string}>
                  <Icon size={24} className="text-gold-500" aria-hidden />
                  <p className="mt-3 text-h4 !text-paper">{t as string}</p>
                  <p className="mt-1 text-body-sm text-navy-200">{d as string}</p>
                </li>
              );
            })}
          </ul>
        </Container>
      </section>

      {/* Testimonials (fictional placeholders — replace with consented quotes before launch) */}
      <section aria-labelledby="t-h" className="py-20 md:py-24">
        <Container>
          <h2 id="t-h" className="font-display text-[2rem] font-medium leading-tight md:text-display-lg">What committees tell us</h2>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              ['The gate used to be a register and a lot of phone calls. Now there is a record of every entry, and nobody argues about who let whom in.', 'Meenakshi Rao', 'Secretary, 240-flat society, Pune'],
              ['Maintenance collection went from chasing people on WhatsApp to a dashboard I can show at the AGM.', 'Arvind Menon', 'Treasurer, 3-tower community, Bengaluru'],
              ['I approve the delivery from my desk at work and it is waiting at the gate when I get home. That is all I wanted.', 'Farah Siddiqui', 'Resident, Hyderabad'],
            ].map(([q, n, r]) => (
              <figure key={n} className="flex flex-col rounded-card bg-white p-8 shadow-card">
                <blockquote className="flex-1 font-display text-h2 font-medium leading-snug text-navy-900">“{q}”</blockquote>
                <figcaption className="mt-6 text-body-sm"><span className="font-semibold text-ink-900">{n}</span><span className="block text-slate-600">{r}</span></figcaption>
              </figure>
            ))}
          </div>
          <p className="mt-4 text-caption text-slate-500">Names changed for privacy.</p>
        </Container>
      </section>

      {/* Pricing teaser */}
      <section aria-labelledby="p-h" className="bg-slate-100 py-20 md:py-24">
        <Container>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 id="p-h" className="font-display text-[2rem] font-medium leading-tight md:text-display-lg">Simple pricing, per flat</h2>
            <Link to="/pricing" className="text-label text-emerald-700 underline-offset-4 hover:underline">Compare all plans</Link>
          </div>
          <div className="mt-10"><TierCards /></div>
        </Container>
      </section>

      {/* FAQ */}
      <section aria-labelledby="faq-h" className="py-20 md:py-24">
        <Container className="grid gap-10 lg:grid-cols-12">
          <h2 id="faq-h" className="font-display text-[2rem] font-medium leading-tight md:text-display-lg lg:col-span-4">Questions committees ask</h2>
          <div className="divide-y divide-slate-200 border-y border-slate-200 lg:col-span-8">
            {FAQ.map(([q, a]) => (
              <details key={q} className="group py-5">
                <summary className="flex min-h-[44px] items-center justify-between gap-4 text-h4 text-navy-900">{q}<span aria-hidden className="text-h3 text-slate-500 transition-transform duration-fast group-open:rotate-45">+</span></summary>
                <p className="mt-2 max-w-prose text-body text-slate-600">{a}</p>
              </details>
            ))}
          </div>
        </Container>
      </section>

      <Divider />

      {/* Final CTA */}
      <section className="py-20 text-center md:py-28">
        <Container>
          <h2 className="font-display text-[2rem] font-medium leading-tight md:text-display-lg">See your gate run calmly.</h2>
          <p className="mx-auto mt-4 max-w-xl text-body-lg text-slate-600">A 30-minute walkthrough with your committee, using your own blocks and flats.</p>
          <Link to="/contact" className={cx(btnClass('primary', 'lg'), 'mt-8')}>Book a demo</Link>
        </Container>
      </section>
    </>
  );
}
