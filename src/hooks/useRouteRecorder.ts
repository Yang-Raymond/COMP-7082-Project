// Route recording state machine (idle/recording/paused) built on GpsTracker.
// Filters low-quality GPS fixes, produces a RouteDraft and saves it as a SavedRoute.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GpsTracker } from '../services/gpsTracker';
import { saveLastLocation, saveRoute } from '../services/storage';
import { totalDistance } from '../services/distance';
import { AcceptedFix, checkFix } from '../services/fixFilter';
import { elevationGain } from '../services/elevation';
import { ActivityType, RoutePoint, SavedRoute } from '../types/route';

export type RecorderStatus = 'idle' | 'recording' | 'paused';


export interface RouteDraft {
  points: RoutePoint[];
  durationMs: number;
  distanceMeters: number;
  elevationGainMeters: number;
  activity: ActivityType;
}

/**
 * Records GPS points while status is "recording", tracking active time (excluding pauses),
 * distance and elevation gain. Each incoming fix is vetted by checkFix (stale, inaccurate,
 * jitter and implausible-speed fixes are dropped) before it becomes a point.
 * finish() stops GPS and returns the draft.
 */
export function useRouteRecorder() {
  const [status, setStatus] = useState<RecorderStatus>('idle');
  const [activity, setActivity] = useState<ActivityType>('run');
  const [points, setPoints] = useState<RoutePoint[]>([]);
  const [elapsedMs, setElapsedMs] = useState(0);

  const trackerRef = useRef(new GpsTracker());
  const statusRef = useRef<RecorderStatus>('idle');
  const accumulatedRef = useRef(0); 
  const segmentStartRef = useRef(0);
  const startedAtRef = useRef(0);
  const lastAcceptedRef = useRef<AcceptedFix | undefined>(undefined); 
  const activityRef = useRef<ActivityType>('run'); 

  const changeStatus = (s: RecorderStatus) => {
    statusRef.current = s;
    setStatus(s);
  };

  /** Active recording time in ms: accumulated time from earlier segments plus the current one (pauses excluded). */
  const activeMs = () =>
    accumulatedRef.current +
    (statusRef.current === 'recording' ? Date.now() - segmentStartRef.current : 0);

  // Keep the ref in sync so the once-created fix callback sees the current activity.
  useEffect(() => {
    activityRef.current = activity;
  }, [activity]);

  useEffect(() => {
    if (status !== 'recording') return;
    const id = setInterval(() => setElapsedMs(activeMs()), 500);
    return () => clearInterval(id);
  }, [status]);

  /** Resets recording state, then starts the GPS watch. Accepted fixes are appended as points. */
  const start = useCallback(async () => {
    setPoints([]);
    setElapsedMs(0);
    accumulatedRef.current = 0;
    segmentStartRef.current = Date.now();
    startedAtRef.current = Date.now();
    lastAcceptedRef.current = undefined;
    changeStatus('recording');

    await trackerRef.current.start(
      (fix) => {
        if (statusRef.current !== 'recording') return;
        const rejection = checkFix(
          fix,
          lastAcceptedRef.current,
          startedAtRef.current,
          activityRef.current
        );
        if (rejection) {
          // Remove later only for debugging. The user doesn't need to see this in production.
          if (__DEV__) console.debug('Fix rejected:', rejection, 'accuracy:', fix.accuracy);
          return;
        }
        lastAcceptedRef.current = { lat: fix.lat, lng: fix.lng, timestamp: fix.timestamp };
        setPoints((prev) => [
          ...prev,
          { lat: fix.lat, lng: fix.lng, t: activeMs(), alt: fix.altitude ?? undefined },
        ]);
      },
      (message) => {
        console.warn('Recorder GPS error:', message);
        changeStatus('idle'); 
      }
    );
  }, []);

  /** Freezes the active-time total and stops appending points until resume(). */
  const pause = useCallback(() => {
    accumulatedRef.current = activeMs();
    changeStatus('paused');
    setElapsedMs(accumulatedRef.current);
  }, []);

  /** Starts a new timing segment and resumes appending points. */
  const resume = useCallback(() => {
    segmentStartRef.current = Date.now();
    changeStatus('recording');
  }, []);

  const distanceMeters = useMemo(
    () => totalDistance(points.map((p) => ({ lat: p.lat, lng: p.lng }))),
    [points]
  );

  
  const elevationGainMeters = useMemo(() => elevationGain(points), [points]);

  /** Stops the GPS watch and returns the recorded points and stats as a RouteDraft. */
  const finish = useCallback((): RouteDraft => {
    const durationMs = activeMs();
    trackerRef.current.stop();
    changeStatus('idle');
    return { points, durationMs, distanceMeters, elevationGainMeters, activity };
  }, [points, distanceMeters, elevationGainMeters, activity]);

  return {
    status,
    activity,
    setActivity,
    points,
    elapsedMs,
    distanceMeters,
    elevationGainMeters,
    start,
    pause,
    resume,
    finish,
  };
}

/** Persists a draft as a SavedRoute and remembers its end point as the last known location. */
export async function saveDraft(draft: RouteDraft, name: string): Promise<SavedRoute> {
  const route: SavedRoute = {
    id: `${Date.now()}`,
    name,
    createdAt: Date.now(),
    points: draft.points,
    distanceMeters: draft.distanceMeters,
    durationMs: draft.durationMs,
    elevationGainMeters: draft.elevationGainMeters,
    activity: draft.activity,
  };
  await saveRoute(route);
  const end = draft.points[draft.points.length - 1];
  if (end) await saveLastLocation({ lat: end.lat, lng: end.lng });
  return route;
}