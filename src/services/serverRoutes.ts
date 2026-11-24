import { authedApi } from '../auth/auth';
import type { ActivityType, RoutePoint, RouteVisibility, SavedRoute } from '../types/route';

/** Archives one of your uploaded routes on the server. The server only allows the route's creator to do this. */
export const archiveRoute = (serverId: string) => authedApi(`/routes/${serverId}/delete`, {});

/** A route as GET /routes/:id sends it (see RouteOut in server/src/routes.ts). */
interface ServerRoute {
  id: string;
  name: string;
  createdAt: number;
  points: RoutePoint[];
  distanceMeters: number;
  durationMs: number;
  elevationGainMeters?: number;
  activity: ActivityType;
  visibility: RouteVisibility;
}

/**
 * Loads a route you're allowed to see (yours, public, or a friend's) from the server, in the shape the Race
 * screen expects. Its path and time to beat are the fastest run so far. Nothing is stored on the phone.
 */
export async function fetchRoute(serverId: string): Promise<SavedRoute> {
  const r = await authedApi<ServerRoute>(`/routes/${serverId}`);
  return {
    id: `server-${r.id}`,
    name: r.name,
    createdAt: r.createdAt,
    points: r.points,
    distanceMeters: r.distanceMeters,
    durationMs: r.durationMs,
    elevationGainMeters: r.elevationGainMeters ?? 0,
    activity: r.activity,
    visibility: r.visibility,
    upload: { state: 'done', serverId: r.id },
  };
}