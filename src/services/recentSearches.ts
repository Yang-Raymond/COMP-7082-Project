// The last few things a person searched for or opened from search, kept per account on this phone.
// Uses expo-secure-store (already installed for login) on the phone and localStorage in the browser.
// Only a few short strings are saved, well under SecureStore's 2 KB limit.
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const MAX_ITEMS = 8;
const MAX_LENGTH = 40;

const key = (userId: number) => `ghostracer_recent_${userId}`;
const ls = () => (globalThis as any).localStorage as Storage | undefined;

async function read(k: string): Promise<string | null> {
  return Platform.OS === 'web' ? (ls()?.getItem(k) ?? null) : SecureStore.getItemAsync(k);
}
async function write(k: string, v: string): Promise<void> {
  if (Platform.OS === 'web') ls()?.setItem(k, v);
  else await SecureStore.setItemAsync(k, v);
}
async function remove(k: string): Promise<void> {
  if (Platform.OS === 'web') ls()?.removeItem(k);
  else await SecureStore.deleteItemAsync(k);
}

export async function getRecents(userId: number): Promise<string[]> {
  try {
    const list = JSON.parse((await read(key(userId))) ?? '[]');
    return Array.isArray(list) ? list.filter((x) => typeof x === 'string').slice(0, MAX_ITEMS) : [];
  } catch {
    return [];
  }
}

/** Puts `text` at the top (no duplicates, any letter case) and returns the new list. */
export async function addRecent(userId: number, text: string): Promise<string[]> {
  const t = text.trim().slice(0, MAX_LENGTH);
  const current = await getRecents(userId);
  if (!t) return current;
  const next = [t, ...current.filter((x) => x.toLowerCase() !== t.toLowerCase())].slice(0, MAX_ITEMS);
  try {
    await write(key(userId), JSON.stringify(next));
  } catch {
    /* losing a recent search isn't worth an error */
  }
  return next;
}

export async function clearRecents(userId: number): Promise<void> {
  try {
    await remove(key(userId));
  } catch {
    /* ignore */
  }
}