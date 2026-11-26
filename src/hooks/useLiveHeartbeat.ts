// While you're racing a route that's on the server, tells the server every 10 seconds so the route's creator sees
// you under "Live now". Stops when you leave the race (or the route changes).
// The race counts as live from the moment the Race screen opens, not from the first step.
import { useEffect } from 'react';
import { authedApi } from '../auth/auth';

const BEAT_MS = 10_000;

export function useLiveHeartbeat(serverId: string | null) {
  useEffect(() => {
    if (!serverId) return;
    const beat = () => {
      authedApi(`/routes/${serverId}/live`, {}).catch(() => {}); // offline or server asleep: just try again next time
    };
    beat();
    const timer = setInterval(beat, BEAT_MS);
    return () => {
      clearInterval(timer);
      authedApi('/routes/live/stop', {}).catch(() => {});
    };
  }, [serverId]);
}