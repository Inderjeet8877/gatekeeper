// docs/09-UI-UX-DESIGN-SYSTEM.md §8.4, plus a manual Asia/Kolkata fallback for engines whose Intl lacks timeZone.
const TZ = 'Asia/Kolkata';
const DAY = 86_400_000;
const IST_OFFSET = 330 * 60_000; // IST has no DST
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WD = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const pad = (n: number) => String(n).padStart(2, '0');

const INTL_TZ = (() => {
  try {
    const f = new Intl.DateTimeFormat('en-IN', { timeZone: TZ, hour: 'numeric', hour12: true });
    return f.resolvedOptions().timeZone === TZ && typeof f.formatToParts === 'function';
  } catch {
    return false;
  }
})();

function manualParts(d: Date, o: Intl.DateTimeFormatOptions): Record<string, string> {
  const s = new Date(d.getTime() + IST_OFFSET);
  const m = s.getUTCMonth(), h = s.getUTCHours(), wd = WD[s.getUTCDay()];
  return {
    year: String(s.getUTCFullYear()),
    month: o.month === 'short' ? MON[m] : o.month === 'long' ? MONTHS[m] : pad(m + 1),
    day: o.day === '2-digit' ? pad(s.getUTCDate()) : String(s.getUTCDate()),
    hour: String(h % 12 || 12),
    minute: pad(s.getUTCMinutes()),
    dayPeriod: h < 12 ? 'am' : 'pm',
    weekday: o.weekday === 'long' ? wd : wd.slice(0, 3),
  };
}

function parts(d: Date, o: Intl.DateTimeFormatOptions): Record<string, string> {
  if (!INTL_TZ) return manualParts(d, o);
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
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency', currency: 'INR', minimumFractionDigits: frac, maximumFractionDigits: 2,
    }).format(paise / 100);
  } catch {
    const [int, dec] = (Math.abs(paise) / 100).toFixed(frac).split('.');
    const grouped = int.length > 3 ? `${int.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${int.slice(-3)}` : int;
    return `${paise < 0 ? '-' : ''}₹${grouped}${dec ? `.${dec}` : ''}`;
  }
}

/** "5:42 pm" */
export function formatTime(d: Date | string): string {
  const p = parts(new Date(d), { hour: 'numeric', minute: '2-digit', hour12: true });
  return `${p.hour}:${p.minute} ${p.dayPeriod.toLowerCase()}`;
}

/** "29 Oct" (adds year when not current year) */
export function formatDate(d: Date | string, now = new Date()): string {
  const p = parts(new Date(d), { day: 'numeric', month: 'short', year: 'numeric' });
  return p.year === parts(now, { year: 'numeric' }).year ? `${p.day} ${p.month}` : `${p.day} ${p.month} ${p.year}`;
}

/** "29 Oct, 5:42 pm" */
export const formatDateTime = (d: Date | string, now = new Date()) => `${formatDate(d, now)}, ${formatTime(d)}`;

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
  return `${MONTHS[m - 1]} ${y}`;
}

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

// ---- mobile extras ----

/** IST calendar day `offset` days from now: key "2026-10-29" (API `date` param) + display bits. */
export function istDay(offset = 0, now = new Date()) {
  const d = new Date(now.getTime() + offset * DAY);
  const p = parts(d, { weekday: 'short', day: 'numeric', month: 'short' });
  return { key: dayKey(d), weekday: p.weekday, day: p.day, month: p.month };
}

/** "Wednesday, 29 Oct" */
export function formatWeekdayDate(d: Date = new Date()): string {
  const p = parts(d, { weekday: 'long', day: 'numeric', month: 'short' });
  return `${p.weekday}, ${p.day} ${p.month}`;
}

/** "Good morning" / "Good afternoon" / "Good evening" by IST hour */
export function greeting(now = new Date()): string {
  const h = new Date(now.getTime() + IST_OFFSET).getUTCHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

/** Guard console Night window, 7 pm–6 am IST (docs/09 §5.3). */
export function isNightIST(now = new Date()): boolean {
  const h = new Date(now.getTime() + IST_OFFSET).getUTCHours();
  return h >= 19 || h < 6;
}

/** Sentence-case an enum: "IN_PROGRESS" → "In progress" */
export const humanize = (s: string) => s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' ');

export const digits = (s: string) => s.replace(/\D/g, '');

/** "06:00" → "6:00 am" (amenity wall-clock hours, already IST) */
export const clock = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return `${h % 12 || 12}:${pad(m)} ${h < 12 ? 'am' : 'pm'}`;
};
export const amenityLine = (a: { openTime: string; closeTime: string; slotMinutes: number; pricePerSlot: number }) =>
  `${clock(a.openTime)} – ${clock(a.closeTime)} · ${a.slotMinutes} min slots · ${a.pricePerSlot ? `${formatINR(a.pricePerSlot)} / slot` : 'Free'}`;
