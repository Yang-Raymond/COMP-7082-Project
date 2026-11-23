// Finish-line detector for races: watches the user's accepted GPS fixes and reports (once) when the
// user reaches the raced route's last point after covering most of the route's distance.
// Opens no GPS watch of its own.
import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useRef } from 'react';
import { closestFractionOnSegment, haversineDistance } from '../services/distance';
import type { RoutePoint, SavedRoute } from '../types/route';
import { START_RADIUS_M } from './useRaceStart';

/**
 * Distance (m) from the route's last point within which the user counts as finished. It has to
 * absorb the GPS error of the user's fix plus that of the route's own recorded last point (fixes up
 * to 20 m accuracy are accepted), so a 5 m circle was routinely missed.
 */
export const FINISH_RADIUS_M = 15;
/**
 * Fraction of the route's reachable distance the user must have covered before the finish can
 * count. "Reachable" leaves out the start and finish radii: the race starts up to START_RADIUS_M
 * along the route and ends FINISH_RADIUS_M before its last point, so the user's recorded distance
 * never includes those stretches.
 */
export const MIN_COVERED_FRACTION = 0.85;

interface Options {
  /** Route being raced (its last point is the finish line). */
  route: SavedRoute;
  /** The user's accepted fixes so far in this race, with active-clock times `t`. */
  userPoints: RoutePoint[];
  /** Distance (m) the user has covered so far in this race. */
  coveredM: number;
  /** Detection runs only while true (race recording). */
  active: boolean;
  /** Called at most once with the user's and the ghost's finish times (active-clock ms). */
  onFinish: (userMs: number, ghostMs: number) => void;
}

/**
 * The ghost's finish time, measured the same way as the user's: the time of its first point inside
 * FINISH_RADIUS_M on the final approach. Walks back from the last point and stops at the first point
 * outside the radius, so a loop route's start (also near the finish) is never picked. Without this,
 * the user would stop the clock up to FINISH_RADIUS_M early while the ghost ran all the way in.
 */
function ghostFinishMs(points: RoutePoint[]): number {
  const end = points[points.length - 1];
  if (!end) return 0;
  let i = points.length - 1;
  while (i > 0 && haversineDistance(points[i - 1], end) <= FINISH_RADIUS_M) i--;
  return points[i].t;
}

/**
 * Calls `onFinish(userMs, ghostMs)` the first time, while active, the user has covered at least
 * MIN_COVERED_FRACTION of the route's reachable distance and their latest step (previous fix to
 * latest fix) comes within FINISH_RADIUS_M of the route's last point. Checking the whole step
 * rather than only the latest fix means a fast step can't jump over the finish circle. The
 * coverage requirement stops loop routes (finish next to the start) from ending right after GO.
 * `userMs` is interpolated along that step to its closest approach, from the fixes' own `t`, so it
 * is free of render delay. A ref guard makes the callback fire once, and the latest `onFinish` is
 * read through a ref so a stale closure is never called. Vibrates (success) on finish.
 */
export function useRaceFinish({ route, userPoints, coveredM, active, onFinish }: Options): void {
  const onFinishRef = useRef(onFinish);
  const firedRef = useRef(false);
  const ghostMs = useMemo(() => ghostFinishMs(route.points), [route.points]);
  const cur = userPoints[userPoints.length - 1];
  const prev = userPoints[userPoints.length - 2];

  useEffect(() => {
    onFinishRef.current = onFinish;
  }, [onFinish]);

  useEffect(() => {
    if (!active || firedRef.current || !cur) return;
    const finishPoint = route.points[route.points.length - 1];
    if (!finishPoint) return;
    const reachableM = Math.max(0, route.distanceMeters - START_RADIUS_M - FINISH_RADIUS_M);
    if (coveredM < MIN_COVERED_FRACTION * reachableM) return;

    const from = prev ?? cur;
    const f = closestFractionOnSegment(from, cur, finishPoint);
    const closest = { lat: from.lat + (cur.lat - from.lat) * f, lng: from.lng + (cur.lng - from.lng) * f };
    if (haversineDistance(closest, finishPoint) > FINISH_RADIUS_M) return;

    firedRef.current = true;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onFinishRef.current(from.t + (cur.t - from.t) * f, ghostMs);
  }, [active, cur, prev, coveredM, route, ghostMs]);
}
