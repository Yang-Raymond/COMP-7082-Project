// "Live now": who is racing my routes at this moment.
// A racer's app calls POST /routes/:id/live every ~10 seconds while a race is open and POST /routes/live/stop when it
// ends. The server keeps one short-lived row per racer. GET /routes/live answers who is racing MY routes, counting
// anyone we heard from in the last LIVE_SECONDS, so a phone that dies mid-race drops off by itself.
//
// Mount this BEFORE routesRouter (see index.ts), so "/routes/live" isn't read as a route id.
import { Router, type Request, type Response } from "express";
import { pool } from "./db";
import { requireUser } from "./requireUser";

export const liveRouter = Router();

const LIVE_SECONDS = 30;

// Same rule as CAN_SEE in routes.ts: the user in $2 may see route r (mine, public, or a friend's)
const CAN_SEE = `(
  r.creator_id = $2
  OR r.visibility = 'public'
  OR EXISTS (
    SELECT 1 FROM friendships f
    WHERE f.status = 'accepted'
      AND ((f.requester_id = $2 AND f.addressee_id = r.creator_id)
        OR (f.addressee_id = $2 AND f.requester_id = r.creator_id))
  )
)`;

// POST /routes/:id/live: "I'm racing this route right now". Only for routes I'm allowed to see.
liveRouter.post("/:id/live", requireUser, async (req: Request, res: Response) => {
  if (!/^\d{1,9}$/.test(String(req.params.id))) return res.status(404).json({ error: "Route not found." });
  const routeId = Number(req.params.id);
  const me: number = res.locals.userId;
  try {
    const visible = await pool.query(`SELECT 1 FROM routes r WHERE r.id = $1 AND r.status = 'active' AND ${CAN_SEE}`, [
      routeId,
      me,
    ]);
    if (!visible.rowCount) return res.status(404).json({ error: "Route not found." });

    await pool.query(
      `INSERT INTO live_races (user_id, route_id, last_seen) VALUES ($1, $2, now())
       ON CONFLICT (user_id) DO UPDATE SET route_id = EXCLUDED.route_id, last_seen = now()`,
      [me, routeId]
    );
    // Tidy up rows nobody has refreshed in an hour
    pool.query("DELETE FROM live_races WHERE last_seen < now() - interval '1 hour'").catch(() => {});
    res.json({ ok: true });
  } catch (e) {
    console.error("POST /routes/:id/live failed:", e);
    res.status(500).json({ error: "Server error." });
  }
});

// POST /routes/live/stop: "I stopped racing". Safe to call when nothing is live.
liveRouter.post("/live/stop", requireUser, async (req: Request, res: Response) => {
  try {
    await pool.query("DELETE FROM live_races WHERE user_id = $1", [res.locals.userId]);
    res.json({ ok: true });
  } catch (e) {
    console.error("POST /routes/live/stop failed:", e);
    res.status(500).json({ error: "Server error." });
  }
});

// GET /routes/live: who is racing one of MY routes right now (not counting me racing my own)
liveRouter.get("/live", requireUser, async (req: Request, res: Response) => {
  try {
    const { rows } = await pool.query<{ user_id: number; username: string; route_id: number; route_name: string }>(
      `SELECT lr.user_id, u.username, r.id AS route_id, r.name AS route_name
         FROM live_races lr
         JOIN routes r ON r.id = lr.route_id
         JOIN users u ON u.id = lr.user_id
        WHERE r.creator_id = $1
          AND lr.user_id <> $1
          AND r.status = 'active'
          AND lr.last_seen > now() - make_interval(secs => $2::float8)
        ORDER BY lr.last_seen DESC`,
      [res.locals.userId, LIVE_SECONDS]
    );
    res.json({
      racers: rows.map((r) => ({
        userId: r.user_id,
        username: r.username,
        routeId: String(r.route_id),
        routeName: r.route_name,
      })),
    });
  } catch (e) {
    console.error("GET /routes/live failed:", e);
    res.status(500).json({ error: "Server error." });
  }
});