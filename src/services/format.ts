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