// Route saving. The phone uploads a finished recording; the server keeps the route's path and the
// creator's run with its per-point times, so the route can be raced as a ghost later.
// Uploads are safe to retry: the phone sends its own clientId (a UUID), and sending the same one twice
// returns the route that's already saved instead of making a copy (sequence diagram 6).
import { Router, type Request, type Response } from "express";
import type { PoolClient } from "pg";
import { pool } from "./db";
import { requireUser } from "./requireUser";

export const routesRouter = Router();
routesRouter.use(requireUser);

const ACTIVITIES = ["run", "bike"] as const;
type Activity = (typeof ACTIVITIES)[number];

const MAX_POINTS = 20_000; // about 5.5 hours at one GPS fix per second
const MAX_DURATION_MS = 2_147_483_647; // runs.duration_ms and run_points.t_ms are INTEGER
const MAX_DISTANCE_M = 10_000_000; // 10,000 km; anything bigger is a bug, and REAL columns overflow near 3.4e38
const MAX_ELEVATION_GAIN_M = 100_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/; // Postgres rejects \u0000, and the rest have no place in a route name

/** The same shape as SavedRoute in the app (src/types/route.ts), plus the ids the server knows it by. */
interface RouteOut {
  id: string;
  clientId: string;
  name: string;
  createdAt: number;
  points: { lat: number; lng: number; t: number; alt?: number }[];
  distanceMeters: number;
  durationMs: number;
  elevationGainMeters?: number;
  activity: Activity;
}

interface RouteIn {
  clientId: string;
  name: string;
  activity: Activity;
  createdAt: number;
  durationMs: number;
  distanceMeters: number;
  elevationGainMeters: number | null;
  lats: number[];
  lngs: number[];
  times: number[];
  alts: (number | null)[];
}

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** Checks a POST /routes body. Returns what's wrong, or the values ready for the database. */
function parseRoute(body: any): { error: string } | { route: RouteIn } {
  const { clientId, name, activity = "run", createdAt, durationMs, distanceMeters, elevationGainMeters, points } = body ?? {};

  if (typeof clientId !== "string" || !UUID.test(clientId)) return { error: "clientId must be a UUID." };
  const cleanName = typeof name === "string" ? name.trim() : "";
  if (!cleanName || cleanName.length > 100 || CONTROL_CHARS.test(cleanName)) {
    return { error: "name must be 1 to 100 characters of plain text." };
  }
  if (!ACTIVITIES.includes(activity)) return { error: "activity must be \"run\" or \"bike\"." };
  // Between 2020 and a day from now (a day of slack for a phone clock that's off)
  if (!isNum(createdAt) || createdAt < 1_577_836_800_000 || createdAt > Date.now() + 86_400_000) {
    return { error: "createdAt must be a recent time in milliseconds." };
  }
  if (!isNum(durationMs) || durationMs < 0 || durationMs > MAX_DURATION_MS) return { error: "durationMs is out of range." };
  if (!isNum(distanceMeters) || distanceMeters < 0 || distanceMeters > MAX_DISTANCE_M) {
    return { error: "distanceMeters is out of range." };
  }
  if (elevationGainMeters != null && (!isNum(elevationGainMeters) || elevationGainMeters < 0 || elevationGainMeters > MAX_ELEVATION_GAIN_M)) {
    return { error: "elevationGainMeters is out of range." };
  }
  if (!Array.isArray(points) || points.length < 2 || points.length > MAX_POINTS) {
    return { error: `points must have 2 to ${MAX_POINTS} entries.` };
  }

  const lats: number[] = [];
  const lngs: number[] = [];
  const times: number[] = [];
  const alts: (number | null)[] = [];
  for (const p of points) {
    if (!isNum(p?.lat) || p.lat < -90 || p.lat > 90 || !isNum(p?.lng) || p.lng < -180 || p.lng > 180) {
      return { error: "Every point needs a valid lat and lng." };
    }
    if (!isNum(p.t) || p.t < 0 || p.t > MAX_DURATION_MS) return { error: "Every point needs t, in milliseconds from the start." };
    const t = Math.round(p.t);
    // The ghost replays these times in order, so they can't go backwards
    if (times.length > 0 && t < times[times.length - 1]) return { error: "Point times must not go backwards." };
    lats.push(p.lat);
    lngs.push(p.lng);
    times.push(t);
    // GPS sometimes reports nonsense altitude; drop it rather than reject the whole route
    alts.push(isNum(p.alt) && p.alt >= -1_000 && p.alt <= 10_000 ? p.alt : null);
  }
  // durationMs is what ranks runs, so it has to cover the recorded points (1 s of slack for rounding)
  if (durationMs + 1_000 < times[times.length - 1]) return { error: "durationMs is shorter than the recorded points." };

  return {
    route: {
      clientId: clientId.toLowerCase(),
      name: cleanName,
      activity,
      createdAt,
      durationMs: Math.round(durationMs),
      distanceMeters,
      elevationGainMeters: elevationGainMeters ?? null,
      lats,
      lngs,
      times,
      alts,
    },
  };
}

