// Pre-race start gate: tells the race screen how far the user is from the route's start point and
// runs an automatic 3-2-1 countdown once they are standing on it. Opens no GPS watch of its own.
import { useEffect, useMemo, useRef, useState } from 'react';
import { haversineDistance } from '../services/distance';
import type { LatLng } from '../types/map';

/** Distance (m) within which the countdown begins. */
export const START_RADIUS_M = 5;
/** Distance (m) beyond which a running countdown cancels; larger than the start radius so GPS jitter at the edge doesn't flicker it. */
export const CANCEL_RADIUS_M = 7;
/** First number shown by the countdown. */
export const COUNTDOWN_FROM = 3;
const TICK_MS = 1000;

interface Options {
  /** Route start point, or null when the route has no points (gate never opens). */
  start: LatLng | null;
  /** Latest known user position. */
  position: LatLng | null;
  /** True only when `position` is a live GPS fix (cached positions can't start a race). */
  isLive: boolean;
  /** Gate is active only while true (i.e. before the race has started). */
  enabled: boolean;
  /** Called exactly once when the countdown reaches zero. */
  onGo: () => void;
}

/**
 * Owns the pre-race gate. Returns `distanceM` to the start (null without a position) and
 * `countdown` (3, 2, 1, or null when not counting). The countdown starts automatically when a live
 * fix is within START_RADIUS_M, cancels if the fix is lost or drifts past CANCEL_RADIUS_M, and
 * calls `onGo` once after the final tick. Disabling the gate hides and stops any countdown. One timeout per tick is cleared on every re-run and on
 * unmount, so strict-mode double effects and cancellation never leave a stray timer or double fire.
 */
export function useRaceStart({ start, position, isLive, enabled, onGo }: Options): {
  distanceM: number | null;
  countdown: number | null;
} {
  const [rawCountdown, setCountdown] = useState<number | null>(null);
  // Treated as idle whenever the gate is disabled, so a stale value can never tick or show.
  const countdown = enabled ? rawCountdown : null;
  // Latest onGo, so a timer scheduled earlier never calls a stale closure.
  const onGoRef = useRef(onGo);
  // Set once GO has fired so the still-in-range user can't immediately restart the countdown.
  const firedRef = useRef(false);

  useEffect(() => {
    onGoRef.current = onGo;
  }, [onGo]);

  const distanceM = useMemo(
    () => (start && position ? haversineDistance(position, start) : null),
    [start, position]
  );

  // Gate: opens the countdown when in range, cancels it when out of range / no live fix / disabled.
  useEffect(() => {
    if (!enabled) {
      firedRef.current = false;
      return;
    }
    const live = isLive && distanceM !== null;
    if (countdown === null) {
      if (!firedRef.current && live && distanceM <= START_RADIUS_M) setCountdown(COUNTDOWN_FROM);
    } else if (!live || distanceM > CANCEL_RADIUS_M) {
      setCountdown(null);
    }
  }, [enabled, isLive, distanceM, countdown]);

  // Tick: one timeout per displayed number; the last tick fires onGo and clears the countdown.
  useEffect(() => {
    if (countdown === null) return;
    const id = setTimeout(() => {
      if (countdown > 1) {
        setCountdown(countdown - 1);
      } else {
        firedRef.current = true;
        setCountdown(null);
        onGoRef.current();
      }
    }, TICK_MS);
    return () => clearTimeout(id);
  }, [countdown]);

  return { distanceM, countdown };
}
