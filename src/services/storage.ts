// Native local persistence (AsyncStorage): saved routes, onboarding flag and last known location.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SavedRoute } from '../types/route';
import type { LatLng } from '../types/map';
import { parseLatLng } from './location';

const KEY = 'ghost-racer:routes';
const LAST_LOCATION_KEY = 'ghost-racer:last-location';

export async function getRoutes(): Promise<SavedRoute[]> {
  const raw = await AsyncStorage.getItem(KEY);
  return raw ? JSON.parse(raw) : [];
}

// Every change reads the whole list and writes it back. Running changes one at a time stops a background
// upload marking one route as uploaded from overwriting another route saved at the same moment.
let lastChange: Promise<void> = Promise.resolve();

function changeRoutes(change: (routes: SavedRoute[]) => SavedRoute[]): Promise<void> {
  const next = lastChange.then(async () => {
    await AsyncStorage.setItem(KEY, JSON.stringify(change(await getRoutes())));
  });
  lastChange = next.catch(() => {}); // one failed write mustn't block the ones after it
  return next;
}

export async function saveRoute(route: SavedRoute): Promise<void> {
  await changeRoutes((routes) => [...routes, route]);
}

export async function deleteRoute(id: string): Promise<void> {
  await changeRoutes((routes) => routes.filter((r) => r.id !== id));
}

/** Changes some fields of one saved route, such as its upload state. Does nothing if it was deleted. */
export async function updateRoute(id: string, patch: Partial<SavedRoute>): Promise<void> {
  await changeRoutes((routes) => routes.map((r) => (r.id === id ? { ...r, ...patch } : r)));
}

/** Returns the last location the app saw, or null if none is stored or the stored value is invalid. */
export async function getLastLocation(): Promise<LatLng | null> {
  return parseLatLng(await AsyncStorage.getItem(LAST_LOCATION_KEY));
}

/** Persists the user's latest location so the map can open there on the next launch. */
export async function saveLastLocation(pos: LatLng): Promise<void> {
  await AsyncStorage.setItem(LAST_LOCATION_KEY, JSON.stringify({ lat: pos.lat, lng: pos.lng }));
}
const ONBOARDED_KEY = 'ghost-racer:onboarded';

export async function hasOnboarded(): Promise<boolean> {
  return (await AsyncStorage.getItem(ONBOARDED_KEY)) === '1';
}

export async function markOnboarded(): Promise<void> {
  await AsyncStorage.setItem(ONBOARDED_KEY, '1');
}

/** Any JSON value saved under `key`, or null if nothing has been saved yet. */
export async function readJSON<T>(key: string): Promise<T | null> {
  const raw = await AsyncStorage.getItem(key);
  return raw ? (JSON.parse(raw) as T) : null;
}

export async function writeJSON(key: string, value: unknown): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}