// The ghost is the fastest run on the route that isn't flagged. Right after saving, that's the creator's own run.
const SELECT_ROUTES = `
  SELECT r.id, r.client_id, r.name, r.activity, r.distance_m, r.elevation_gain_m,
         (extract(epoch FROM r.created_at) * 1000)::float8 AS created_ms,
         best.duration_ms,
         COALESCE((SELECT json_agg(json_strip_nulls(json_build_object('lat', p.lat, 'lng', p.lng, 't', p.t_ms, 'alt', p.alt_m))
                                   ORDER BY p.seq)
                   FROM run_points p WHERE p.run_id = best.id), '[]'::json) AS points
  FROM routes r
  JOIN LATERAL (
    SELECT id, duration_ms FROM runs
    WHERE route_id = r.id AND NOT flagged
    ORDER BY duration_ms, id
    LIMIT 1
  ) best ON TRUE`;

type RouteRow = {
  id: number;
  client_id: string;
  name: string;
  activity: Activity;
  distance_m: number;
  elevation_gain_m: number | null;
  created_ms: number;
  duration_ms: number;
  points: RouteOut["points"];
};

const toRouteOut = (r: RouteRow): RouteOut => ({
  id: String(r.id),
  clientId: r.client_id,
  name: r.name,
  createdAt: Math.round(r.created_ms),
  points: r.points,
  distanceMeters: r.distance_m,
  durationMs: r.duration_ms,
  ...(r.elevation_gain_m != null ? { elevationGainMeters: r.elevation_gain_m } : {}),
  activity: r.activity,
});

async function insertRoute(client: PoolClient, userId: number, r: RouteIn): Promise<number | null> {
  const inserted = await client.query<{ id: number }>(
    `INSERT INTO routes (client_id, creator_id, name, activity, path, distance_m, elevation_gain_m, area_key, created_at)
     VALUES ($1, $2, $3, $4,
             ST_SetSRID(ST_MakeLine(ARRAY(
               SELECT ST_MakePoint(p.lng, p.lat)
               FROM unnest($5::float8[], $6::float8[]) WITH ORDINALITY AS p(lng, lat, i)
               ORDER BY p.i)), 4326)::geography,
             $7, $8,
             ST_GeoHash(ST_SetSRID(ST_MakePoint($5[1], $6[1]), 4326), 5), -- ~5 km cell around the start, for "nearby"
             to_timestamp($9::float8 / 1000))
     ON CONFLICT (client_id) DO NOTHING
     RETURNING id`,
    [r.clientId, userId, r.name, r.activity, r.lngs, r.lats, r.distanceMeters, r.elevationGainMeters, r.createdAt]
  );
  if (inserted.rowCount === 0) return null; // this clientId was uploaded before

  const routeId = inserted.rows[0].id;
  const run = await client.query<{ id: number }>(
    `INSERT INTO runs (user_id, route_id, duration_ms, is_record, started_at)
     VALUES ($1, $2, $3, TRUE, to_timestamp($4::float8 / 1000))
     RETURNING id`,
    // The app doesn't send a start time, so estimate it from when the route was saved
    [userId, routeId, r.durationMs, r.createdAt - r.durationMs]
  );
  await client.query(
    `INSERT INTO run_points (run_id, seq, lat, lng, t_ms, alt_m)
     SELECT $1, p.i, p.lat, p.lng, p.t_ms, p.alt_m
     FROM unnest($2::float8[], $3::float8[], $4::int[], $5::real[]) WITH ORDINALITY AS p(lat, lng, t_ms, alt_m, i)`,
    [run.rows[0].id, r.lats, r.lngs, r.times, r.alts]
  );
  return routeId;
}

