/**
 * Date helpers that work in the business's own timezone.
 *
 * The application stores dates as plain `YYYY-MM-DD` strings and shows
 * everything in IST. Comparing those against a UTC "now" is how off-by-one-day
 * reminder bugs happen: an invoice due today in Jaipur is still "tomorrow" in
 * UTC for the first five and a half hours of every day. A reminder that fires a
 * day early — or a day late — is worse than useless to the customer receiving
 * it, so every comparison here is done on the calendar date in the target zone.
 */

export const DEFAULT_ZONE = 'Asia/Kolkata';

/** Today's calendar date in the given IANA zone, as YYYY-MM-DD. */
export function todayInZone(zone: string = DEFAULT_ZONE, now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** Parse a leading YYYY-MM-DD as a UTC-midnight instant. Null if unparseable. */
function parseDateOnly(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!m) return null;
  const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(ms) ? null : ms;
}

const DAY_MS = 86_400_000;

/**
 * Whole days from `today` to `target`. Negative means the target has passed.
 * Null when either date cannot be read.
 */
export function daysUntil(target: unknown, today: string): number | null {
  const t = parseDateOnly(target);
  const n = parseDateOnly(today);
  if (t === null || n === null) return null;
  return Math.round((t - n) / DAY_MS);
}

/** Hours from `now` until an ISO timestamp. Negative means it has passed. */
export function hoursUntil(isoTimestamp: unknown, now: number = Date.now()): number | null {
  if (typeof isoTimestamp !== 'string') return null;
  const ms = Date.parse(isoTimestamp);
  if (Number.isNaN(ms)) return null;
  return (ms - now) / 3_600_000;
}
