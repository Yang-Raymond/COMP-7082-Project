// Loads the routes other people shared with the user (public + friends') and who made each one, in one place,
// so the Explore and Friends screens read the same data. These are plain shared routes, not challenges.
// Routes made by a friend the user has muted are left out everywhere.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getFeed, getFriends, type SharedRoute } from '../services/friends';
import { fetchSharedRoutes } from '../services/serverRoutes';
import type { SavedRoute } from '../types/route';

/** Who made a shared route, and whether they're the user's friend. */
export type Info = { creator: string; byFriend: boolean };

/**
 * Loads shared routes, the creator info for each, and usermuted friends' names, then exposes them
 * (muted creators filtered out) together with a reload function. Pass the signed-in user's id. Without one, the lists are empty and the reload function does nothing.
 */
export function useSharedRoutes(userId?: number) {
  const [allShared, setAllShared] = useState<SavedRoute[]>([]);
  const [info, setInfo] = useState<Record<string, Info>>({});
  const [mutedNames, setMutedNames] = useState<Set<string>>(new Set());
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
      // The feed only adds names, and the friends list only adds mutes. If either fails the routes still load
      const [list, feed, friends] = await Promise.all([
        fetchSharedRoutes(),
        getFeed('all').catch(() => [] as SharedRoute[]),
        getFriends().catch(() => null),
      ]);
      if (mine !== latest.current) return;
      const next: Record<string, Info> = {};
      for (const f of feed) next[String(f.id)] = { creator: f.creator, byFriend: !!f.by_friend };
      setAllShared(list);
      setInfo(next);
      if (friends) setMutedNames(new Set(friends.filter((f) => f.muted).map((f) => f.username.toLowerCase())));
    } catch (e) {
      console.warn('[sharedRoutes] could not load shared routes', e);
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

  // Shared routes without muted users
  const shared = useMemo(
    () =>
      allShared.filter((r) => {
        const who = info[r.id.replace(/^server-/, '')]?.creator?.toLowerCase();
        return !who || !mutedNames.has(who);
      }),
    [allShared, info, mutedNames]
  );

  const friendRoutes = useMemo(
    () => shared.filter((r) => info[r.id.replace(/^server-/, '')]?.byFriend).sort((a, b) => b.createdAt - a.createdAt),
    [shared, info]
  );

  return { shared, info, infoOf, friendRoutes, reload };
}

export type SharedRoutes = ReturnType<typeof useSharedRoutes>;
