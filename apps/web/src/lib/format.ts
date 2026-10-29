// From docs/09-UI-UX-DESIGN-SYSTEM.md §8.4 (+ a few IST input helpers)
const TZ = 'Asia/Kolkata';
const DAY = 86_400_000;

function parts(d: Date, o: Intl.DateTimeFormatOptions): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of new Intl.DateTimeFormat('en-IN', { timeZone: TZ, ...o }).formatToParts(d)) out[p.type] = p.value;
  return out;
}
const dayKey = (d: Date) => {
  const p = parts(d, { year: 'numeric', month: '2-digit', day: '2-digit' });
  return `${p.year}-${p.month}-${p.day}`;
};

/** paise → "₹3,500" / "₹2,500.50" (en-IN lakh grouping) */
export function formatINR(paise: number, { alwaysPaise = false } = {}): string {
  const frac = alwaysPaise || paise % 100 !== 0 ? 2 : 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', minimumFractionDigits: frac, maximumFractionDigits: 2,
  }).format(paise / 100);
}

/** KPI tiles only: "₹1.42 L", "₹2.3 Cr" */
export function formatINRCompact(paise: number): string {
  const r = paise / 100, abs = Math.abs(r), sign = r < 0 ? '-' : '';
  const trim = (n: number) => n.toFixed(n < 10 ? 2 : 1).replace(/\.?0+$/, '');
  if (abs >= 1e7) return `${sign}₹${trim(abs / 1e7)} Cr`;
  if (abs >= 1e5) return `${sign}₹${trim(abs / 1e5)} L`;
  return formatINR(Math.round(paise / 100) * 100);
}

/** "5:42 pm" */
export function formatTime(d: Date | string): string {
  const p = parts(new Date(d), { hour: 'numeric', minute: '2-digit', hour12: true });
  return `${p.hour}:${p.minute} ${(p.dayPeriod ?? '').toLowerCase()}`;
}

/** "29 Oct" (adds year when not current year) */
export function formatDate(d: Date | string, now = new Date()): string {
  const p = parts(new Date(d), { day: 'numeric', month: 'short', year: 'numeric' });
  return p.year === parts(now, { year: 'numeric' }).year ? `${p.day} ${p.month}` : `${p.day} ${p.month} ${p.year}`;
}

/** "29 Oct, 5:42 pm" */
export const formatDateTime = (d: Date | string, now = new Date()) => `${formatDate(d, now)}, ${formatTime(d)}`;

/** "Wednesday, 29 Oct" */
export function formatLongDay(d: Date | string = new Date()): string {
  const p = parts(new Date(d), { weekday: 'long', day: 'numeric', month: 'short' });
  return `${p.weekday}, ${p.day} ${p.month}`;
}

/** "Just now", "4 min ago", "Yesterday, 6:10 pm", "In 8 min", "Tomorrow, 10:00 am" … */
export function formatRelative(d: Date | string, now = new Date()): string {
  const date = new Date(d);
  const diff = now.getTime() - date.getTime();
  const min = Math.round(Math.abs(diff) / 60_000);
  const sameDay = dayKey(date) === dayKey(now);
  if (diff >= 0) {
    if (diff < 45_000) return 'Just now';
    if (min < 60) return `${min} min ago`;
    if (sameDay) return formatTime(date);
    if (dayKey(date) === dayKey(new Date(now.getTime() - DAY))) return `Yesterday, ${formatTime(date)}`;
    if (diff < 6 * DAY) return `${parts(date, { weekday: 'short' }).weekday}, ${formatTime(date)}`;
    return formatDateTime(date, now);
  }
  if (min < 1) return 'In less than a minute';
  if (min < 60) return `In ${min} min`;
  if (sameDay) return `Today, ${formatTime(date)}`;
  if (dayKey(date) === dayKey(new Date(now.getTime() + DAY))) return `Tomorrow, ${formatTime(date)}`;
  return formatDateTime(date, now);
}

/** ms → "8:41" */
export function formatCountdown(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** "2026-10" → "October 2026" */
export function formatPeriod(period: string): string {
  const [y, m] = period.split('-').map(Number);
  return new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(y, m - 1, 1)));
}

/** "2026-11-10" (IST calendar date) → "10 Nov" */
export const formatISODate = (d: string) => formatDate(`${d}T12:00:00+05:30`);

/** "A-101" */
export const flatLabel = (blockName: string, number: string | number) =>
  `${blockName.trim()}-${String(number).trim()}`;

const national = (phone: string) => {
  const d = phone.replace(/\D/g, '');
  return d.length === 12 && d.startsWith('91') ? d.slice(2) : d;
};
/** "+91 98765 43210" */
export function formatPhone(phone: string): string {
  const n = national(phone);
  return n.length === 10 ? `+91 ${n.slice(0, 5)} ${n.slice(5)}` : `+${n}`;
}
/** "+91 ••••• 43210" — use on guard/shared screens */
export function maskPhone(phone: string): string {
  const n = national(phone);
  return n.length === 10 ? `+91 ••••• ${n.slice(5)}` : `••••${n.slice(-4)}`;
}
/** "135 790" */
export const formatPasscode = (code: string) => `${code.slice(0, 3)} ${code.slice(3)}`;

/** Digits only, as the API expects. */
export const cleanPhone = (s: string) => s.replace(/\D/g, '');

/** Today's IST calendar date "YYYY-MM-DD" (optionally offset by days). */
export const todayIST = (offsetDays = 0) => dayKey(new Date(Date.now() + offsetDays * DAY));
/** Current IST period "YYYY-MM". */
export const currentPeriod = () => todayIST().slice(0, 7);

/** ISO instant → value for <input type="datetime-local"> in IST ("2026-10-29T17:42"). */
export function toISTInput(d: Date | string): string {
  const p = parts(new Date(d), { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
/** <input type="datetime-local"> value read as IST → ISO UTC string. */
export const fromISTInput = (v: string) => new Date(`${v}:00+05:30`).toISOString();

/** Rupee string → integer paise; null if invalid or > 2 decimals. */
export function rupeesToPaise(s: string): number | null {
  const t = s.replace(/[,₹\s]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  return Math.round(Number(t) * 100);
}

/** "101-104, 201, G1" → ["101","102","103","104","201","G1"] */
export function parseNumbers(input: string): string[] {
  const out: string[] = [];
  for (const raw of input.split(/[,\s]+/).filter(Boolean)) {
    const m = raw.match(/^(\d+)-(\d+)$/);
    if (m && Number(m[2]) >= Number(m[1]) && Number(m[2]) - Number(m[1]) < 200) {
      for (let i = Number(m[1]); i <= Number(m[2]); i++) out.push(String(i));
    } else out.push(raw);
  }
  return [...new Set(out)];
}

export const titleCase = (e: string) => e.charAt(0) + e.slice(1).toLowerCase().replace(/_/g, ' ');

export const greeting = () => {
  const h = Number(parts(new Date(), { hour: 'numeric', hourCycle: 'h23' }).hour);
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};
