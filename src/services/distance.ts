// Geographic distance helpers: great-circle distance, route length, point-to-route distance and
// distance formatting. Pure functions with no side effects.
interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_M = 6371000;

/** Great-circle distance between two points, in meters. */
export function haversineDistance(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);

  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);

  const h =
    sinLat * sinLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;

  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/** Running total distance across an ordered list of points. */
export function totalDistance(points: LatLng[]): number {
  let sum = 0;
  for (let i = 1; i < points.length; i++) {
    sum += haversineDistance(points[i - 1], points[i]);
  }
  return sum;
}

/**
 * Formats a distance in meters for display: whole meters below 1 km ("42 m"), otherwise
 * kilometers with two decimals ("1.25 km").
 */
export function formatDistance(meters: number): string {
  return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(2)} km`;
}

/**
 * Minimum distance (meters) from point `p` to the route polyline. Each segment is projected into a
 * local flat metre grid centred on `p` (equirectangular approximation, accurate to well under a
 * metre at route scales), then the point-to-segment distance is taken with the projection
 * parameter clamped to [0, 1] so points beyond a segment's end measure to the endpoint. Checking
 * segments rather than only vertices means sparsely sampled stretches aren't falsely "off route".
 * An empty route returns Infinity. A single-point route falls back to haversineDistance.
 */
export function distanceToRoute(points: LatLng[], p: LatLng): number {
  if (points.length === 0) return Infinity;
  if (points.length === 1) return haversineDistance(p, points[0]);

  const toRad = Math.PI / 180;
  const mPerDegLat = EARTH_RADIUS_M * toRad;
  const mPerDegLng = mPerDegLat * Math.cos(p.lat * toRad);
  // Local metres relative to p (so p is the origin).
  const toXY = (q: LatLng) => ({ x: (q.lng - p.lng) * mPerDegLng, y: (q.lat - p.lat) * mPerDegLat });

  let best = Infinity;
  let a = toXY(points[0]);
  for (let i = 1; i < points.length; i++) {
    const b = toXY(points[i]);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lenSq = dx * dx + dy * dy;
    // Parameter of the origin's projection onto a->b, clamped to the segment; 0 for a zero-length segment.
    const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, -(a.x * dx + a.y * dy) / lenSq));
    best = Math.min(best, Math.hypot(a.x + t * dx, a.y + t * dy));
    a = b;
  }
  return best;
}