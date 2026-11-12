// Uploads routes saved with "Save & Challenge" to the server (POST /routes), as in sequence diagram 6:
// the route is saved on the phone first and marked pending, then uploaded. If the phone is offline, the
// server can't be reached or nobody is signed in, the route stays pending and is tried again on the next
// pass (after the next save, when the app comes back to the foreground, and when someone signs in).
// Its clientId makes a retry safe: the server answers a repeated upload with the route it already saved.
//
// The storage, login and fetch it uses are passed in, so this file has no React Native imports
// and can be tested on its own. routeSync.ts wires it to the real ones.
import type { RouteUpload, SavedRoute } from '../types/route';

/** Who is signed in right now: the token to send, and the account id routes are matched against. */
export interface UploadAccount {
  token: string;
  userId: number;
}

export interface UploadDeps {
  apiUrl: string | undefined;
  getAccount: () => UploadAccount | null;
  getRoutes: () => Promise<SavedRoute[]>;
  updateRoute: (id: string, patch: Partial<SavedRoute>) => Promise<void>;
  fetch: typeof fetch;
  /** Gives up on one upload after this long. A long route over a tunnel can take a while. */
  timeoutMs?: number;
}

export interface UploadSummary {
  uploaded: number;
  failed: number;
  stillPending: number;
}

type Outcome =
  | { kind: 'done'; serverId: string }
  | { kind: 'rejected'; error: string } // the server will never accept this route as it is
  | { kind: 'retry' }; // offline, timed out, wrong server, server error or signed out: try again later

const MAX_UPLOAD_POINTS = 20_000; // MAX_POINTS in server/src/routes.ts
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/g; // the server refuses these in names (a pasted tab, say)

/**
 * Builds the function that uploads the signed-in account's pending routes, one at a time. Calling it
 * while a pass is already running doesn't start a second one; it runs one more pass afterwards, so a
 * route saved mid-upload still goes up.
 */
export function createRouteUploader(deps: UploadDeps): () => Promise<UploadSummary> {
  let running: Promise<UploadSummary> | null = null;
  let again = false;

  const run = async () => {
    let summary: UploadSummary;
    do {
      again = false;
      summary = await uploadAll(deps);
    } while (again);
    return summary;
  };

  return () => {
    if (running) {
      again = true;
      return running;
    }
    running = run().finally(() => {
      running = null;
    });
    return running;
  };
}

async function uploadAll(d: UploadDeps): Promise<UploadSummary> {
  const account = d.getAccount();
  const base = d.apiUrl?.replace(/\/+$/, '');
  // Only this account's routes: someone else's, saved on this phone before they signed out, waits for them
  const pending = account
    ? (await d.getRoutes()).filter((r) => r.upload?.state === 'pending' && r.clientId && r.ownerId === account.userId)
    : [];
  const summary: UploadSummary = { uploaded: 0, failed: 0, stillPending: pending.length };
  if (!account || !base || pending.length === 0) return summary;

  for (const route of pending) {
    const outcome = await uploadOne(d, base, account.token, route);
    if (outcome.kind === 'retry') break; // the rest would fail the same way, so leave them for next time
    const upload: RouteUpload =
      outcome.kind === 'done' ? { state: 'done', serverId: outcome.serverId } : { state: 'failed', error: outcome.error };
    await d.updateRoute(route.id, { upload });
    summary.stillPending--;
    if (outcome.kind === 'done') summary.uploaded++;
    else summary.failed++;
  }
  return summary;
}

async function uploadOne(d: UploadDeps, base: string, token: string, r: SavedRoute): Promise<Outcome> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), d.timeoutMs ?? 60_000);
  try {
    const res = await d.fetch(`${base}/routes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(toUploadBody(r)),
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    // 201 = saved now, 200 = this clientId was already saved (an earlier reply got lost)
    if ((res.status === 200 || res.status === 201) && typeof data?.id === 'string') {
      return { kind: 'done', serverId: data.id };
    }
    // Permanent only when our server says so: it refuses bad data (400), a clientId clash (409) and a body
    // that's too big (413) with JSON { error }. Anything else, like a 401, or a 404 page from a server that
    // doesn't have POST /routes yet, says nothing about this route, so try again later.
    if ((res.status === 400 || res.status === 409 || res.status === 413) && typeof data?.error === 'string') {
      return { kind: 'rejected', error: data.error };
    }
    return { kind: 'retry' };
  } catch {
    return { kind: 'retry' };
  } finally {
    clearTimeout(timer);
  }
}

/** Evenly keeps at most `max` points, always including the first and last, in their original order. */
function thinPoints<T>(points: T[], max: number): T[] {
  if (points.length <= max) return points;
  const step = (points.length - 1) / (max - 1); // more than 1 here, so the picked indexes always increase
  return Array.from({ length: max }, (_, i) => points[Math.round(i * step)]);
}

/** The body POST /routes expects (see server/src/routes.ts). */
function toUploadBody(r: SavedRoute) {
  return {
    clientId: r.clientId,
    name: r.name.replace(CONTROL_CHARS, ' ').trim().slice(0, 100) || 'Route', // the server allows 1 to 100 characters
    activity: r.activity ?? 'run',
    createdAt: r.createdAt,
    durationMs: r.durationMs,
    distanceMeters: r.distanceMeters,
    ...(r.elevationGainMeters != null ? { elevationGainMeters: r.elevationGainMeters } : {}),
    // A recording over ~5.5 hours has more points than the server takes; thinning keeps the whole route
    points: thinPoints(r.points, MAX_UPLOAD_POINTS).map((p) => ({ lat: p.lat, lng: p.lng, t: p.t, ...(p.alt != null ? { alt: p.alt } : {}) })),
  };
}
