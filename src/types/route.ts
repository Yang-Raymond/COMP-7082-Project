export type ActivityType = 'run' | 'bike';

export interface RoutePoint {
  lat: number;
  lng: number;
  
  t: number;
  
  alt?: number;
}

export interface SavedRoute {
  id: string;
  name: string;
  createdAt: number;
  points: RoutePoint[];
  distanceMeters: number;
  durationMs: number;
  elevationGainMeters?: number;
  activity?: ActivityType;
  /** Only on "Save & Challenge" routes: a UUID made on the phone, so the server can spot a retried upload. */
  clientId?: string;
  /** Only on "Save & Challenge" routes: the account that saved it. It's only uploaded while that account is signed in. */
  ownerId?: number;
  /** Only on "Save & Challenge" routes. Routes without it stay on this phone. */
  upload?: RouteUpload;
}

/** Where a "Save & Challenge" route is in being uploaded to the server. */
export type RouteUpload =
  | { state: 'pending' } // saved here, not on the server yet; retried after the next save, sign-in or return to the app
  | { state: 'done'; serverId: string } // the server's id for it, for GET /routes/:id
  | { state: 'failed'; error: string }; // the server refused it and always will (e.g. too few points)

export interface GhostDelta {
 
  deltaMs: number;
 
  progress: number;
  ghostPosition: { lat: number; lng: number };
}