// POST /routes — save a recorded route. 201 when it's new, 200 when this clientId was already saved.
routesRouter.post("/", async (req: Request, res: Response) => {
  const parsed = parseRoute(req.body);
  if ("error" in parsed) return res.status(400).json({ error: parsed.error });
  const userId: number = res.locals.userId;
  const r = parsed.route;

  // Everything below uses this one connection. The pool only has 3, so asking for a second one while
  // holding this one can leave simultaneous uploads all waiting on each other.
  let client: PoolClient | undefined;
  let failure: Error | undefined;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    const routeId = await insertRoute(client, userId, r);
    await client.query("COMMIT");

    if (routeId != null) {
      const { rows } = await client.query<RouteRow>(`${SELECT_ROUTES} WHERE r.id = $1`, [routeId]);
      return res.status(201).json(toRouteOut(rows[0]));
    }
    // A retry after a lost reply: send back what's saved, as long as it's this user's route
    const { rows } = await client.query<RouteRow>(`${SELECT_ROUTES} WHERE r.client_id = $1 AND r.creator_id = $2`, [
      r.clientId,
      userId,
    ]);
    if (!rows[0]) return res.status(409).json({ error: "This clientId is already used by another route." });
    res.status(200).json(toRouteOut(rows[0]));
  } catch (e: any) {
    failure = e;
    await client?.query("ROLLBACK").catch(() => {});
    // The account behind the token no longer exists
    if (e?.code === "23503") return res.status(401).json({ error: "Invalid login credentials" });
    console.error("POST /routes failed:", e);
    res.status(500).json({ error: "Server error." });
  } finally {
    // After a failure, throw the connection away instead of reusing one that might be broken
    client?.release(failure);
  }
});

// GET /routes/mine — the signed-in user's saved routes, newest first
routesRouter.get("/mine", async (req: Request, res: Response) => {
  try {
    const { rows } = await pool.query<RouteRow>(
      `${SELECT_ROUTES} WHERE r.creator_id = $1 AND r.status = 'active' ORDER BY r.created_at DESC, r.id DESC`,
      [res.locals.userId]
    );
    res.json({ routes: rows.map(toRouteOut) });
  } catch (e) {
    console.error("GET /routes/mine failed:", e);
    res.status(500).json({ error: "Server error." });
  }
});

// GET /routes/:id — one route with its ghost points, for racing it
routesRouter.get("/:id", async (req: Request, res: Response) => {
  if (!/^\d{1,9}$/.test(String(req.params.id))) return res.status(404).json({ error: "Route not found." });
  try {
    const { rows } = await pool.query<RouteRow>(`${SELECT_ROUTES} WHERE r.id = $1 AND r.status = 'active'`, [
      Number(req.params.id),
    ]);
    if (!rows[0]) return res.status(404).json({ error: "Route not found." });
    res.json(toRouteOut(rows[0]));
  } catch (e) {
    console.error("GET /routes/:id failed:", e);
    res.status(500).json({ error: "Server error." });
  }
});

// DELETE /routes/:id — hide one of your routes. Its runs are kept, as the "Archived" state in the design doc says.
// Safe to retry: archiving a route that's already archived still answers 204.
routesRouter.delete("/:id", async (req: Request, res: Response) => {
  if (!/^\d{1,9}$/.test(String(req.params.id))) return res.status(404).json({ error: "Route not found." });
  try {
    const result = await pool.query(
      `UPDATE routes SET status = 'archived' WHERE id = $1 AND creator_id = $2`,
      [Number(req.params.id), res.locals.userId]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: "Route not found." });
    res.status(204).end();
  } catch (e) {
    console.error("DELETE /routes/:id failed:", e);
    res.status(500).json({ error: "Server error." });
  }
});
