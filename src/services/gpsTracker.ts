
import * as Location from "expo-location";
import { GpsFix } from "../types/gps";

export type FixListener = (fix: GpsFix) => void;
export type ErrorListener = (message: string) => void;

function toGpsFix(loc: Location.LocationObject): GpsFix {
  const c = loc.coords;
  return {
    lat: c.latitude,
    lng: c.longitude,
    accuracy: c.accuracy,
    speed: c.speed,
    heading: c.heading,
    altitude: c.altitude,
    timestamp: loc.timestamp,
  };
}

export class GpsTracker {
  private subscription: Location.LocationSubscription | null = null;

  /** Must be called (and awaited) before start() — user has to grant permission. */
  async requestPermission(): Promise<boolean> {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === "granted";
  }

  async start(onFix: FixListener, onError: ErrorListener): Promise<void> {
    if (this.subscription) return; // already tracking

    const granted = await this.requestPermission();
    if (!granted) {
      onError("Location permission denied");
      return;
    }

    try {
      this.subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 1000, // ms between updates
          distanceInterval: 1, // meters moved before update fires
        },
        (loc) => onFix(toGpsFix(loc))
      );
    } catch (err) {
      onError(err instanceof Error ? err.message : "Unknown GPS error");
    }
  }

  stop(): void {
    this.subscription?.remove();
    this.subscription = null;
  }

  get isTracking(): boolean {
    return this.subscription !== null;
  }
}