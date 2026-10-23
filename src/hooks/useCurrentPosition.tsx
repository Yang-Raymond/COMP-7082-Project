// App-wide current location. LocationProvider (mounted once in AppShell) keeps a
// single GPS watch running while the app is in the foreground, so GPS stays warm
// across screen switches and every map gets a live fix without a new cold start.
// It also seeds the position from the stored last location and the OS cached fix.
import React, { createContext, useContext, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import * as Location from 'expo-location';
import { GpsTracker } from '../services/gpsTracker';
import { getLastLocation, saveLastLocation } from '../services/storage';
import type { GpsFix } from '../types/gps';
import type { LatLng } from '../types/map';

// Higher number = more trustworthy source; a lower one never overwrites a higher one.
const Source = { None: 0, Stored: 1, LastKnown: 2, Live: 3 } as const;
type SourceRank = (typeof Source)[keyof typeof Source];

/** A cached OS fix this recent and accurate is treated as live. */
const FRESH_MAX_AGE_MS = 15_000;
const FRESH_MAX_ACCURACY_M = 50;
/** Minimum gap between persisted location writes. */
const SAVE_INTERVAL_MS = 30_000;

const WATCH_OPTIONS: Location.LocationOptions = {
  accuracy: Location.Accuracy.High,
  timeInterval: 1000,
  distanceInterval: 0,
};

interface PositionState {
  position: LatLng | null;
  source: SourceRank;
}

const LocationContext = createContext<{ position: LatLng | null; isLive: boolean }>({
  position: null,
  isLive: false,
});

const toLatLng = (f: GpsFix): LatLng => ({ lat: f.lat, lng: f.lng });

/**
 * Owns the shared GPS watch. On mount it offers the stored location, then (once
 * permission is granted) the OS cached fix, then starts the watch. The watch is
 * stopped while backgrounded and restarted on return to the foreground.
 */
export function LocationProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<PositionState>({ position: null, source: Source.None });

  useEffect(() => {
    let cancelled = false;
    let lastSave = 0;
    let starting = false; // guards overlapping starts (mount + foreground event)
    const tracker = new GpsTracker();

    const offer = (pos: LatLng | null, source: SourceRank) => {
      if (cancelled || !pos) return;
      // Live fixes always replace each other; other sources only fill in until something better lands.
      setState((prev) =>
        source > prev.source || source === Source.Live ? { position: pos, source } : prev
      );
    };

    const onFix = (fix: GpsFix) => {
      const pos = toLatLng(fix);
      offer(pos, Source.Live);
      const now = Date.now();
      if (now - lastSave >= SAVE_INTERVAL_MS) {
        lastSave = now;
        saveLastLocation(pos).catch(() => {});
      }
    };

    // Starts the watch if permission is granted; no-op if already running.
    const startWatch = async () => {
      if (starting || tracker.isTracking) return;
      starting = true;
      try {
        await startWatchOnce();
      } finally {
        starting = false;
      }
    };

    const startWatchOnce = async () => {
      if (cancelled || !(await tracker.requestPermission()) || cancelled) return;
      const cached = await tracker.getLastKnown();
      if (cached) {
        const fresh =
          Date.now() - cached.timestamp <= FRESH_MAX_AGE_MS &&
          (cached.accuracy ?? Infinity) <= FRESH_MAX_ACCURACY_M;
        offer(toLatLng(cached), fresh ? Source.Live : Source.LastKnown);
      }
      if (cancelled) return;
      await tracker.start(onFix, (msg) => console.warn('Location watch error:', msg), WATCH_OPTIONS);
      if (cancelled) tracker.stop(); // unmounted while start() was pending
    };

    getLastLocation().then((p) => offer(p, Source.Stored)).catch(() => {});
    startWatch().catch(() => {});

    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') startWatch().catch(() => {});
      else if (next === 'background') tracker.stop();
    });

    return () => {
      cancelled = true;
      sub.remove();
      tracker.stop();
    };
  }, []);

  const value = { position: state.position, isLive: state.source === Source.Live };
  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

/** Current best-known position and whether it comes from a live (fresh) fix. */
export function useCurrentPosition() {
  return useContext(LocationContext);
}
