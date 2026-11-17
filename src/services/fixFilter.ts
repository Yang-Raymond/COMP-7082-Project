// Pure GPS fix quality filter: decides whether a raw GpsFix should be recorded as a
// RoutePoint or rejected as stale, inaccurate, jitter or physically implausible.
import { ActivityType } from '../types/route';
import { GpsFix } from '../types/gps';
import { haversineDistance } from './distance';

export type FixRejection = 'stale' | 'inaccurate' | 'jitter' | 'too-fast';

/** The last fix that was accepted and recorded; the reference for movement checks. */
export interface AcceptedFix {
  lat: number;
  lng: number;
  timestamp: number;
}

/** Maximum reported horizontal accuracy (meters) for a fix after the first one. */
const MAX_ACCURACY_M = 20;

/** Stricter accuracy limit (meters) for the first point. */
const MAX_FIRST_FIX_ACCURACY_M = 12;

/** Movement (meters) below this since the last accepted fix is treated as GPS jitter. */
const MIN_MOVE_M = 3;

/** Maximum plausible speed (meters/second) per activity; faster implies a bad fix. */
const MAX_SPEED_MPS: Record<ActivityType, number> = {
  run: 8,
  bike: 20,
};

/**
 * Decides whether a GPS fix should be recorded. Returns null to accept, or the rejection reason.
 * Checks run in order:
 * 1. stale: the fix predates the start of recording (a cached fix).
 * 2. inaccurate: accuracy is worse than 20 m (12 m for the first point). A null accuracy is not rejected.
 * 3. If a previous accepted fix exists, compare against it:
 *    - too-fast: no time elapsed, or implied speed exceeds the activity's cap. Self-healing:
 *      after a bad accepted point, later real fixes become plausible again as time passes.
 *    - jitter: moved less than 3 m.
 */
export function checkFix(
  fix: GpsFix,
  last: AcceptedFix | undefined,
  startedAt: number,
  activity: ActivityType
): FixRejection | null {
  if (fix.timestamp < startedAt) return 'stale';

  if (fix.accuracy !== null) {
    const limit = last ? MAX_ACCURACY_M : MAX_FIRST_FIX_ACCURACY_M;
    if (fix.accuracy > limit) return 'inaccurate';
  }

  if (last) {
    const d = haversineDistance(last, fix);
    const dt = (fix.timestamp - last.timestamp) / 1000;
    if (dt <= 0 || d / dt > MAX_SPEED_MPS[activity]) return 'too-fast';
    if (d < MIN_MOVE_M) return 'jitter';
  }

  return null;
}
