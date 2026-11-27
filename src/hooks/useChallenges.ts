// Loads the signed-in user's challenges (To race, Sent, Finished) from the server, in one place,
// so the Challenges screen and the tab badge read the same data.
import { useCallback, useEffect, useRef, useState } from 'react';
import { getChallenges } from '../services/challenges';
import type { ChallengeLists } from '../types/challenge';

const EMPTY: ChallengeLists = { toRace: [], sent: [], finished: [] };

/**
 * Loads the challenge lists for `userId` and exposes them with a loading flag,
 * an error message (null when fine), a reload function and the To race count for the tab badge.
 * A load that finishes after a newer one started, or after the user changed, is ignored. The lists stay on
 * screen during a reload. Only the first load reports `loading`.
 */
export function useChallenges(userId?: number) {
  const [lists, setLists] = useState<ChallengeLists>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef(0);

  const reload = useCallback(async () => {
    const mine = ++latest.current;
    if (!userId) {
      setLists(EMPTY);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const next = await getChallenges();
      if (mine !== latest.current) return;
      setLists(next);
      setError(null);
    } catch (e) {
      console.warn('[challenges] could not load challenges', e);
      if (mine === latest.current) setError(e instanceof Error && e.message ? e.message : "Couldn't load challenges.");
    } finally {
      if (mine === latest.current) setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { ...lists, loading, error, reload, toRaceCount: lists.toRace.length };
}

export type Challenges = ReturnType<typeof useChallenges>;
