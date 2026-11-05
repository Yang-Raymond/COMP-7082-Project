import { useCallback, useEffect, useRef, useState } from 'react';
import { computeGhostDelta } from '../services/ghostCompare';
import { GpsTracker } from '../services/gpsTracker';
import { GpsFix } from '../types/gps';
import { GhostDelta, SavedRoute } from '../types/route';

export function useGhostRace(route: SavedRoute) {
  const [racing, setRacing] = useState(false);
  const [current, setCurrent] = useState<GpsFix | null>(null);
  const [delta, setDelta] = useState<GhostDelta | null>(null);
  const trackerRef = useRef(new GpsTracker());
  const startTimeRef = useRef<number>(0);

  // Stop tracking if the screen closes mid-run, or background updates would keep going
  useEffect(() => {
    const tracker = trackerRef.current;
    return () => tracker.stop();
  }, []);

  const start = useCallback(async () => {
    startTimeRef.current = Date.now();
    setRacing(true);

    await trackerRef.current.start(
      (fix) => {
        setCurrent(fix);
        const elapsedMs = Date.now() - startTimeRef.current;
        setDelta(computeGhostDelta(route, fix.lat, fix.lng, elapsedMs));
      },
      (message) => console.warn('Race GPS error:', message),
      { background: true },
    );
  }, [route]);

  const stop = useCallback(() => {
    trackerRef.current.stop();
    setRacing(false);
  }, []);

  return { racing, current, delta, start, stop };
}