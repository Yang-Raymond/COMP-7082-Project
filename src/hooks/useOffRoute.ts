// Off-route watchdog for races: measures how far the user is from the raced route, reports a
// warn/off level plus a termination countdown, vibrates on state changes, and tells the caller to
// end the race if the user stays far off the route. Opens no GPS watch of its own.
import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useRef, useState } from 'react';
import { distanceToRoute } from '../services/distance';
import type { LatLng } from '../types/map';

/** Distance (m) from the route beyond which the user is warned. */
export const WARN_M = 5;
/** Distance (m) from the route beyond which the end-of-race countdown runs. */
export const END_M = 10;
/** How long (ms) the user may stay beyond END_M before the race is terminated. */
export const END_GRACE_MS = 10_000;
const TICK_MS = 1000;

export type OffRouteLevel = 'ok' | 'warn' | 'off';

interface Options {
  /** Route being raced (only its points are read). */
  route: LatLng[];
  /** Latest accepted user fix, or null before the first one. */
  userPoint: LatLng | null;
  /** Check runs only while true (race recording); false resets everything. */
  active: boolean;
  /** Called at most once per off-route episode when the grace period runs out. */
  onTerminate: () => void;
}

/** Fire-and-forget haptic. */
function buzz(type: Haptics.NotificationFeedbackType) {
  Haptics.notificationAsync(type).catch(() => {});
}

/**
 * Tracks distance from the route and drives the off-route state machine:
 * `ok` (<= WARN_M) -> `warn` (> WARN_M) -> `off` (> END_M). Entering `warn` or `off` vibrates once.
 * While `off`, a 1 s interval counts down END_GRACE_MS; reaching zero vibrates (error) and calls
 * `onTerminate` once. Returning within END_M, pausing or deactivating clears the interval and resets
 * the countdown. The interval is cleaned up on every re-run and on unmount (strict-mode safe), and
 * the latest `onTerminate` is read through a ref so a stale closure is never called.
 * Returns `offRouteM` (null without a fix), `level`, and `secondsLeft` (meaningful while `off`).
 */
export function useOffRoute({ route, userPoint, active, onTerminate }: Options): {
  offRouteM: number | null;
  level: OffRouteLevel;
  secondsLeft: number;
} {
  const initialSeconds = Math.ceil(END_GRACE_MS / 1000);
  const [secondsLeft, setSecondsLeft] = useState(initialSeconds);
  const onTerminateRef = useRef(onTerminate);
  const prevLevelRef = useRef<OffRouteLevel>('ok');

  useEffect(() => {
    onTerminateRef.current = onTerminate;
  }, [onTerminate]);

  const offRouteM = useMemo(
    () => (userPoint ? distanceToRoute(route, userPoint) : null),
    [route, userPoint]
  );

  let level: OffRouteLevel = 'ok';
  if (active && offRouteM !== null) {
    if (offRouteM > END_M) level = 'off';
    else if (offRouteM > WARN_M) level = 'warn';
  }

  // Vibrate once on each transition into warn or off.
  useEffect(() => {
    if (level !== 'ok' && level !== prevLevelRef.current) buzz(Haptics.NotificationFeedbackType.Warning);
    prevLevelRef.current = level;
  }, [level]);

  // Termination countdown, running only while off route.
  useEffect(() => {
    if (level !== 'off') return;
    const startedAt = Date.now();
    let fired = false;
    const id = setInterval(() => {
      const left = END_GRACE_MS - (Date.now() - startedAt);
      if (left > 0) {
        setSecondsLeft(Math.ceil(left / 1000));
      } else if (!fired) {
        fired = true;
        clearInterval(id);
        setSecondsLeft(0);
        buzz(Haptics.NotificationFeedbackType.Error);
        onTerminateRef.current();
      }
    }, TICK_MS);
    return () => {
      clearInterval(id);
      // Reset for the next episode (cleanup runs from an effect teardown, not during render).
      setSecondsLeft(initialSeconds);
    };
  }, [level, initialSeconds]);

  return { offRouteM, level, secondsLeft };
}
