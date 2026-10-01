

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

export function formatDistance(meters: number): string {
  return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(2)} km`;
}