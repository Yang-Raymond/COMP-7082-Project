// Finish-line detector for races: watches the user's accepted GPS fixes and reports (once) when the
// user reaches the raced route's last point after covering most of the route's distance.
// Opens no GPS watch of its own.
import * as Haptics from 'expo-haptics';
import { useEffect, useRef } from 'react';
import { haversineDistance } from '../services/distance';
import type { RoutePoint, SavedRoute } from '../types/route';

/** Distance (m) from the route's last point within which the user counts as finished. */
export const FINISH_RADIUS_M = 5;
/** Fraction of the route's distance the user must have covered before the finish can count. */
export const MIN_COVERED_FRACTION = 0.95;

interface Options {
  /** Route being raced (its last point is the finish line). */
  route: SavedRoute;
  /** Latest accepted user fix (with its active-clock time `t`), or undefined before the first one. */
  userPoint: RoutePoint | undefined;
  /** Distance (m) the user has covered so far in this race. */
  coveredM: number;
  /** Detection runs only while true (race recording). */
  active: boolean;
  /** Called at most once with the active-clock time (ms) of the fix that crossed the finish. */
  onFinish: (finishMs: number) => void;
}

/**
 * Calls `onFinish(userPoint.t)` the first time, while active, the user has covered at least
 * MIN_COVERED_FRACTION of the route's distance and is within FINISH_RADIUS_M of the route's last
 * point. The coverage requirement stops loop routes (finish next to the start) from ending right
 * after GO. Using the fix's own `t` keeps the finish time free of render delay. A ref guard makes
 * the callback fire once, and the latest `onFinish` is read through a ref so a stale closure is
 * never called. Vibrates (success) when the finish is detected.
 */
export function useRaceFinish({ route, userPoint, coveredM, active, onFinish }: Options): void {
  const onFinishRef = useRef(onFinish);
  const firedRef = useRef(false);

  useEffect(() => {
    onFinishRef.current = onFinish;
  }, [onFinish]);

  useEffect(() => {
    if (!active || firedRef.current || !userPoint) return;
    const finishPoint = route.points[route.points.length - 1];
    if (!finishPoint) return;
    if (coveredM < MIN_COVERED_FRACTION * route.distanceMeters) return;
    if (haversineDistance(userPoint, finishPoint) > FINISH_RADIUS_M) return;
    firedRef.current = true;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onFinishRef.current(userPoint.t);
  }, [active, userPoint, coveredM, route]);
}
