import { useCallback, useRef, useState } from 'react';
import { GpsTracker } from '../services/gpsTracker';
import { saveRoute } from '../services/storage';
import { totalDistance } from '../services/distance';
import { RoutePoint, SavedRoute } from '../types/route';

export function useRouteRecorder() {
  const [recording, setRecording] = useState(false);
  const [points, setPoints] = useState<RoutePoint[]>([]);
  const trackerRef = useRef(new GpsTracker());
  const startTimeRef = useRef<number>(0);

  const start = useCallback(async () => {
    setPoints([]);
    startTimeRef.current = Date.now();
    setRecording(true);

    await trackerRef.current.start(
      (fix) => {
        setPoints((prev) => [
          ...prev,
          { lat: fix.lat, lng: fix.lng, t: Date.now() - startTimeRef.current },
        ]);
      },
      (message) => console.warn('Recorder GPS error:', message)
    );
  }, []);

  const stop = useCallback(() => {
    trackerRef.current.stop();
    setRecording(false);
  }, []);

  const save = useCallback(
    async (name: string): Promise<SavedRoute> => {
      const route: SavedRoute = {
        id: `${Date.now()}`,
        name,
        createdAt: Date.now(),
        points,
        distanceMeters: totalDistance(points.map((p) => ({ lat: p.lat, lng: p.lng }))),
        durationMs: points.length ? points[points.length - 1].t : 0,
      };
      await saveRoute(route);
      return route;
    },
    [points]
  );

  return { recording, points, start, stop, save };
}