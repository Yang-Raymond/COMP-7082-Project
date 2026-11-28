// Shapes of the challenge data the server sends from GET /challenges (see server/src/challenges.ts).
// A challenge is a route its creator has sent to friends, so every `id` here is the route's server id.
// All times are in milliseconds: durations (senderMs, timeMs, ...) and epoch timestamps (createdAt, expiresAt, finishedAt).
// Also defines ChallengeDetailTarget: which challenge (and from which tab) the detail screen is showing.
import type { ActivityType } from './route';

/** The route a challenge is made of, summarised for the lists. `id` is the server route id (what fetchRoute takes). */
export interface ChallengeRoute {
  id: string;
  name: string;
  distanceMeters: number;
  activity: ActivityType;
}

/** A route a friend sent me as a challenge that I haven't raced yet and hasn't expired. */
export interface ToRaceChallenge {
  id: string;
  route: ChallengeRoute;
  /** Username of the friend who sent it. */
  sender: string;
  /** Their time, which I have to beat. */
  senderMs: number;
  createdAt: number;
  /** When it stops being raceable, or null if it never expires. */
  expiresAt: number | null;
}

/** One person I challenged, and their result once they've raced. */
export interface SentRecipient {
  username: string;
  /** Their time, or null if they haven't raced yet. */
  durationMs: number | null;
  racedAt: number | null;
}

/** A route I sent as a challenge that is still open: not expired, and at least one recipient hasn't raced. */
export interface SentChallenge {
  id: string;
  route: ChallengeRoute;
  /** My time. */
  senderMs: number;
  createdAt: number;
  expiresAt: number | null;
  recipients: SentRecipient[];
}

/** One person in a finished challenge: the creator, or a recipient who finished it. */
export interface FinishedParticipant {
  username: string;
  /** The creator's original recording time, or the recipient's challenge run (the one that settled it). */
  timeMs: number;
  /** True for the signed-in user. */
  isMe: boolean;
}

/** A finished challenge, one per challenge. `role` says whether I received it or created (sent) it. */
export interface FinishedChallenge {
  id: string;
  role: 'received' | 'sent';
  route: ChallengeRoute;
  /** Username of the creator. */
  sender: string;
  /** Usernames of everyone the route was sent to, including those who didn't finish. */
  recipients: string[];
  /** The creator plus every recipient who finished, fastest first. My result is worked out from these. */
  participants: FinishedParticipant[];
  createdAt: number;
  expiresAt: number | null;
  /** When I finished it (received) or when the last recipient did (sent). */
  finishedAt: number;
}

/** Everything GET /challenges returns. */
export interface ChallengeLists {
  toRace: ToRaceChallenge[];
  sent: SentChallenge[];
  finished: FinishedChallenge[];
}

/** The challenge the detail screen is showing. `kind` says which tab it was opened from (it decides the labels and whether Start shows). */
export type ChallengeDetailTarget =
  | { kind: 'toRace'; challenge: ToRaceChallenge }
  | { kind: 'sent'; challenge: SentChallenge }
  | { kind: 'finished'; challenge: FinishedChallenge };
