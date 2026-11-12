// Ghost race state: derives the ghost's current position and the user's ahead/behind delta
// from the shared route recorder's clock. Opens no GPS watch or timer of its own.
import { useMemo } from 'react';
import { computeGhostDelta, ghostPositionAt } from '../services/ghostCompare';
import { GhostDelta, RoutePoint, SavedRoute } from '../types/route';
import type { LatLng } from '../types/map';

/**
 * Computes the ghost marker position and live delta. `elapsedMs` and `userPoints[].t` must be
 * the recorder's active clock (pauses excluded), the same clock the saved route's points use.
 * `ghostPosition` is the route interpolated at `elapsedMs`. `delta` compares the user's latest
 * accepted point to the ghost and is null until the user has a point.
 */
export function useGhostRace(
  route: SavedRoute,
  userPoints: RoutePoint[],
  elapsedMs: number
): { ghostPosition: LatLng | null; delta: GhostDelta | null } {
  const ghostPosition = useMemo(() => ghostPositionAt(route.points, elapsedMs), [route.points, elapsedMs]);

  const lastUser = userPoints[userPoints.length - 1];
  const delta = useMemo(
    () => (lastUser ? computeGhostDelta(route, lastUser.lat, lastUser.lng, lastUser.t) : null),
    [route, lastUser],
  );

  return { ghostPosition, delta };
}
