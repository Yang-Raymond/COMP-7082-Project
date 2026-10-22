// Platform-neutral helpers for persisted locations, shared by storage.ts and storage.web.ts.
import type { LatLng } from '../types/map';

/** Parses a stored JSON location, returning null for missing, malformed or out-of-range values. */
export function parseLatLng(raw: string | null): LatLng | null {
  if (!raw) return null;
  try {
    const { lat, lng } = JSON.parse(raw);
    if (
      Number.isFinite(lat) && Number.isFinite(lng) &&
      Math.abs(lat) <= 90 && Math.abs(lng) <= 180
    ) {
      return { lat, lng };
    }
  } catch {
    // fall through: corrupt data is treated as "no stored location"
  }
  return null;
}
