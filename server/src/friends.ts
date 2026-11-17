import type { Request, RequestHandler, Response } from "express";
import { Router } from "express";
import { pool } from "./db";
import { requireUser } from "./requireUser";

export const friendsRouter = Router();

// Same login check as routesRouter: requireUser puts the signed-in user's id in res.locals.userId
friendsRouter.use(requireUser);
const uid = (req: Request) => (req.res as Response).locals.userId as number;

// Catches errors from async handlers and answers in JSON
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

// Friendship ids are integers; reject anything else before it reaches Postgres
const idParam = (req: Request) => {
  const n = Number(req.params.id);
  return Number.isInteger(n) && n > 0 ? n : null;
};

const asActivity = (v: unknown) => (v === "run" || v === "bike" ? v : null);

// ---------- friends and requests ----------

// Accepted friends
friendsRouter.get(
  "/",
  h(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT f.id::text AS id, u.username,
              CASE WHEN f.requester_id = $1 THEN f.requester_muted ELSE f.addressee_muted END AS muted
         FROM friendships f
         JOIN users u ON u.id = CASE WHEN f.requester_id = $1 THEN f.addressee_id ELSE f.requester_id END
        WHERE f.status = 'accepted' AND $1 IN (f.requester_id, f.addressee_id)
        ORDER BY lower(u.username)`,
      [uid(req)]
    );
    res.json(rows.map((r) => ({ id: r.id, name: r.username, username: r.username, muted: r.muted })));
  })
);

// Incoming pending requests
friendsRouter.get(
  "/requests",
  h(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT f.id::text AS id, u.username
         FROM friendships f JOIN users u ON u.id = f.requester_id
        WHERE f.addressee_id = $1 AND f.status = 'pending'
        ORDER BY f.created_at DESC`,
      [uid(req)]
    );
    res.json(rows);
  })
);

// People you may know: users you have no friendship or pending request with (either direction),
// people with the most friends in common first, then the newest accounts. Pass ?q=text to search by username.
friendsRouter.get(
  "/suggestions",
  h(async (req, res) => {
    const q = String(req.query.q ?? "").trim().slice(0, 50);
    const { rows } = await pool.query(
      `WITH mf AS (
         SELECT CASE WHEN requester_id = $1 THEN addressee_id ELSE requester_id END AS fid
           FROM friendships
          WHERE status = 'accepted' AND $1 IN (requester_id, addressee_id)
       )
       SELECT u.id::text AS id, u.username,
              (SELECT count(*) FROM friendships f
                WHERE f.status = 'accepted'
                  AND ((f.requester_id = u.id AND f.addressee_id IN (SELECT fid FROM mf))
                    OR (f.addressee_id = u.id AND f.requester_id IN (SELECT fid FROM mf))))::int AS mutual
         FROM users u
        WHERE u.id <> $1
          AND NOT EXISTS (SELECT 1 FROM friendships f
                           WHERE (f.requester_id = $1 AND f.addressee_id = u.id)
                              OR (f.addressee_id = $1 AND f.requester_id = u.id))
          AND ($2 = '' OR u.username ILIKE '%' || $2 || '%')
        ORDER BY mutual DESC, u.created_at DESC
        LIMIT 10`,
      [uid(req), q]
    );
    res.json(rows);
  })
);

// Send a request by username
friendsRouter.post(
  "/requests",
  h(async (req, res) => {
    const username = String(req.body?.username ?? "").trim();
    if (!username) return res.status(400).json({ error: "Enter a username." });
    const target = await pool.query("SELECT id FROM users WHERE lower(username) = lower($1)", [username]);
    if (target.rowCount === 0) return res.status(404).json({ error: "No user with that username." });
    const targetId: number = target.rows[0].id;
    if (targetId === uid(req)) return res.status(400).json({ error: "You can't add yourself." });
    try {
      await pool.query("INSERT INTO friendships (requester_id, addressee_id) VALUES ($1, $2)", [uid(req), targetId]);
      res.status(201).json({ ok: true });
    } catch (e: any) {
      if (e?.code === "23505") {
        return res.status(409).json({ error: "You're already friends, or a request is already pending." });
      }
      throw e;
    }
  })
);

// Only the person who received the request can accept or decline it
friendsRouter.post(
  "/requests/:id/accept",
  h(async (req, res) => {
    const id = idParam(req);
    if (!id) return res.status(400).json({ error: "Bad request id." });
    const r = await pool.query(
      "UPDATE friendships SET status = 'accepted' WHERE id = $1 AND addressee_id = $2 AND status = 'pending'",
      [id, uid(req)]
    );
    r.rowCount ? res.json({ ok: true }) : res.status(404).json({ error: "Request not found." });
  })
);

