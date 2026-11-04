// Live ghost race: watches GPS and computes the ahead/behind delta against a saved route.
import { useCallback, useRef, useState } from 'react';
import { GpsTracker } from '../services/gpsTracker';
import { computeGhostDelta } from '../services/ghostCompare';
import { GhostDelta, SavedRoute } from '../types/route';
import { GpsFix } from '../types/gps';

/** Starts/stops a GPS watch and updates the current fix and ghost delta on each fix. */
export function useGhostRace(route: SavedRoute) {
  const [racing, setRacing] = useState(false);
  const [current, setCurrent] = useState<GpsFix | null>(null);
  const [delta, setDelta] = useState<GhostDelta | null>(null);
  const trackerRef = useRef(new GpsTracker());
  const startTimeRef = useRef<number>(0);

  const start = useCallback(async () => {
    startTimeRef.current = Date.now();
    setRacing(true);

    await trackerRef.current.start(
      (fix) => {
        setCurrent(fix);
        const elapsedMs = Date.now() - startTimeRef.current;
        setDelta(computeGhostDelta(route, fix.lat, fix.lng, elapsedMs));
      },
      (message) => console.warn('Race GPS error:', message)
    );
  }, [route]);

  const stop = useCallback(() => {
    trackerRef.current.stop();
    setRacing(false);
  }, []);

  return { racing, current, delta, start, stop };
}