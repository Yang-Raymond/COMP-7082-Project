
import { useCallback, useRef, useState } from "react";
import { GpsTracker } from "../services/gpsTracker";
import { postFix, testConnection } from "../services/backendClient";
import { totalDistance } from "../services/distance";
import { buildGpx } from "../services/gpxExport";
import { GpsFix, LogEntry, TrackingStatus } from "../types/gps";

const STALE_AFTER_MS = 5000;

export function useGpsTracking() {
  const [status, setStatus] = useState<TrackingStatus>("idle");
  const [fixes, setFixes] = useState<GpsFix[]>([]);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [endpoint, setEndpoint] = useState("");

  const trackerRef = useRef(new GpsTracker());

  const addLog = useCallback((message: string, level: LogEntry["level"] = "info") => {
    setLog((prev) => [{ time: Date.now(), message, level }, ...prev].slice(0, 200));
  }, []);

  const handleFix = useCallback(
    (fix: GpsFix) => {
      setStatus("live");
      setFixes((prev) => [...prev, fix]);
      addLog(
        `${fix.lat.toFixed(5)}, ${fix.lng.toFixed(5)} · ±${Math.round(fix.accuracy ?? 0)}m`,
        (fix.accuracy ?? 0) > 25 ? "warn" : "ok"
      );

      if (endpoint) {
        postFix(endpoint, fix).catch((err) =>
          addLog(`Backend POST failed: ${err.message}`, "error")
        );
      }
    },
    [endpoint, addLog]
  );

  const handleError = useCallback(
    (message: string) => {
      setStatus("error");
      addLog(`Error: ${message}`, "error");
    },
    [addLog]
  );

  const start = useCallback(async () => {
    setStatus("requesting");
    await trackerRef.current.start(handleFix, handleError);
  }, [handleFix, handleError]);

  const stop = useCallback(() => {
    trackerRef.current.stop();
    setStatus("idle");
    addLog(`Tracking stopped — ${fixes.length} fixes recorded`);
  }, [fixes.length, addLog]);

  const clear = useCallback(() => {
    setFixes([]);
    setLog([]);
  }, []);

  const pingBackend = useCallback(async () => {
    if (!endpoint) return addLog("No endpoint set", "warn");
    try {
      const statusCode = await testConnection(endpoint);
      addLog(`Backend responded with HTTP ${statusCode}`, "ok");
    } catch (err) {
      addLog(`Connection failed: ${(err as Error).message}`, "error");
    }
  }, [endpoint, addLog]);

  const exportGpx = useCallback(() => buildGpx(fixes), [fixes]);

  return {
    status,
    fixes,
    log,
    endpoint,
    setEndpoint,
    distanceMeters: totalDistance(fixes),
    start,
    stop,
    clear,
    pingBackend,
    exportGpx,
  };
}