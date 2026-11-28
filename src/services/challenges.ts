// Loads user's three challenge lists, and sends a route to friends as a challenge.
import { authedApi } from '../auth/auth';
import type { ChallengeLists } from '../types/challenge';

/** Loads the signed-in user's To race, Sent and Finished challenges in one call. */
export const getChallenges = () => authedApi<ChallengeLists>('/challenges');

/**
 * Sends a route the user created to friends as a challenge. `friendIds` are the ids from GET /friends and `routeId`
 * is the server route id. The first send creates the challenge and `expiresAt` (optional, milliseconds) sets its
 * deadline. Later sends add recipients to the same challenge and ignore `expiresAt`. Resolves with the route id and
 * how many new recipients were added. Rejects if the challenge is closed.
 */
export const sendChallenge = (input: { routeId: string; friendIds: string[]; expiresAt?: number }) =>
  authedApi<{ id: string; added: number }>('/challenges', { ...input, routeId: Number(input.routeId) });
