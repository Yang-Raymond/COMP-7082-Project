// Loads the routes other people shared with me (public + friends') and who made each one, in one place,
// so the Explore screen, the Challenges screen and the tab badge all read the same data.
// A "challenge" is a route made by a friend. There is no separate challenge record on the server yet.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getFeed, type SharedRoute } from '../services/friends';
import { fetchSharedRoutes } from '../services/serverRoutes';
import type { SavedRoute } from '../types/route';

/** Who made a shared route, and whether they're my friend. Comes from /friends/feed, matched by route id. */
export type Info = { creator: string; byFriend: boolean };

// The tab badge counts friends' routes from the last day
const NEW_WINDOW_MS = 24 * 60 * 60 * 1000;

export function useChallenges(userId?: number) {
  const [shared, setShared] = useState<SavedRoute[]>([]);
  const [info, setInfo] = useState<Record<string, Info>>({});
  const latest = useRef(0);

  const reload = useCallback(async () => {
    const mine = ++latest.current;
    if (!userId) {
      setShared([]);
      setInfo({});
      return;
    }
    try {
      // The feed only adds names; if it fails the routes still load
      const [list, feed] = await Promise.all([fetchSharedRoutes(), getFeed('all').catch(() => [] as SharedRoute[])]);
      if (mine !== latest.current) return; // a newer load (or a different user) took over
      const next: Record<string, Info> = {};
      for (const f of feed) next[String(f.id)] = { creator: f.creator, byFriend: !!f.by_friend };
      setShared(list);
      setInfo(next);
    } catch (e) {
      console.warn('[challenges] could not load shared routes', e);
      if (mine === latest.current) {
        setShared([]);
        setInfo({});
      }
    }
  }, [userId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const infoOf = useCallback((r: SavedRoute) => info[r.id.replace(/^server-/, '')], [info]);

  const friendChallenges = useMemo(
    () => shared.filter((r) => info[r.id.replace(/^server-/, '')]?.byFriend).sort((a, b) => b.createdAt - a.createdAt),
    [shared, info]
  );

  const newCount = useMemo(
    () => friendChallenges.filter((r) => Date.now() - r.createdAt < NEW_WINDOW_MS).length,
    [friendChallenges]
  );

  return { shared, info, infoOf, friendChallenges, newCount, reload };
}

export type Challenges = ReturnType<typeof useChallenges>;