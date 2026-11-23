import { authedApi } from '../auth/auth';

export interface LeaderboardEntry {
  rank: number;
  userId: number;
  username: string;
  durationMs: number;
  /** When the run started, in milliseconds. */
  startedAt: number;
  /** True for the signed-in user's own row. */
  isMe: boolean;
}

export interface Leaderboard {
  route: { id: string; name: string; distanceMeters: number; activity: 'run' | 'bike' };
  entries: LeaderboardEntry[];
}

/** Fastest run per person on one route. Pass the server's route id (an uploaded route's upload.serverId). */
export const getLeaderboard = (routeId: string) => authedApi<Leaderboard>(`/routes/${routeId}/leaderboard`);

export interface RunResult {
  /** Your place on the route after this run (1 = fastest). */
  rank: number;
  totalRunners: number;
  durationMs: number;
  /** Your fastest time on this route, including this run. */
  bestMs: number;
  isPersonalBest: boolean;
}

/**
 * Sends a finished race on a route to the server and returns your rank on it.
 * `points` are needed because the fastest run on a route becomes its ghost: { lat, lng, t (ms from start), alt? }.
 */
export const submitRun = (
  routeId: string,
  run: { durationMs: number; startedAt: number; points: { lat: number; lng: number; t: number; alt?: number }[] }
) => authedApi<RunResult>(`/routes/${routeId}/runs`, run);