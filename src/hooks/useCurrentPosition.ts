// Resolves where the map should be centered on screen open: the last stored
// location immediately, then the OS's cached fix, then a fresh GPS fix. The
// fresh fix is persisted so the next launch opens at the user's latest spot.
import { useEffect, useState } from 'react';
import { GpsTracker } from '../services/gpsTracker';
import { getLastLocation, saveLastLocation } from '../services/storage';
import type { LatLng } from '../types/map';

// Higher number = more trustworthy source; a lower one never overwrites a higher one.
const Source = { None: 0, Stored: 1, LastKnown: 2, Live: 3 } as const;
type SourceRank = (typeof Source)[keyof typeof Source];

/**
 * Reads the stored location at once; after location permission is granted, reads
 * the OS cached fix and a fresh fix in parallel. Keeps the best result seen so far.
 * `position` is null only until the first source resolves (or forever, on a
 * first launch with no permission). `isLive` is true once a fresh fix arrived.
 */
export function useCurrentPosition() {
  const [state, setState] = useState<{ position: LatLng | null; source: SourceRank }>({
    position: null,
    source: Source.None,
  });

  useEffect(() => {
    let cancelled = false;
    const tracker = new GpsTracker();

    const offer = (pos: LatLng | null, source: SourceRank) => {
      if (cancelled || !pos) return;
      setState((prev) => (source > prev.source ? { position: pos, source } : prev));
    };

    getLastLocation().then((p) => offer(p, Source.Stored)).catch(() => {});

    // GPS lookups wait for permission so a fresh install still gets the OS cached
    // fix right after the user allows location (resolves instantly if already granted).
    tracker.requestPermission().then((granted) => {
      if (!granted || cancelled) return;
      tracker.getLastKnown().then((f) => offer(f && { lat: f.lat, lng: f.lng }, Source.LastKnown));
      tracker.getCurrent().then((f) => {
        if (!f) return;
        const pos = { lat: f.lat, lng: f.lng };
        offer(pos, Source.Live);
        saveLastLocation(pos).catch(() => {});
      });
    }).catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  return { position: state.position, isLive: state.source === Source.Live };
}
