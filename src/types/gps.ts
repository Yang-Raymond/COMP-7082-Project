
export interface GpsFix {
  lat: number;
  lng: number;
  /** Horizontal accuracy in meters. Lower is better. */
  accuracy: number | null;
  /** Speed in meters/second, if the device provides it. */
  speed: number | null;
  /** Compass heading in degrees, 0-360. */
  heading: number | null;
  altitude: number | null;
  /** Unix ms timestamp of the fix. */
  timestamp: number;
}

export type TrackingStatus = "idle" | "requesting" | "live" | "stale" | "error";

export interface LogEntry {
  time: number;
  message: string;
  level: "info" | "ok" | "warn" | "error";
}

/** Simple accuracy tiers, used to flag untrustworthy fixes in the UI. */
export type AccuracyFlag = "good" | "warn" | "bad" | "unknown";

export function flagAccuracy(accuracy: number | null): AccuracyFlag {
  if (accuracy == null) return "unknown";
  if (accuracy <= 10) return "good";
  if (accuracy <= 25) return "warn";
  return "bad";
}