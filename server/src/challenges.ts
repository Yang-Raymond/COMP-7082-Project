// One sender challenges one or more friends to beat their time on a route.
// POST /challenges  creates a challenge.
// GET /challenges  returns the toRace, sent and finished challenges.
// A recipient's part is settled by POST /routes/:id/runs (routes.ts), which fills challenge_recipients when they
// finish a race on the route before the challenge expires. Terminated races are not counted.
import type { Request, RequestHandler, Response } from "express";
import { Router } from "express";
import type { PoolClient } from "pg";
import { pool } from "./db";
import { requireUser } from "./requireUser";
import { CAN_SEE } from "./routes";

export const challengesRouter = Router();

challengesRouter.use(requireUser);
const uid = (req: Request) => (req.res as Response).locals.userId as number;

const h =
  (fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler =>
  async (req, res) => {
    try {
      await fn(req, res);
    } catch (e) {
      console.error(`${req.method} ${req.originalUrl} failed:`, e);
      res.status(500).json({ error: "Server error." });
    }
  };

const MAX_RECIPIENTS = 50;
const MAX_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;
const FINISHED_LIMIT = 50;

/** Turns a Postgres timestamp into milliseconds. */
const ms = (col: string) => `(extract(epoch FROM ${col}) * 1000)::float8`;

/** Not expired, meaning the challenge has no expiry or the expiry is still ahead. */
const NOT_EXPIRED = `(c.expires_at IS NULL OR c.expires_at > now())`;

/** Challenge still open, meaning not expired and at least one recipient hasn't raced. */
const IS_OPEN = `(${NOT_EXPIRED} AND EXISTS (SELECT 1 FROM challenge_recipients o WHERE o.challenge_id = c.id AND o.raced_at IS NULL))`;

/**
 * POST /challenges
 * body: { routeId, friendIds, expiresAt? }
 *   routeId:    the route to race on
 *   friendIds:  array of friendship ids (not user ids) to challenge
 *   expiresAt?: optional expiry time in milliseconds since epoch (must be in the future)
 * Returns { id } of the created challenge.
 */
challengesRouter.post("/", async (req: Request, res: Response) => {
  const me = uid(req);
  const { routeId, friendIds, expiresAt } = req.body ?? {};

  if (!Number.isInteger(routeId) || routeId <= 0 || routeId > 2_147_483_647) {
    return res.status(400).json({ error: "routeId must be a route id." });
  }
  if (!Array.isArray(friendIds) || friendIds.length < 1 || friendIds.length > MAX_RECIPIENTS) {
    return res.status(400).json({ error: `friendIds must have 1 to ${MAX_RECIPIENTS} entries.` });
  }
  const friendshipIds = new Set<number>();
  for (const v of friendIds) {
    const n = Number(v);
    if (!Number.isInteger(n) || n <= 0 || n > 2_147_483_647) return res.status(400).json({ error: "Every friend id must be valid." });
    friendshipIds.add(n);
  }
  if (expiresAt != null) {
    if (typeof expiresAt !== "number" || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      return res.status(400).json({ error: "expiresAt must be a time in the future, in milliseconds." });
    }
    if (expiresAt > Date.now() + MAX_EXPIRY_MS) return res.status(400).json({ error: "expiresAt is too far away." });
  }

  let client: PoolClient | undefined;
  let failure: Error | undefined;
  try {
    client = await pool.connect();

    const visible = await client.query(`SELECT 1 FROM routes r WHERE r.id = $1 AND r.status = 'active' AND ${CAN_SEE}`, [routeId, me]);
    if (!visible.rowCount) return res.status(404).json({ error: "Route not found." });

    const best = await client.query<{ ms: number | null }>(
      `SELECT MIN(duration_ms)::int AS ms FROM runs WHERE route_id = $1 AND user_id = $2 AND NOT flagged`,
      [routeId, me]
    );
    const senderMs = best.rows[0]?.ms;
    if (senderMs == null) return res.status(400).json({ error: "Race this route first: you need a time to challenge with." });

    const friends = await client.query<{ other_id: number }>(
      `SELECT CASE WHEN requester_id = $1 THEN addressee_id ELSE requester_id END AS other_id
         FROM friendships
        WHERE id = ANY($2::int[]) AND status = 'accepted' AND $1 IN (requester_id, addressee_id)`,
      [me, [...friendshipIds]]
    );
    if (friends.rowCount !== friendshipIds.size) return res.status(400).json({ error: "You can only challenge your friends." });

    await client.query("BEGIN");
    const created = await client.query<{ id: number }>(
      `INSERT INTO challenges (route_id, sender_id, sender_ms, expires_at)
       VALUES ($1, $2, $3, CASE WHEN $4::float8 IS NULL THEN NULL ELSE to_timestamp($4::float8 / 1000) END)
       RETURNING id`,
      [routeId, me, senderMs, expiresAt ?? null]
    );
    await client.query(
      `INSERT INTO challenge_recipients (challenge_id, recipient_id)
       SELECT $1::int, unnest($2::int[])`,
      [created.rows[0].id, friends.rows.map((f) => f.other_id)]
    );
    await client.query("COMMIT");
    res.status(201).json({ id: String(created.rows[0].id) });
  } catch (e) {
    failure = e as Error;
    await client?.query("ROLLBACK").catch(() => {});
    console.error("POST /challenges failed:", e);
    res.status(500).json({ error: "Server error." });
  } finally {
    client?.release(failure);
  }
});

/** The route fields every list item carries. */
const routeOut = (r: { route_id: number; route_name: string; distance_m: number; activity: string }) => ({
  id: String(r.route_id),
  name: r.route_name,
  distanceMeters: r.distance_m,
  activity: r.activity,
});

/**
 * GET /challenges  
 * body: { toRace, sent, finished }
 *   toRace: challenges sent to user that user haven't raced, aren't expired, on a route user can still see, 
 *           from a sender that the user haven't muted. Soonest expiry first, then newest, no expiry last.
 *   sent:   challenges the user has sent that are still open, with every recipient.
 *   finished: challenges user has raced and challenges the user has sent that are no longer open, one row per
 *             recipient who raced. Newest first, at most 50.
 * Returns { toRace, sent, finished }.
 */
challengesRouter.get(
  "/",
  h(async (req, res) => {
    const me = uid(req);

    const toRace = await pool.query(
      `SELECT c.id::text AS id, c.route_id, r.name AS route_name, r.distance_m, r.activity,
              u.username AS sender, c.sender_ms,
              ${ms("c.created_at")} AS created_ms, ${ms("c.expires_at")} AS expires_ms
         FROM challenge_recipients cr
         JOIN challenges c ON c.id = cr.challenge_id
         JOIN routes r ON r.id = c.route_id
         JOIN users u ON u.id = c.sender_id
        WHERE cr.recipient_id = $1 AND cr.raced_at IS NULL AND ${NOT_EXPIRED}
          AND r.status = 'active' AND ${CAN_SEE}
          AND NOT EXISTS (
            SELECT 1 FROM friendships f
             WHERE f.status = 'accepted'
               AND ((f.requester_id = $1 AND f.addressee_id = c.sender_id AND f.requester_muted)
                 OR (f.addressee_id = $1 AND f.requester_id = c.sender_id AND f.addressee_muted))
          )
        ORDER BY c.expires_at ASC NULLS LAST, c.created_at DESC, c.id DESC`,
      [me, me]
    );

    const sent = await pool.query(
      `SELECT c.id::text AS id, c.route_id, r.name AS route_name, r.distance_m, r.activity, c.sender_ms,
              ${ms("c.created_at")} AS created_ms, ${ms("c.expires_at")} AS expires_ms,
              json_agg(json_build_object('username', u.username, 'durationMs', cr.duration_ms, 'racedAt', ${ms("cr.raced_at")})
                       ORDER BY cr.raced_at DESC NULLS LAST, lower(u.username)) AS recipients
         FROM challenges c
         JOIN routes r ON r.id = c.route_id
         JOIN challenge_recipients cr ON cr.challenge_id = c.id
         JOIN users u ON u.id = cr.recipient_id
        WHERE c.sender_id = $1 AND ${IS_OPEN}
        GROUP BY c.id, r.id
        ORDER BY c.created_at DESC, c.id DESC`,
      [me]
    );

    const finished = await pool.query(
      `SELECT * FROM (
         SELECT c.id::text || '-' || cr.recipient_id AS id, 'received' AS role, c.route_id, r.name AS route_name,
                r.distance_m, r.activity, u.username AS opponent,
                cr.duration_ms AS mine_ms, c.sender_ms AS theirs_ms,
                ${ms("c.created_at")} AS created_ms, ${ms("c.expires_at")} AS expires_ms, ${ms("cr.raced_at")} AS raced_ms
           FROM challenge_recipients cr
           JOIN challenges c ON c.id = cr.challenge_id
           JOIN routes r ON r.id = c.route_id
           JOIN users u ON u.id = c.sender_id
          WHERE cr.recipient_id = $1 AND cr.raced_at IS NOT NULL
         UNION ALL
         SELECT c.id::text || '-' || cr.recipient_id, 'sent', c.route_id, r.name,
                r.distance_m, r.activity, u.username,
                c.sender_ms, cr.duration_ms,
                ${ms("c.created_at")}, ${ms("c.expires_at")}, ${ms("cr.raced_at")}
           FROM challenge_recipients cr
           JOIN challenges c ON c.id = cr.challenge_id
           JOIN routes r ON r.id = c.route_id
           JOIN users u ON u.id = cr.recipient_id
          WHERE c.sender_id = $1 AND cr.raced_at IS NOT NULL AND NOT ${IS_OPEN}
       ) f
       ORDER BY f.raced_ms DESC, f.id
       LIMIT ${FINISHED_LIMIT}`,
      [me]
    );

    const round = (v: number | null) => (v == null ? null : Math.round(v));
    res.json({
      toRace: toRace.rows.map((r) => ({
        id: r.id,
        route: routeOut(r),
        sender: r.sender,
        senderMs: r.sender_ms,
        createdAt: Math.round(r.created_ms),
        expiresAt: round(r.expires_ms),
      })),
      sent: sent.rows.map((r) => ({
        id: r.id,
        route: routeOut(r),
        senderMs: r.sender_ms,
        createdAt: Math.round(r.created_ms),
        expiresAt: round(r.expires_ms),
        recipients: (r.recipients as { username: string; durationMs: number | null; racedAt: number | null }[]).map((p) => ({
          username: p.username,
          durationMs: p.durationMs,
          racedAt: round(p.racedAt),
        })),
      })),
      finished: finished.rows.map((r) => ({
        id: r.id,
        role: r.role,
        route: routeOut(r),
        opponent: r.opponent,
        mineMs: r.mine_ms,
        theirsMs: r.theirs_ms,
        createdAt: Math.round(r.created_ms),
        expiresAt: round(r.expires_ms),
        racedAt: Math.round(r.raced_ms),
      })),
    });
  })
);
