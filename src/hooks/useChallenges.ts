// Loads the routes other people shared with me (public + friends') and who made each one, in one place,
// so the Explore screen, the Challenges screen and the tab badge all read the same data.
// A "challenge" is a route made by a friend. There is no separate challenge record on the server yet.
// Routes made by a friend I've muted are left out everywhere, so their challenges never show up for me.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getFeed, getFriends, type SharedRoute } from '../services/friends';
import { fetchSharedRoutes } from '../services/serverRoutes';
import type { SavedRoute } from '../types/route';

/** Who made a shared route, and whether they're my friend. Comes from /friends/feed, matched by route id. */
export type Info = { creator: string; byFriend: boolean };

// The tab badge counts friends' routes from the last day
const NEW_WINDOW_MS = 24 * 60 * 60 * 1000;

export function useChallenges(userId?: number) {
  const [allShared, setAllShared] = useState<SavedRoute[]>([]);
  const [info, setInfo] = useState<Record<string, Info>>({});
  const [mutedNames, setMutedNames] = useState<Set<string>>(new Set()); // lower-case usernames I've muted
  const latest = useRef(0);

  const reload = useCallback(async () => {
    const mine = ++latest.current;
    if (!userId) {
      setAllShared([]);
      setInfo({});
      setMutedNames(new Set());
      return;
    }
    try {
      // The feed only adds names, and the friends list only adds mutes; if either fails the routes still load
      const [list, feed, friends] = await Promise.all([
        fetchSharedRoutes(),
        getFeed('all').catch(() => [] as SharedRoute[]),
        getFriends().catch(() => null),
      ]);
      if (mine !== latest.current) return; // a newer load (or a different user) took over
      const next: Record<string, Info> = {};
      for (const f of feed) next[String(f.id)] = { creator: f.creator, byFriend: !!f.by_friend };
      setAllShared(list);
      setInfo(next);
      if (friends) setMutedNames(new Set(friends.filter((f) => f.muted).map((f) => f.username.toLowerCase())));
    } catch (e) {
      console.warn('[challenges] could not load shared routes', e);
      if (mine === latest.current) {
        setAllShared([]);
        setInfo({});
      }
    }
  }, [userId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const infoOf = useCallback((r: SavedRoute) => info[r.id.replace(/^server-/, '')], [info]);

  // Shared routes without the ones made by someone I've muted
  const shared = useMemo(
    () =>
      allShared.filter((r) => {
        const who = info[r.id.replace(/^server-/, '')]?.creator?.toLowerCase();
        return !who || !mutedNames.has(who);
      }),
    [allShared, info, mutedNames]
  );

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