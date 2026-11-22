import type { Request, RequestHandler, Response } from "express";
import { Router } from "express";
import { pool } from "./db";
import { requireUser } from "./requireUser";

export const accountRouter = Router();

// Same login check as friendsRouter: requireUser puts the signed-in user's id in res.locals.userId
accountRouter.use(requireUser);
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

// Change these to match whatever /auth/signup allows
const USERNAME_RE = /^[A-Za-z0-9_.]{3,20}$/;

// Change my username. Answers { user } in the same shape as /auth/me.
accountRouter.post(
  "/username",
  h(async (req, res) => {
    const username = String(req.body?.username ?? "").trim();
    if (!USERNAME_RE.test(username)) {
      return res.status(400).json({ error: "Username must be 3-20 characters: letters, numbers, _ or ." });
    }

    // Someone else already has it (case-insensitive, like the friend search)
    const taken = await pool.query("SELECT 1 FROM users WHERE lower(username) = lower($1) AND id <> $2", [
      username,
      uid(req),
    ]);
    if (taken.rowCount) return res.status(409).json({ error: "That username is already taken." });

    try {
      const { rows } = await pool.query(
        "UPDATE users SET username = $1 WHERE id = $2 RETURNING id, username, email, points",
        [username, uid(req)]
      );
      if (!rows[0]) return res.status(404).json({ error: "User not found." });
      res.json({ user: rows[0] });
    } catch (e: any) {
      // Two people grabbing the same name at the same moment
      if (e?.code === "23505") return res.status(409).json({ error: "That username is already taken." });
      throw e;
    }
  })
);