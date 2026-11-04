// Shared props for the GhostMap component. Both the native (Mapbox) and web
// variants (GhostMap.tsx / GhostMap.web.tsx) implement this same interface.
import type { Ref } from 'react';

export interface LatLng {
  lat: number;
  lng: number;
}

/** Provides methods to control the map programmatically */
export interface GhostMapHandle {
  /** Move the camera back onto `center` */
  recenter: () => void;
}

/** Props for the GhostMap component. */
export interface GhostMapProps {
  /** Ref to the map handle. */
  ref?: Ref<GhostMapHandle>;
  /** Camera center and user-dot position. null/undefined while no location is known yet. */
  center?: LatLng | null;
  /** Route polyline to draw. */
  path?: LatLng[];
  /** Current ghost position during a race. */
  ghostPosition?: LatLng;
  /** Draw the user's location dot. */
  showUser?: boolean;
  /** Zoom the camera to fit the whole path instead of following the user. */
  fitPath?: boolean;
  /** Path color. */
  pathColor?: string;
  /** Allow pan/zoom gestures. */
  interactive?: boolean;
}
