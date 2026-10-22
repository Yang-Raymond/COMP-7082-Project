import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GpsTracker } from '../services/gpsTracker';
import { saveLastLocation, saveRoute } from '../services/storage';
import { totalDistance } from '../services/distance';
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

export function useRouteRecorder() {
  const [status, setStatus] = useState<RecorderStatus>('idle');
  const [activity, setActivity] = useState<ActivityType>('run');
  const [points, setPoints] = useState<RoutePoint[]>([]);
  const [elapsedMs, setElapsedMs] = useState(0);

  const trackerRef = useRef(new GpsTracker());
  const statusRef = useRef<RecorderStatus>('idle');
  const accumulatedRef = useRef(0); 
  const segmentStartRef = useRef(0);

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
      }
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