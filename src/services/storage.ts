
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

export async function saveRoute(route: SavedRoute): Promise<void> {
  const routes = await getRoutes();
  routes.push(route);
  await AsyncStorage.setItem(KEY, JSON.stringify(routes));
}

export async function deleteRoute(id: string): Promise<void> {
  const routes = await getRoutes();
  await AsyncStorage.setItem(KEY, JSON.stringify(routes.filter((r) => r.id !== id)));
}

/** Returns the last location the app saw, or null if none is stored or the stored value is invalid. */
export async function getLastLocation(): Promise<LatLng | null> {
  return parseLatLng(await AsyncStorage.getItem(LAST_LOCATION_KEY));
}

/** Persists the user's latest location so the map can open there on the next launch. */
export async function saveLastLocation(pos: LatLng): Promise<void> {
  await AsyncStorage.setItem(LAST_LOCATION_KEY, JSON.stringify({ lat: pos.lat, lng: pos.lng }));
}
