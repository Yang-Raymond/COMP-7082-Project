// Works out the user's result in a finished challenge from the times of its participants (the creator's original
// recording plus every recipient who finished). Pure functions with no React imports, so they can be unit tested.
import type { FinishedParticipant } from '../types/challenge';

export interface ChallengeOutcome {
  result: 'Won' | 'Lost' | 'Tied';
  /** My time. */
  mineMs: number;
  /** The time I'm compared with: the fastest of everyone else, which is the #1 when I lost, the #2 when I won, or the tied person's time. */
  otherMs: number;
  /** mineMs - otherMs: negative when I'm faster, 0 on a tie, positive when slower. */
  deltaMs: number;
}

/**
 * Won when my time is strictly the lowest among the participants, Tied when I share the lowest, Lost otherwise.
 * The comparison time is always the fastest of the other participants, so it works out to the #1's time when I'm not
 * first, the #2's time when I'm first, and the other tied person's time (delta 0) on a tie. The order of
 * `participants` doesn't matter. If there is no `isMe` entry or nobody else, it reports a tie with myself at 0 delta.
 */
export function challengeOutcome(participants: FinishedParticipant[]): ChallengeOutcome {
  const me = participants.find((p) => p.isMe);
  const others = participants.filter((p) => !p.isMe);
  const mineMs = me?.timeMs ?? 0;
  const otherMs = others.length > 0 ? Math.min(...others.map((p) => p.timeMs)) : mineMs;
  const deltaMs = mineMs - otherMs;
  const result = deltaMs < 0 ? 'Won' : deltaMs > 0 ? 'Lost' : 'Tied';
  return { result, mineMs, otherMs, deltaMs };
}
