// A challenge is a route its creator has sent to friends, so each route has at most one challenge.
// POST /challenges  sends a route to friends: the first send creates the challenge (and sets its deadline),
//                   later sends add recipients to the same challenge.
// GET /challenges  returns the toRace, sent and finished challenges.
// A recipient's part is settled by POST /routes/:id/runs (routes.ts), which fills challenge_recipients when they
// finish a race on the route before the deadline. Terminated races are not counted.
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

/** Not expired, meaning the challenge has no deadline or the deadline is still ahead. */
const NOT_EXPIRED = `(c.expires_at IS NULL OR c.expires_at > now())`;

/**
 * Challenge still open, meaning not expired and at least one recipient hasn't finished. A challenge is closed
 * otherwise. A brand-new challenge whose recipients were all just added is open.
 */
const IS_OPEN = `(${NOT_EXPIRED} AND EXISTS (SELECT 1 FROM challenge_recipients o WHERE o.route_id = c.route_id AND o.raced_at IS NULL))`;

/**
 * POST /challenges
 * body: { routeId, friendIds, expiresAt? }
 *   routeId:    the route to send; only its creator can send it
 *   friendIds:  array of friendship ids (not user ids) to send it to
 *   expiresAt?: optional deadline in milliseconds since epoch (must be in the future). It is only used by the
 *               first send, which creates the challenge. Later sends keep the existing deadline and ignore it.
 * The first send creates the challenge, with the creator's original recording time (their earliest run on the
 * route) as the time to beat. Later sends add the friends to the same challenge, ignoring ones already invited.
 * A closed challenge (deadline passed, or every recipient finished) takes no new recipients (409).
 * Returns { id: routeId, added }: `added` is how many new recipients were added. 201 when the challenge was
 * created by this call, 200 when it already existed.
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

    const mine = await client.query(`SELECT 1 FROM routes r WHERE r.id = $1 AND r.status = 'active' AND r.creator_id = $2`, [routeId, me]);
    if (!mine.rowCount) return res.status(404).json({ error: "Route not found." });

    const friends = await client.query<{ other_id: number }>(
      `SELECT CASE WHEN requester_id = $1 THEN addressee_id ELSE requester_id END AS other_id
         FROM friendships
        WHERE id = ANY($2::int[]) AND status = 'accepted' AND $1 IN (requester_id, addressee_id)`,
      [me, [...friendshipIds]]
    );
    if (friends.rowCount !== friendshipIds.size) return res.status(400).json({ error: "You can only challenge your friends." });

    await client.query("BEGIN");

    const lock = `SELECT ${IS_OPEN} AS open FROM challenges c WHERE c.route_id = $1 FOR UPDATE`;
    let created = false;
    if (!(await client.query(lock, [routeId])).rowCount) {
      const senderTime = await client.query<{ ms: number }>(
        `SELECT duration_ms AS ms FROM runs WHERE route_id = $1 AND user_id = $2 ORDER BY id LIMIT 1`,
        [routeId, me]
      );
      if (!senderTime.rowCount) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "This route has no recording to challenge with." });
      }
      const ins = await client.query(
        `INSERT INTO challenges (route_id, sender_id, sender_ms, expires_at)
         VALUES ($1, $2, $3, CASE WHEN $4::float8 IS NULL THEN NULL ELSE to_timestamp($4::float8 / 1000) END)
         ON CONFLICT (route_id) DO NOTHING`,
        [routeId, me, senderTime.rows[0].ms, expiresAt ?? null]
      );
      created = ins.rowCount === 1;
    }
    const row = await client.query<{ open: boolean }>(lock, [routeId]);
    if (!created && !row.rows[0].open) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "This challenge is closed." });
    }

    const added = await client.query(
      `INSERT INTO challenge_recipients (route_id, recipient_id)
       SELECT $1::int, unnest($2::int[])
       ON CONFLICT DO NOTHING`,
      [routeId, friends.rows.map((f) => f.other_id)]
    );
    await client.query("COMMIT");
    res.status(created ? 201 : 200).json({ id: String(routeId), added: added.rowCount ?? 0 });
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
 * Challenges are keyed by route, so every `id` below is the route id.
 *   toRace:   challenges sent to the user that they haven't raced, aren't expired, that the user can still see
 *             (CAN_SEE on the route), from a creator the user hasn't muted. Soonest deadline first, then newest, no deadline last.
 *   sent:     challenges the user created that are still open, with every recipient.
 *   finished: one item per challenge, newest first, at most 50. Either the user is a recipient who finished it, or
 *             the user created it, it is closed and at least one recipient finished. `participants` is the creator
 *             (original recording time) plus every recipient who finished (their settling run), with `isMe`
 *             flagged. The app works out Won / Lost / Tied from it, so the result is live.
 * Returns { toRace, sent, finished }.
 */
