// Shared props for the GhostMap component. Both the native (Mapbox) and web
// variants (GhostMap.tsx / GhostMap.web.tsx) implement this same interface.
import type { Ref } from 'react';

export interface LatLng {
  lat: number;
  lng: number;
}

/** A tappable pin drawn at the specified coordinate */
export interface MapPin {
  id: string;
  coordinate: LatLng;
}

/** Provides methods to control the map programmatically */
export interface GhostMapHandle {
  /** Move the camera back onto `center` */
  recenter: () => void;
  /** Animate the camera to show the whole `points` path */
  fitTo: (points: LatLng[]) => void;
}

/** Props for the GhostMap component. */
export interface GhostMapProps {
  /** Ref to the map handle. */
  ref?: Ref<GhostMapHandle>;
  /** Camera center and user-dot position. null/undefined while no location is known yet. */
  center?: LatLng | null;
  /** Route polyline to draw. */
  path?: LatLng[];
  /** Route being raced; drawn beneath `path`. */
  ghostPath?: LatLng[];
  /** Current ghost position during a race. */
  ghostPosition?: LatLng;
  /** Open the camera fitted to these points instead of on `center`. */
  initialBounds?: LatLng[];
  /** Draw the user's location dot. */
  showUser?: boolean;
  /** Zoom the camera to fit the whole path instead of following the user. */
  fitPath?: boolean;
  /** Path color. */
  pathColor?: string;
  /** Allow pan/zoom gestures. */
  interactive?: boolean;
  /** Pins to draw */
  pins?: MapPin[];
  /** Called with the pin's id when a pin is tapped. */
  onPinPress?: (id: string) => void;
}
