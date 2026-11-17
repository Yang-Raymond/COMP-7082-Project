// App-wide current location. 
// LocationProvider (mounted once in AppShell) keeps a single GPS watch running while the app is in the foreground, so GPS stays warm
// across screen switches and every map gets a live fix without a new cold start.
// It also seeds the position from the stored last location and the OS cached fix.
// The Android "turn on location" dialog is shown at most once.
// If location is enabled later, a services poll starts the watch without prompting again.
// If it is turned off, the same poll stops the watch and marks the position as no longer live.
// A user action (requestLocation) can show the dialog again on demand.
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
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
/** How often to re-check location services while the watch isn't running. */
const SERVICES_POLL_MS = 5_000;

const WATCH_OPTIONS: Location.LocationOptions = {
  accuracy: Location.Accuracy.High,
  timeInterval: 1000,
  distanceInterval: 0,
};

interface PositionState {
  position: LatLng | null;
  source: SourceRank;
}

interface LocationContextValue {
  position: LatLng | null;
  isLive: boolean;
  /**
   * User-initiated: asks for permission and, on Android, shows the "turn on location"
   * dialog if services are off, then starts the watch. Resolves true when location is usable.
   */
  requestLocation: () => Promise<boolean>;
}

const LocationContext = createContext<LocationContextValue>({
  position: null,
  isLive: false,
  requestLocation: async () => false,
});

const toLatLng = (f: GpsFix): LatLng => ({ lat: f.lat, lng: f.lng });

/**
 * Owns the shared GPS watch. On mount it offers the stored location, then (once
 * permission is granted) the OS cached fix, then starts the watch. The watch is
 * stopped while backgrounded and restarted on return to the foreground. 
 * LATER ITERATION: App keeps GPS active while backrounded while the user is recording a run or racing.
 */
export function LocationProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<PositionState>({ position: null, source: Source.None });
  const trackerRef = useRef<GpsTracker | null>(null);
  const startWatchRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    let cancelled = false;
    let lastSave = 0;
    let starting = false;
    const tracker = new GpsTracker();
    trackerRef.current = tracker;

    const offer = (pos: LatLng | null, source: SourceRank) => {
      if (cancelled || !pos) return;
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

    // Starts the watch if location permission is granted.
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
      await tracker.start(onFix, (msg) => console.warn('Location watch error:', msg), { watch: WATCH_OPTIONS });
      if (cancelled) tracker.stop(); 
    };

    startWatchRef.current = startWatch;

    getLastLocation().then((p) => offer(p, Source.Stored)).catch(() => {});
    startWatch().catch(() => {});

    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') startWatch().catch(() => {});
      else if (next === 'background') tracker.stop();
    });

    /*
    * Picks up location being turned on or off. 
    * When turned off, the watch silently stops delivering fixes, so it is stopped and
    * the position downgraded from live and hides the user's dot. When turned back on, restarts the
    * watch. Only checks services, so it never shows a permission or settings dialog.
    */
    const servicesPoll = setInterval(async () => {
      if (starting || AppState.currentState !== 'active') return;
      const enabled = await Location.hasServicesEnabledAsync().catch(() => false);
      if (cancelled) return;
      if (tracker.isTracking) {
        if (!enabled) {
          tracker.stop();
          // Keep the last position for the camera.
          setState((prev) => (prev.position ? { position: prev.position, source: Source.LastKnown } : prev));
        }
      } else if (enabled) {
        startWatch().catch(() => {});
      }
    }, SERVICES_POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(servicesPoll);
      sub.remove();
      tracker.stop();
    };
  }, []);

  const requestLocation = useCallback(async () => {
    const tracker = trackerRef.current;
    if (!tracker) return false;
    if (!(await tracker.requestPermission())) return false;
    if (!(await tracker.ensureServicesEnabled(true))) return false;
    await startWatchRef.current().catch(() => {});
    return true;
  }, []);

  const value = { position: state.position, isLive: state.source === Source.Live, requestLocation };
  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

/** Returns the current position and whether it is live. */
export function useCurrentPosition() {
  return useContext(LocationContext);
}
