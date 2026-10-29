import { Link } from 'react-router-dom';
import { Avatar, btnClass } from '../components/ui';
import { Container, Divider } from './MarketingLayout';

const PRINCIPLES = [
  ['Composure', 'Security is communicated by calm and order, not alarms. Even an SOS is firm, not frantic.'],
  ['Precision', 'Exact names, flat numbers and times. Every entry has a who, a when and a why.'],
  ['Discretion', 'We show the least personal data a screen needs. Phone numbers are masked on shared devices.'],
];
// Placeholder team grid — replace with real people before launch.
const TEAM = [['Product', 'Head of product'], ['Engineering', 'Lead engineer'], ['Design', 'Product designer'], ['Customer success', 'Onboarding lead']];

export default function About() {
  return (
    <>
      <Container className="py-16 md:py-24">
        <p className="max-w-4xl font-display text-[2.25rem] font-medium leading-[1.15] tracking-[-0.015em] text-navy-900 md:text-display-lg">
          We think the gate of a home should feel like the lobby of a well-run private bank: quiet, ordered and attentive.
        </p>
        <p className="mt-6 max-w-2xl text-body-lg text-slate-600">Gatekeeper started with a simple observation. The people who keep a society safe — guards, committee volunteers, facility managers — do careful work with clumsy tools. We build tools that respect that work.</p>
      </Container>
      <Divider />
      <Container className="py-16 md:py-24">
        <h1 className="font-display text-display-md">Three principles we design by</h1>
        <div className="mt-10 grid gap-8 md:grid-cols-3">
          {PRINCIPLES.map(([t, d]) => (
            <div key={t} className="border-t border-navy-900 pt-6">
              <h2 className="font-display text-[1.75rem] font-medium">{t}</h2>
              <p className="mt-3 text-body text-slate-600">{d}</p>
            </div>
          ))}
        </div>
        <h2 className="mt-24 font-display text-display-md">The team</h2>
        <ul className="mt-8 grid grid-cols-2 gap-6 md:grid-cols-4">
          {TEAM.map(([n, r]) => (
            <li key={n} className="rounded-card bg-white p-6 shadow-card">
              <Avatar name={n} size={56} />
              <p className="mt-4 text-h4 text-navy-900">{r}</p>
              <p className="text-body-sm text-slate-600">{n}, Bengaluru</p>
            </li>
          ))}
        </ul>
        <div className="mt-16 flex flex-wrap items-center justify-between gap-6 rounded-panel bg-slate-100 p-8">
          <p className="text-h3 text-navy-900">Want to talk to us about your society?</p>
          <Link to="/contact" className={btnClass('primary', 'lg')}>Contact us</Link>
        </div>
      </Container>
    </>
  );
}

const LEGAL = {
  privacy: { title: 'Privacy approach', body: [
    ['What we collect', 'Names, phone numbers and flat numbers of members; visitor names, optional phone and vehicle numbers; and the times of entries, approvals and payments. We collect nothing we do not need to run the gate and the society accounts.'],
    ['How it is separated', "Every record belongs to exactly one society. Members of one society can never see another society's data."],
    ['Who can see what', "Residents see their own flat. Guards see what they need at the gate, with resident phone numbers masked. Admins see the society's records."],
    ['Sign-in security', 'We use one-time codes sent to your phone. Codes are stored hashed, expire in five minutes and lock after five wrong attempts.'],
    ['Your choices', 'Ask your society admin to deactivate your membership at any time. Contact us to have your account deleted.'],
  ] },
  terms: { title: 'Terms of use', body: [
    ['The service', 'Gatekeeper provides software for societies to manage visitors, communication, requests, bookings and accounts.'],
    ['Accounts', 'Society admins are responsible for who they add as members and for keeping membership up to date.'],
    ['Payments', 'Online payments in the current version are processed in test mode; no money moves until a payment provider is enabled for your society.'],
    ['Changes', 'We will tell society admins about material changes to these terms at least 30 days in advance.'],
  ] },
};

export function Legal({ kind }: { kind: keyof typeof LEGAL }) {
  const l = LEGAL[kind];
  return (
    <Container className="py-16 md:py-24">
      <article className="max-w-prose">
        <h1 className="font-display text-display-md">{l.title}</h1>
        <p className="mt-2 text-body-sm text-slate-500">Draft for review.</p>
        {l.body.map(([h, p]) => (
          <section key={h} className="mt-8">
            <h2 className="text-h2">{h}</h2>
            <p className="mt-2 text-body text-slate-600">{p}</p>
          </section>
        ))}
      </article>
    </Container>
  );
}
