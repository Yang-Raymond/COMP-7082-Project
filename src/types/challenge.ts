// Shapes of the challenge data the server sends from GET /challenges (see server/src/challenges.ts).
// All times are in milliseconds: durations (senderMs, mineMs, ...) and epoch timestamps (createdAt, expiresAt, racedAt).
import type { ActivityType } from './route';

/** The route a challenge is on, summarised for the lists. `id` is the server route id (what fetchRoute takes). */
export interface ChallengeRoute {
  id: string;
  name: string;
  distanceMeters: number;
  activity: ActivityType;
}

/** A challenge a friend sent me that I haven't raced yet and hasn't expired. */
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

/** A challenge I sent that is still open: not expired, and at least one recipient hasn't raced. */
export interface SentChallenge {
  id: string;
  route: ChallengeRoute;
  /** My time. */
  senderMs: number;
  createdAt: number;
  expiresAt: number | null;
  recipients: SentRecipient[];
}

/** One finished race against one opponent. `role` says whether I received or sent the challenge. */
export interface FinishedChallenge {
  /** Unique per challenge and recipient. */
  id: string;
  role: 'received' | 'sent';
  route: ChallengeRoute;
  opponent: string;
  mineMs: number;
  theirsMs: number;
  createdAt: number;
  expiresAt: number | null;
  racedAt: number;
}

/** Everything GET /challenges returns. */
export interface ChallengeLists {
  toRace: ToRaceChallenge[];
  sent: SentChallenge[];
  finished: FinishedChallenge[];
}
