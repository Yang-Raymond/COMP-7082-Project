
export interface RoutePoint {
  lat: number;
  lng: number;
  /** Milliseconds since recording started — this is what makes it a "ghost." */
  t: number;
}

export interface SavedRoute {
  id: string;
  name: string;
  createdAt: number;
  points: RoutePoint[];
  distanceMeters: number;
  durationMs: number;
}

/** Live result of comparing your current run against a saved ghost route. */
export interface GhostDelta {
  /** Negative = ahead of ghost, positive = behind. In milliseconds. */
  deltaMs: number;
  /** Roughly how far along the route you are, 0–1. */
  progress: number;
  /** The ghost's lat/lng at this same point in the route, for drawing a second marker. */
  ghostPosition: { lat: number; lng: number };
}