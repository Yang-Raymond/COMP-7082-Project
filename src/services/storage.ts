
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SavedRoute } from '../types/route';

const KEY = 'ghost-racer:routes';

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

const ONBOARDED_KEY = 'ghost-racer:onboarded';

export async function hasOnboarded(): Promise<boolean> {
  return (await AsyncStorage.getItem(ONBOARDED_KEY)) === '1';
}

export async function markOnboarded(): Promise<void> {
  await AsyncStorage.setItem(ONBOARDED_KEY, '1');
}
