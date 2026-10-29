// IST = UTC+05:30 with no DST, so fixed-offset arithmetic is exact.
export const IST_OFFSET_MIN = 330;
const OFFSET_MS = IST_OFFSET_MIN * 60_000;

export const addMinutes = (d: Date, n: number) => new Date(d.getTime() + n * 60_000);

/** "YYYY-MM-DD" + "HH:mm" in IST -> UTC Date. */
export function istDateTimeToUtc(date: string, hhmm: string): Date {
  return new Date(Date.parse(`${date}T${hhmm}:00.000Z`) - OFFSET_MS);
}

/** [00:00 IST, next 00:00 IST) of the given IST calendar date. */
export function istDayRange(date: string): { start: Date; end: Date } {
  const start = istDateTimeToUtc(date, '00:00');
  return { start, end: new Date(start.getTime() + 24 * 3_600_000) };
}

export function istDateOf(d: Date): string {
  return new Date(d.getTime() + OFFSET_MS).toISOString().slice(0, 10);
}

export const startOfTodayIst = (now = new Date()) => istDayRange(istDateOf(now)).start;
export const currentPeriod = (now = new Date()) => istDateOf(now).slice(0, 7);

/** IST month bounds of "YYYY-MM", in UTC. */
export function periodRange(period: string): { start: Date; end: Date } {
  const [y, m] = period.split('-').map(Number);
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
  return { start: istDateTimeToUtc(`${period}-01`, '00:00'), end: istDateTimeToUtc(`${next}-01`, '00:00') };
}
