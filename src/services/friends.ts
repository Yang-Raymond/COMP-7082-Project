import { readJSON, writeJSON } from './storage';

export interface Friend {
  id: string;
  name: string;
  username: string;
  /** Their challenges don't notify you. */
  muted?: boolean;
}

const KEY = 'ghost-racer:friends';

// The server has no friends table yet, so the list is kept on this device.
// It starts with the three friends from the Figma so the screen has something to show.
const STARTER: Friend[] = [
  { id: 'jin', name: 'Jin', username: 'jin' },
  { id: 'russell', name: 'Russell', username: 'russell' },
  { id: 'raymond', name: 'Raymond', username: 'raymond' },
];

export async function getFriends(): Promise<Friend[]> {
  return (await readJSON<Friend[]>(KEY)) ?? STARTER;
}

export async function removeFriend(id: string): Promise<Friend[]> {
  const next = (await getFriends()).filter((f) => f.id !== id);
  await writeJSON(KEY, next);
  return next;
}

export async function setMuted(id: string, muted: boolean): Promise<Friend[]> {
  const next = (await getFriends()).map((f) => (f.id === id ? { ...f, muted } : f));
  await writeJSON(KEY, next);
  return next;
}
