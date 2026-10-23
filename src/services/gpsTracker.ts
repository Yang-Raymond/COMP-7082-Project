
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

  
  async requestPermission(): Promise<boolean> {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === "granted";
  }

  /**
   * Starts a continuous position watch. `options` overrides the default
   * navigation-grade settings (used by the recorder).
   */
  async start(
    onFix: FixListener,
    onError: ErrorListener,
    options: Location.LocationOptions = {
      accuracy: Location.Accuracy.BestForNavigation,
      timeInterval: 1000,
      distanceInterval: 1,
    }
  ): Promise<void> {
    if (this.subscription) return; // already tracking

    const granted = await this.requestPermission();
    if (!granted) {
      onError("Location permission denied");
      return;
    }

    try {
      this.subscription = await Location.watchPositionAsync(
        options,
        (loc) => onFix(toGpsFix(loc))
      );
    } catch (err) {
      onError(err instanceof Error ? err.message : "Unknown GPS error");
    }
  }

  
  async getCurrent(): Promise<GpsFix | null> {
    const granted = await this.requestPermission();
    if (!granted) return null;
    try {
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      return toGpsFix(loc);
    } catch {
      return null;
    }
  }

  /**
   * Returns the OS's cached last-known position without spinning up GPS.
   * Only checks (never requests) permission so it can't trigger a second prompt
   * alongside getCurrent(). Resolves null when unavailable.
   */
  async getLastKnown(): Promise<GpsFix | null> {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== "granted") return null;
      const loc = await Location.getLastKnownPositionAsync();
      return loc ? toGpsFix(loc) : null;
    } catch {
      return null;
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