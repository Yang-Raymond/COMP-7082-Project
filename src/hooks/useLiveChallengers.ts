// Who is racing one of my routes right now, from GET /routes/live. Polls every few seconds while the screen that
// uses it is open and the app is in the foreground.
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { authedApi } from '../auth/auth';

export interface LiveChallenger {
  id: string;
  name: string;
  /** Route they are racing. */
  routeName: string;
  /** Profile photo, if they have one. */
  photo?: string | null;
}

const POLL_MS = 8_000;

export function useLiveChallengers(): LiveChallenger[] {
  const [racers, setRacers] = useState<LiveChallenger[]>([]);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      if (AppState.currentState !== 'active') return;
      try {
        const res = await authedApi<{ racers: { userId: number; username: string; routeName: string }[] }>('/routes/live');
        if (cancelled) return;
        const next = res.racers.map((r) => ({ id: String(r.userId), name: r.username, routeName: r.routeName }));
        // Keep the same array when nothing changed, so the screen doesn't redraw every poll
        setRacers((prev) =>
          prev.length === next.length && prev.every((p, i) => p.id === next[i].id && p.routeName === next[i].routeName)
            ? prev
            : next
        );
      } catch {
        if (!cancelled) setRacers((prev) => (prev.length ? [] : prev));
      }
    };
    poll();
    const timer = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  return racers;
}