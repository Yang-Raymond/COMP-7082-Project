
import { SavedRoute, GhostDelta } from '../types/route';
import { haversineDistance } from './distance';

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

export function formatDelta(deltaMs: number): string {
  const seconds = Math.round(Math.abs(deltaMs) / 1000);
  const sign = deltaMs < 0 ? 'ahead' : 'behind';
  if (seconds < 60) return `${seconds}s ${sign}`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s ${sign}`;
}