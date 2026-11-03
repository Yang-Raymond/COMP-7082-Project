// Wraps expo-location: permission, location-services checks, and position watches normalized to GpsFix.
import * as Location from "expo-location";
import { Platform } from "react-native";
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

// Shared across all trackers so the Android "turn on location" dialog shows at most once per launch if location isn't on.
let servicesPromptShown = false;

export class GpsTracker {
  private subscription: Location.LocationSubscription | null = null;

  /** Requests (or confirms) foreground location permission. */
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
    if (this.subscription) return;

    const granted = await this.requestPermission();
    if (!granted) {
      onError("Location permission denied");
      return;
    }

    if (!(await this.ensureServicesEnabled())) {
      onError("Location services are off");
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

  /**
   * Resolves true when device location services are on. If they are off, shows the
   * Android system "turn on location" dialog the first time only.
   * Later calls just re-check without prompting. Never prompts on iOS/web.
   * Pass `force` for a user-initiated request, such as the locate button, to prompt
   * even if the dialog was already shown.
   */
  async ensureServicesEnabled(force = false): Promise<boolean> {
    try {
      if (await Location.hasServicesEnabledAsync()) return true;
      if (Platform.OS !== "android" || (servicesPromptShown && !force)) return false;
      servicesPromptShown = true;
      await Location.enableNetworkProviderAsync();
      return await Location.hasServicesEnabledAsync();
    } catch {
      return false;
    }
  }

  /**
   * Returns the OS's cached last-known position without spinning up GPS.
   * Only checks (never requests) permission so it can't trigger a second prompt
   * Resolves null when unavailable.
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