// Shared props for the GhostMap component. Both the native (Mapbox) and web
// (placeholder) variants import from here so their public API stays in sync.

export interface LatLng {
  lat: number;
  lng: number;
}

export interface GhostMapProps {
  /** Camera center and user-dot position; null/undefined while no location is known yet. */
  center?: LatLng | null;
  /** Route polyline to draw. */
  path?: LatLng[];
  /** Current ghost position during a race. */
  ghostPosition?: LatLng;
  /** Draw the user's location dot. */
  showUser?: boolean;
  /** Zoom the camera to fit the whole path instead of following the user. */
  fitPath?: boolean;
  pathColor?: string;
  /** Allow pan/zoom gestures. */
  interactive?: boolean;
}