challengesRouter.get(
  "/",
  h(async (req, res) => {
    const me = uid(req);

    const toRace = await pool.query(
      `SELECT c.route_id, r.name AS route_name, r.distance_m, r.activity,
              u.username AS sender, c.sender_ms,
              ${ms("c.created_at")} AS created_ms, ${ms("c.expires_at")} AS expires_ms
         FROM challenge_recipients cr
         JOIN challenges c ON c.route_id = cr.route_id
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
        ORDER BY c.expires_at ASC NULLS LAST, c.created_at DESC, c.route_id DESC`,
      [me, me]
    );

    const sent = await pool.query(
      `SELECT c.route_id, r.name AS route_name, r.distance_m, r.activity, c.sender_ms,
              ${ms("c.created_at")} AS created_ms, ${ms("c.expires_at")} AS expires_ms,
              json_agg(json_build_object('username', u.username, 'durationMs', cr.duration_ms, 'racedAt', ${ms("cr.raced_at")})
                       ORDER BY cr.raced_at DESC NULLS LAST, lower(u.username)) AS recipients
         FROM challenges c
         JOIN routes r ON r.id = c.route_id
         JOIN challenge_recipients cr ON cr.route_id = c.route_id
         JOIN users u ON u.id = cr.recipient_id
        WHERE c.sender_id = $1 AND ${IS_OPEN}
        GROUP BY c.route_id, r.id
        ORDER BY c.created_at DESC, c.route_id DESC`,
      [me]
    );

    const finished = await pool.query(
      `SELECT * FROM (
         SELECT c.route_id, r.name AS route_name, r.distance_m, r.activity,
                su.username AS sender, c.sender_id = $1 AS is_sender, c.sender_ms,
                ${ms("c.created_at")} AS created_ms, ${ms("c.expires_at")} AS expires_ms,
                (SELECT json_agg(u.username ORDER BY lower(u.username))
                   FROM challenge_recipients x JOIN users u ON u.id = x.recipient_id
                  WHERE x.route_id = c.route_id) AS recipients,
                (SELECT json_agg(json_build_object('username', u.username, 'timeMs', x.duration_ms, 'isMe', x.recipient_id = $1))
                   FROM challenge_recipients x JOIN users u ON u.id = x.recipient_id
                  WHERE x.route_id = c.route_id AND x.raced_at IS NOT NULL) AS finishers,
                (SELECT ${ms("x.raced_at")} FROM challenge_recipients x
                  WHERE x.route_id = c.route_id AND x.recipient_id = $1) AS my_raced_ms,
                (SELECT ${ms("max(x.raced_at)")} FROM challenge_recipients x
                  WHERE x.route_id = c.route_id) AS last_raced_ms
           FROM challenges c
           JOIN routes r ON r.id = c.route_id
           JOIN users su ON su.id = c.sender_id
          WHERE EXISTS (SELECT 1 FROM challenge_recipients m
                         WHERE m.route_id = c.route_id AND m.recipient_id = $1 AND m.raced_at IS NOT NULL)
             OR (c.sender_id = $1 AND NOT ${IS_OPEN}
                 AND EXISTS (SELECT 1 FROM challenge_recipients m WHERE m.route_id = c.route_id AND m.raced_at IS NOT NULL))
       ) f
       ORDER BY CASE WHEN f.is_sender THEN f.last_raced_ms ELSE f.my_raced_ms END DESC, f.route_id DESC
       LIMIT ${FINISHED_LIMIT}`,
      [me]
    );

    const round = (v: number | null) => (v == null ? null : Math.round(v));
    res.json({
      toRace: toRace.rows.map((r) => ({
        id: String(r.route_id),
        route: routeOut(r),
        sender: r.sender,
        senderMs: r.sender_ms,
        createdAt: Math.round(r.created_ms),
        expiresAt: round(r.expires_ms),
      })),
      sent: sent.rows.map((r) => ({
        id: String(r.route_id),
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
      finished: finished.rows.map((r) => {
        const finishers = r.finishers as { username: string; timeMs: number; isMe: boolean }[];
        return {
          id: String(r.route_id),
          role: r.is_sender ? "sent" : "received",
          route: routeOut(r),
          sender: r.sender,
          recipients: r.recipients as string[],
          participants: [{ username: r.sender, timeMs: r.sender_ms, isMe: r.is_sender }, ...finishers].sort((a, b) => a.timeMs - b.timeMs),
          createdAt: Math.round(r.created_ms),
          expiresAt: round(r.expires_ms),
          finishedAt: Math.round(r.is_sender ? r.last_raced_ms : r.my_raced_ms),
        };
      }),
    });
  })
);
