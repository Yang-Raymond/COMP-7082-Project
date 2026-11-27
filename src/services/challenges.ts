// Loads user's three challenge lists, and send a challenge.
import { authedApi } from '../auth/auth';
import type { ChallengeLists } from '../types/challenge';

/** Loads the signed-in user's To race, Sent and Finished challenges in one call. */
export const getChallenges = () => authedApi<ChallengeLists>('/challenges');

/**
 * Challenges friends to beat user's best time on a route. `friendIds` are the ids from GET /friends, `routeId` is the
 * server route id and `expiresAt` an optional time in milliseconds. Resolves with the new challenge's id.
 */
export const sendChallenge = (input: { routeId: string; friendIds: string[]; expiresAt?: number }) =>
  authedApi<{ id: string }>('/challenges', { ...input, routeId: Number(input.routeId) });
