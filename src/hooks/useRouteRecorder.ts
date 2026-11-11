// Route recording state machine (idle/recording/paused) built on GpsTracker; produces a RouteDraft and saves it as a SavedRoute.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GpsTracker } from '../services/gpsTracker';
import { saveLastLocation, saveRoute } from '../services/storage';
import { totalDistance } from '../services/distance';
import { elevationGain } from '../services/elevation';
import { makeUuid } from '../services/uuid';
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
 * distance and elevation gain. finish() stops GPS and returns the draft.
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

  // Stop tracking if the screen closes mid-run, or background updates would keep going
  useEffect(() => {
    const tracker = trackerRef.current;
    return () => tracker.stop();
  }, []);

  const changeStatus = (s: RecorderStatus) => {
    statusRef.current = s;
    setStatus(s);
  };

  
  const activeMs = () =>
    accumulatedRef.current +
    (statusRef.current === 'recording' ? Date.now() - segmentStartRef.current : 0);

  useEffect(() => {
    if (status !== 'recording') return;
    const id = setInterval(() => setElapsedMs(activeMs()), 500);
    return () => clearInterval(id);
  }, [status]);

  const start = useCallback(async () => {
    setPoints([]);
    setElapsedMs(0);
    accumulatedRef.current = 0;
    segmentStartRef.current = Date.now();
    changeStatus('recording');

    await trackerRef.current.start(
      (fix) => {
        if (statusRef.current !== 'recording') return;
        setPoints((prev) => [
          ...prev,
          { lat: fix.lat, lng: fix.lng, t: activeMs(), alt: fix.altitude ?? undefined },
        ]);
      },
      (message) => {
        console.warn('Recorder GPS error:', message);
        changeStatus('idle'); 
      },
      { background: true },
    );
  }, []);

  const pause = useCallback(() => {
    accumulatedRef.current = activeMs();
    changeStatus('paused');
    setElapsedMs(accumulatedRef.current);
  }, []);

  const resume = useCallback(() => {
    segmentStartRef.current = Date.now();
    changeStatus('recording');
  }, []);

  const distanceMeters = useMemo(
    () => totalDistance(points.map((p) => ({ lat: p.lat, lng: p.lng }))),
    [points]
  );

  
  const elevationGainMeters = useMemo(() => elevationGain(points), [points]);

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

/**
 * Persists a draft as a SavedRoute and remembers its end point as the last known location.
 * With `upload` and the signed-in account's `ownerId`, the route is also marked to be uploaded;
 * call uploadPendingRoutes() afterwards.
 */
export async function saveDraft(
  draft: RouteDraft,
  name: string,
  opts: { upload?: boolean; ownerId?: number } = {}
): Promise<SavedRoute> {
  // Uploading needs an account, and the server needs at least two points to make a route;
  // otherwise the route just stays on the phone
  const upload = Boolean(opts.upload) && opts.ownerId != null && draft.points.length >= 2;
  const route: SavedRoute = {
    id: `${Date.now()}`,
    name,
    createdAt: Date.now(),
    points: draft.points,
    distanceMeters: draft.distanceMeters,
    durationMs: draft.durationMs,
    elevationGainMeters: draft.elevationGainMeters,
    activity: draft.activity,
    ...(upload ? { clientId: makeUuid(), ownerId: opts.ownerId, upload: { state: 'pending' as const } } : {}),
  };
  await saveRoute(route);
  const end = draft.points[draft.points.length - 1];
  if (end) await saveLastLocation({ lat: end.lat, lng: end.lng });
  return route;
}