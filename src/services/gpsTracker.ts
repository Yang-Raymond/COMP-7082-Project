// Wraps expo-location: permission, location-services checks, and position watches normalized to GpsFix.
import Constants, { ExecutionEnvironment } from "expo-constants";
import * as Location from "expo-location";
import { Platform } from "react-native";
import { GpsFix } from "../types/gps";
import { BACKGROUND_LOCATION_TASK, setBackgroundListener } from "./backgroundLocation";

export type FixListener = (fix: GpsFix) => void;
export type ErrorListener = (message: string) => void;

export interface StartOptions {
  /** Keep tracking while the screen is locked. Used for recordings and races. */
  background?: boolean;
}

// Expo Go and the web can't track in the background, so they always use the foreground watcher
const backgroundSupported =
  Platform.OS !== "web" && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;

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
  private inBackgroundMode = false;

  /** Requests (or confirms) foreground location permission. */
  async requestPermission(): Promise<boolean> {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === "granted";
  }

  /**
   * Starts foreground or background position tracking. Background tracking falls
   * back to the foreground watcher when it is unavailable.
   */
  async start(onFix: FixListener, onError: ErrorListener, options: StartOptions = {}): Promise<void> {
    if (this.subscription || this.isTracking) return;

    const granted = await this.requestPermission();
    if (!granted) {
      onError("Location permission denied");
      return;
    }

    if (!(await this.ensureServicesEnabled())) {
      onError("Location services are off");
      return;
    }

    if (options.background && (await this.startBackground(onFix))) return;

    try {
      this.subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 1000,
          distanceInterval: 1,
        },
        (loc) => onFix(toGpsFix(loc))
      );
    } catch (err) {
      onError(err instanceof Error ? err.message : "Unknown GPS error");
    }
  }

  // Returns false if background tracking isn't possible, so start() falls back to the foreground watcher
  private async startBackground(onFix: FixListener): Promise<boolean> {
    if (!backgroundSupported) return false;
    try {
      const { status } = await Location.requestBackgroundPermissionsAsync();
      if (status !== "granted") return false;

      setBackgroundListener((locations) => locations.forEach((loc) => onFix(toGpsFix(loc))));
      await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 1000,
        distanceInterval: 1,
        activityType: Location.ActivityType.Fitness,
        pausesUpdatesAutomatically: false,
        showsBackgroundLocationIndicator: true,
        foregroundService: {
          notificationTitle: "GhostRacer is tracking your run",
          notificationBody: "Your route keeps recording while your screen is off.",
        },
      });
      this.inBackgroundMode = true;
      return true;
    } catch (err) {
      setBackgroundListener(null);
      console.warn("Background tracking unavailable, using foreground tracking:", err);
      return false;
    }
  }

    async getCurrent(): Promise<GpsFix | null> {
    const granted = await this.requestPermission();
    if (!granted) return null;
    try {
      if (!(await this.ensureServicesEnabled())) return null;
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      return toGpsFix(loc);
    } catch {
      return null;
    }
  }

  /**
   * Returns true if location services are on. On Android, prompts the user to
   * turn them on (once per launch unless `force` is true).
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
    if (this.inBackgroundMode) {
      this.inBackgroundMode = false;
      setBackgroundListener(null);
      Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK).catch(() => {});
    }
  }

  get isTracking(): boolean {
    return this.subscription !== null || this.inBackgroundMode;
  }
}