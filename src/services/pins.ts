import { readJSON, writeJSON } from './storage';

// Ids of the saved routes pinned to the top of the You tab, in the order they were pinned
const KEY = 'ghost-racer:pinned';

export async function getPinnedIds(): Promise<string[]> {
  return (await readJSON<string[]>(KEY)) ?? [];
}

export async function savePinnedIds(ids: string[]): Promise<void> {
  await writeJSON(KEY, ids);
}
