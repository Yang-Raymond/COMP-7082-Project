
import { SavedRoute } from '../types/route';
import type { LatLng } from '../types/map';
import { parseLatLng } from './location';

const KEY = 'ghost-racer:routes';
const LAST_LOCATION_KEY = 'ghost-racer:last-location';

export async function getRoutes(): Promise<SavedRoute[]> {
  const raw = window.localStorage.getItem(KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function saveRoute(route: SavedRoute): Promise<void> {
  const routes = await getRoutes();
  routes.push(route);
  window.localStorage.setItem(KEY, JSON.stringify(routes));
}

export async function deleteRoute(id: string): Promise<void> {
  const routes = await getRoutes();
  window.localStorage.setItem(KEY, JSON.stringify(routes.filter((r) => r.id !== id)));
}

/** Returns the last location the app saw, or null if none is stored or the stored value is invalid. */
export async function getLastLocation(): Promise<LatLng | null> {
  try {
    return parseLatLng(window.localStorage.getItem(LAST_LOCATION_KEY));
  } catch {
    return null; // storage blocked (e.g. private mode)
  }
}

/** Persists the user's latest location so the map can open there on the next load. */
export async function saveLastLocation(pos: LatLng): Promise<void> {
  try {
    window.localStorage.setItem(LAST_LOCATION_KEY, JSON.stringify({ lat: pos.lat, lng: pos.lng }));
  } catch {
    // Best effort: losing the cached location only affects the next startup view.
  }
}
