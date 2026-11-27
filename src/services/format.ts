// Small display helpers shared by the screens: clock and race times, distances, dates, and relative times
// such as "2h ago" or "5h left". The relative-time helpers take an optional `now` so they can be unit tested.
const pad = (n: number) => String(n).padStart(2, '0');


export function formatClock(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

/** 8:32 — for "time to beat" style labels. */
export function formatMinSec(ms: number): string {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${pad(s % 60)}`;
}

export function formatKm(meters: number): string {
  return (meters / 1000).toFixed(2);
}

/** November 6, 2026 at 10:49 AM */
export function formatDateTime(ms: number): string {
  const d = new Date(ms);
  const date = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${date} at ${time}`;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** how long ago `ms` was, measured from `now`. */
export function timeAgo(ms: number, now: number = Date.now()): string {
  const m = Math.max(0, Math.round((now - ms) / MINUTE));
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

/**
 * How long until a deadline `ms` (a time in milliseconds), measured from `now`.
 * Rounds down so it never promises more time than there is. A deadline that has passed reads "expired".
 */
export function formatTimeLeft(ms: number, now: number = Date.now()): string {
  const left = ms - now;
  if (left <= 0) return 'expired';
  if (left < HOUR) return `${Math.max(1, Math.floor(left / MINUTE))}m left`;
  if (left < DAY) return `${Math.floor(left / HOUR)}h left`;
  return `${Math.floor(left / DAY)}d left`;
}

/**
 * A signed time difference as m:ss with a real minus sign eg. -9000 -> "−0:09".
 * Negative means faster (ahead), positive means slower (behind).
 */
export function formatDelta(ms: number): string {
  const s = Math.round(Math.abs(ms) / 1000);
  if (s === 0) return '0:00';
  return `${ms < 0 ? '\u2212' : '+'}${Math.floor(s / 60)}:${pad(s % 60)}`;
}
