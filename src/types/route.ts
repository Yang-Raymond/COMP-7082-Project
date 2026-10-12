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
}

export interface GhostDelta {
 
  deltaMs: number;
 
  progress: number;
  ghostPosition: { lat: number; lng: number };
}