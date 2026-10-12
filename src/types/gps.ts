
export interface GpsFix {
  lat: number;
  lng: number;
 
  accuracy: number | null;

  speed: number | null;
 
  heading: number | null;
  altitude: number | null;
 
  timestamp: number;
}

export type TrackingStatus = "idle" | "requesting" | "live" | "stale" | "error";

export interface LogEntry {
  time: number;
  message: string;
  level: "info" | "ok" | "warn" | "error";
}


export type AccuracyFlag = "good" | "warn" | "bad" | "unknown";

export function flagAccuracy(accuracy: number | null): AccuracyFlag {
  if (accuracy == null) return "unknown";
  if (accuracy <= 10) return "good";
  if (accuracy <= 25) return "warn";
  return "bad";
}