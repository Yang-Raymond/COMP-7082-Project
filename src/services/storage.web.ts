
import { SavedRoute } from '../types/route';

const KEY = 'ghost-racer:routes';

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

const ONBOARDED_KEY = 'ghost-racer:onboarded';

export async function hasOnboarded(): Promise<boolean> {
  return window.localStorage.getItem(ONBOARDED_KEY) === '1';
}

export async function markOnboarded(): Promise<void> {
  window.localStorage.setItem(ONBOARDED_KEY, '1');
}
