import { Link } from 'react-router-dom';
import {
  BadgeCheck, CalendarDays, Check, HandHelping, House, LifeBuoy, Megaphone, ReceiptIndianRupee, ShieldCheck, Siren,
  UserRoundCheck, type LucideIcon,
} from 'lucide-react';
import { Badge, btnClass } from '../components/ui';
import { Container } from './MarketingLayout';

type Mod = { id: string; name: string; icon: LucideIcon; title: string; points: string[]; who: [string, LucideIcon][] };
const R: [string, LucideIcon] = ['Residents', House], G: [string, LucideIcon] = ['Guards', BadgeCheck], C: [string, LucideIcon] = ['Committees', ShieldCheck];

const MODULES: Mod[] = [
  { id: 'gate', name: 'Gate', icon: UserRoundCheck, title: 'Visitor approvals in seconds, not phone calls.', who: [R, G, C],
    points: ['Guards log walk-ins with type tiles, a flat grid and company chips', 'Residents approve, deny or ask for a parcel to be left at the gate', 'Requests expire after 10 minutes so nobody waits indefinitely', 'Pre-approved guests enter with a 6-digit passcode'] },
  { id: 'help', name: 'Daily help', icon: HandHelping, title: 'Know when your maid, cook or driver came and went.', who: [R, G, C],
    points: ['Each staff member gets a passcode that works at the gate', 'Residents link staff to their flat and see attendance', 'Deactivated staff are refused at the gate immediately'] },
  { id: 'community', name: 'Community', icon: Megaphone, title: 'Notices that get read, polls that get answered.', who: [R, C],
    points: ['Categorised notices with pinning for what matters', 'Live notifications when a new notice is posted', 'Polls with one vote per resident and results everyone can see'] },
  { id: 'helpdesk', name: 'Helpdesk', icon: LifeBuoy, title: 'Every complaint tracked to closure.', who: [R, C],
    points: ['Residents raise requests by category and priority', 'Admins assign, update status and reply in a thread', 'Residents can reopen a request if the fix did not hold'] },
  { id: 'amenities', name: 'Amenities', icon: CalendarDays, title: 'Book the clubhouse without a register.', who: [R, C],
    points: ['Opening hours, slot length, capacity and price per amenity', 'A 14-day slot picker that never double-books', 'Cancel up to the start of the slot'] },
  { id: 'accounts', name: 'Accounts', icon: ReceiptIndianRupee, title: 'Maintenance billing the committee can stand behind.', who: [R, C],
    points: ['Generate a month of invoices for every flat in one action', 'Residents pay online; admins record cash', 'Expenses by category and a live collection dashboard'] },
  { id: 'sos', name: 'SOS', icon: Siren, title: 'Help that knows exactly where to go.', who: [R, G, C],
    points: ['Press and hold for 2 seconds to raise a medical, fire or theft alert', 'Guards and the committee get a full-screen alert with the flat number', 'The resident sees when someone acknowledges and is on the way'] },
];

export default function Features() {
  return (
    <>
      <Container className="py-16 md:py-24">
        <h1 className="max-w-3xl font-display text-[2.5rem] font-medium leading-tight tracking-[-0.02em] md:text-display-xl">Everything a gated community runs on, in one place.</h1>
        <p className="mt-4 max-w-2xl text-body-lg text-slate-600">Seven modules, one record. Each is designed for the person who actually uses it — the resident on their phone, the guard at the gate, the committee at their desk.</p>
      </Container>
      <Container className="grid gap-12 pb-24 lg:grid-cols-[220px_1fr]">
        <nav aria-label="Modules" className="hidden lg:block">
          <ul className="sticky top-24 space-y-1">
            {MODULES.map((m) => (
              <li key={m.id}><a href={`#${m.id}`} className="flex h-11 items-center gap-3 rounded-control px-3 text-label text-slate-600 hover:bg-slate-100 hover:text-navy-900"><m.icon size={18} aria-hidden />{m.name}</a></li>
            ))}
          </ul>
        </nav>
        <div className="space-y-6">
          {MODULES.map((m) => (
            <section key={m.id} id={m.id} aria-labelledby={`${m.id}-h`} className="scroll-mt-24 rounded-panel bg-white p-8 shadow-card md:p-10">
              <div className="flex items-center gap-3 text-emerald-700"><m.icon size={24} aria-hidden /><span className="text-label">{m.name}</span></div>
              <h2 id={`${m.id}-h`} className="mt-3 font-display text-display-md">{m.title}</h2>
              <ul className="mt-6 grid gap-3 md:grid-cols-2">
                {m.points.map((p) => <li key={p} className="flex gap-3 text-body text-slate-600"><Check size={20} className="mt-0.5 shrink-0 text-emerald-600" aria-hidden />{p}</li>)}
              </ul>
              <div className="mt-6 flex flex-wrap gap-2">{m.who.map(([w, I]) => <Badge key={w} icon={I}>{w}</Badge>)}</div>
            </section>
          ))}
          <div className="rounded-panel bg-navy-900 p-10 text-center text-paper">
            <p className="font-display text-display-md !text-paper">See it with your own blocks and flats.</p>
            <Link to="/contact" className={`${btnClass('primary', 'lg')} mt-6`}>Book a demo</Link>
          </div>
        </div>
      </Container>
    </>
  );
}
