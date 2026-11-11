import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";

// The phone finds our task by this name. Any unique string works.
export const BACKGROUND_LOCATION_TASK = "ghostracer-background-location";

type LocationsListener = (locations: Location.LocationObject[]) => void;

// Whoever is tracking right now (a recording or a race).
let listener: LocationsListener | null = null;

export function setBackgroundListener(next: LocationsListener | null): void {
  listener = next;
}

// Defined at the top level so it already exists when the phone sends the first locations
TaskManager.defineTask<{ locations: Location.LocationObject[] }>(
  BACKGROUND_LOCATION_TASK,
  async ({ data, error }) => {
    if (error) {
      console.warn("Background location error:", error.message);
      return;
    }
    listener?.(data.locations);
  }
);