friendsRouter.post(
  "/requests/:id/decline",
  h(async (req, res) => {
    const id = idParam(req);
    if (!id) return res.status(400).json({ error: "Bad request id." });
    const r = await pool.query(
      "DELETE FROM friendships WHERE id = $1 AND addressee_id = $2 AND status = 'pending'",
      [id, uid(req)]
    );
    r.rowCount ? res.json({ ok: true }) : res.status(404).json({ error: "Request not found." });
  })
);

// POST (not DELETE/PATCH) because the app's api() helper only does GET and POST
friendsRouter.post(
  "/:id/remove",
  h(async (req, res) => {
    const id = idParam(req);
    if (!id) return res.status(400).json({ error: "Bad friend id." });
    const r = await pool.query(
      "DELETE FROM friendships WHERE id = $1 AND status = 'accepted' AND $2 IN (requester_id, addressee_id)",
      [id, uid(req)]
    );
    r.rowCount ? res.json({ ok: true }) : res.status(404).json({ error: "Friend not found." });
  })
);

friendsRouter.post(
  "/:id/mute",
  h(async (req, res) => {
    const id = idParam(req);
    if (!id) return res.status(400).json({ error: "Bad friend id." });
    const muted = !!req.body?.muted;
    const r = await pool.query(
      `UPDATE friendships SET
         requester_muted = CASE WHEN requester_id = $2 THEN $3 ELSE requester_muted END,
         addressee_muted = CASE WHEN addressee_id = $2 THEN $3 ELSE addressee_muted END
       WHERE id = $1 AND status = 'accepted' AND $2 IN (requester_id, addressee_id)`,
      [id, uid(req), muted]
    );
    r.rowCount ? res.json({ ok: true }) : res.status(404).json({ error: "Friend not found." });
  })
);

// ---------- routes (challenges) shared through friendships ----------

const ROUTE_COLS = `r.id, r.name, r.activity, r.visibility, r.distance_m, r.elevation_gain_m,
                    r.created_at, u.username AS creator`;

// Is :id an accepted friendship I'm part of? Returns the other person's user id.
async function friendUserId(friendshipId: number, me: number): Promise<number | null> {
  const { rows } = await pool.query(
    `SELECT CASE WHEN requester_id = $2 THEN addressee_id ELSE requester_id END AS other
       FROM friendships
      WHERE id = $1 AND status = 'accepted' AND $2 IN (requester_id, addressee_id)`,
    [friendshipId, me]
  );
  return rows[0]?.other ?? null;
}

// Everything one friend saved (public and private), optionally ?activity=run|bike
friendsRouter.get(
  "/:id/routes",
  h(async (req, res) => {
    const id = idParam(req);
    if (!id) return res.status(400).json({ error: "Bad friend id." });
    const other = await friendUserId(id, uid(req));
    if (!other) return res.status(404).json({ error: "Friend not found." });
    const { rows } = await pool.query(
      `SELECT ${ROUTE_COLS}
         FROM routes r JOIN users u ON u.id = r.creator_id
        WHERE r.creator_id = $1 AND r.status = 'active'
          AND ($2::text IS NULL OR r.activity = $2)
        ORDER BY r.created_at DESC`,
      [other, asActivity(req.query.activity)]
    );
    res.json(rows);
  })
);

// Feed: ?scope=public (default) | friends | all, and ?activity=run|bike
//   public  -> public routes from other people
//   friends -> everything my friends saved, public or private
//   all     -> both
friendsRouter.get(
  "/feed",
  h(async (req, res) => {
    const scope = ["public", "friends", "all"].includes(String(req.query.scope)) ? String(req.query.scope) : "public";
    const { rows } = await pool.query(
      `WITH x AS (
         SELECT ${ROUTE_COLS},
                EXISTS (SELECT 1 FROM friendships f
                         WHERE f.status = 'accepted'
                           AND ((f.requester_id = $1 AND f.addressee_id = r.creator_id)
                             OR (f.addressee_id = $1 AND f.requester_id = r.creator_id))) AS by_friend
           FROM routes r JOIN users u ON u.id = r.creator_id
          WHERE r.status = 'active' AND r.creator_id <> $1
            AND ($2::text IS NULL OR r.activity = $2)
       )
       SELECT * FROM x
        WHERE ($3::text = 'public'  AND visibility = 'public')
           OR ($3::text = 'friends' AND by_friend)
           OR ($3::text = 'all'     AND (visibility = 'public' OR by_friend))
        ORDER BY created_at DESC
        LIMIT 100`,
      [uid(req), asActivity(req.query.activity), scope]
    );
    res.json(rows);
  })
);