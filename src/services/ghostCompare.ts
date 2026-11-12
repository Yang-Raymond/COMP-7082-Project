// Ghost race maths: where the ghost is at a given time, and how far ahead/behind the user is.
// Pure functions over a saved route's timed points (`RoutePoint.t` is active ms since start, pauses excluded).
import { SavedRoute, GhostDelta, RoutePoint } from '../types/route';
import type { LatLng } from '../types/map';
import { haversineDistance } from './distance';

/**
 * Returns where the ghost is `elapsedMs` into its run. Binary-searches for the segment
 * `points[i].t <= elapsedMs < points[i + 1].t` and linearly interpolates lat/lng inside it.
 * Clamps to the first point before the run starts and to the last point once it is over.
 * Returns null for an empty route. Assumes `t` is non-decreasing, as the recorder produces.
 */
export function ghostPositionAt(points: RoutePoint[], elapsedMs: number): LatLng | null {
  if (points.length === 0) return null;
  const first = points[0];
  const last = points[points.length - 1];
  if (elapsedMs <= first.t) return { lat: first.lat, lng: first.lng };
  if (elapsedMs >= last.t) return { lat: last.lat, lng: last.lng };

  // Invariant: points[lo].t <= elapsedMs < points[hi].t
  let lo = 0;
  let hi = points.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (points[mid].t <= elapsedMs) lo = mid;
    else hi = mid;
  }

  const a = points[lo];
  const b = points[hi];
  const span = b.t - a.t;
  const f = span > 0 ? (elapsedMs - a.t) / span : 0;
  return { lat: a.lat + (b.lat - a.lat) * f, lng: a.lng + (b.lng - a.lng) * f };
}

/**
 * Compares the user to the ghost: finds the route point nearest the user's position and
 * returns how much later (positive) or earlier (negative) the user reached it than the
 * ghost did, plus progress along the route. Returns null for an empty route.
 * Note: nearest-point matching can pick the wrong part of routes that cross themselves.
 */
export function computeGhostDelta(
  route: SavedRoute,
  currentLat: number,
  currentLng: number,
  elapsedMs: number
): GhostDelta | null {
  if (route.points.length === 0) return null;

  let closestIndex = 0;
  let closestDist = Infinity;

  for (let i = 0; i < route.points.length; i++) {
    const p = route.points[i];
    const d = haversineDistance({ lat: currentLat, lng: currentLng }, { lat: p.lat, lng: p.lng });
    if (d < closestDist) {
      closestDist = d;
      closestIndex = i;
    }
  }

  const ghostPoint = route.points[closestIndex];

  return {
    deltaMs: elapsedMs - ghostPoint.t,
    progress: closestIndex / (route.points.length - 1 || 1),
    ghostPosition: { lat: ghostPoint.lat, lng: ghostPoint.lng },
  };
}

/** Formats a delta as e.g. "5s ahead" or "1m 12s behind" (negative = ahead). */
export function formatDelta(deltaMs: number): string {
  const seconds = Math.round(Math.abs(deltaMs) / 1000);
  const sign = deltaMs < 0 ? 'ahead' : 'behind';
  if (seconds < 60) return `${seconds}s ${sign}`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s ${sign}`;
}