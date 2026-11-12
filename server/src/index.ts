import bcrypt from "bcryptjs";
import cors from "cors";
import "dotenv/config"; // must stay first so db.ts can read process.env
import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import express from "express";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import { pool } from "./db";
import { routesRouter } from "./routes";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not set. Add it to server/.env, then restart the server.");
}

const app = express();
const port = Number(process.env.PORT) || 4000;

app.use(cors());
// The default 100 KB limit is too small for a long recording: about 70 bytes per GPS point, one point per second
app.use(express.json({ limit: "5mb" }));

// Log every request so you can see whether the phone reaches the server.
app.use((req, _res, next) => {
  console.log(new Date().toISOString(), req.method, req.url);
  next();
});

type UserRow = {
  id: number;
  username: string;
  email: string;
  password_hash: string;
  points: number;
};

const publicUser = (u: UserRow) => ({ id: u.id, username: u.username, email: u.email, points: u.points });
const makeToken = (u: UserRow) => jwt.sign({ sub: u.id }, JWT_SECRET, { expiresIn: "30d" });

// ---------- health ----------

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.get("/health/db", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT now() AS time, current_database() AS database, (SELECT extversion FROM pg_extension WHERE extname = 'postgis') AS postgis"
    );
    res.json({ ok: true, ...result.rows[0] });
  } catch (err) {
    console.error("GET /health/db failed:", err);
    res.status(500).json({ ok: false, error: "Database check failed. See the server terminal for the reason." });
  }
});

// ---------- auth ----------

app.post("/auth/signup", async (req: Request, res: Response) => {
  const { username, email, password } = req.body ?? {};
  if (!username || !email || !password) {
    return res.status(400).json({ error: "Username, email and password are required." });
  }
  if (String(password).length < 6) {
    return res.status(400).json({ error: "Password should be at least 6 characters." });
  }
  try {
    const hash = await bcrypt.hash(String(password), 10);
    const { rows } = await pool.query<UserRow>(
      `INSERT INTO users (username, email, password_hash)
       VALUES ($1, lower($2), $3)
       RETURNING id, username, email, password_hash, points`,
      [String(username).trim(), String(email).trim(), hash]
    );
    res.status(201).json({ token: makeToken(rows[0]), user: publicUser(rows[0]) });
  } catch (e: any) {
    if (e?.code === "23505") {
      return res.status(409).json({ error: "An account with this email or username is already registered." });
    }
    console.error("POST /auth/signup failed:", e);
    res.status(500).json({ error: "Server error." });
  }
});

app.post("/auth/login", async (req: Request, res: Response) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }
  try {
    const { rows } = await pool.query<UserRow>("SELECT * FROM users WHERE email = lower($1)", [String(email).trim()]);
    const user = rows[0];
    const ok = user && (await bcrypt.compare(String(password), user.password_hash));
    if (!ok) return res.status(401).json({ error: "Invalid login credentials" });
    res.json({ token: makeToken(user), user: publicUser(user) });
  } catch (e) {
    console.error("POST /auth/login failed:", e);
    res.status(500).json({ error: "Server error." });
  }
});

app.get("/auth/me", async (req: Request, res: Response) => {
  try {
    const token = (req.headers.authorization ?? "").replace("Bearer ", "");
    const payload = jwt.verify(token, JWT_SECRET) as unknown as { sub: number };
    const { rows } = await pool.query<UserRow>(
      "SELECT id, username, email, password_hash, points FROM users WHERE id = $1",
      [payload.sub]
    );
    if (!rows[0]) return res.status(401).json({ error: "Invalid login credentials" });
    res.json({ user: publicUser(rows[0]) });
  } catch {
    res.status(401).json({ error: "Invalid login credentials" });
  }
});

// ---------- routes ----------

app.use("/routes", routesRouter);

// ---------- password reset ----------

const hashCode = (email: string, code: string) =>
  crypto.createHash("sha256").update(`${email}:${code}:${JWT_SECRET}`).digest("hex");

// Email is optional. Without SMTP_* in server/.env the code is printed in this terminal instead.
const smtpReady = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
const mailer = smtpReady
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      connectionTimeout: 10_000,
      socketTimeout: 10_000,
    })
  : null;

async function sendResetEmail(to: string, code: string) {
  if (!mailer) {
    console.log(`[dev] SMTP not configured. Reset code for ${to}: ${code}`);
    return;
  }
  await mailer.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject: "Your Ghost Racer reset code",
    text: `Your reset code is ${code}. It expires in 15 minutes. If you didn't ask for this, ignore this email.`,
  });
}

app.post("/auth/forgot-password", async (req: Request, res: Response) => {
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  res.json({ ok: true }); // always succeed, so emails can't be probed
  if (!email) return;
  try {
    const { rows } = await pool.query<UserRow>("SELECT * FROM users WHERE email = $1", [email]);
    if (!rows[0]) return;
    const code = String(crypto.randomInt(100000, 1000000));
    await pool.query(
      `INSERT INTO password_resets (user_id, code_hash, expires_at, attempts)
       VALUES ($1, $2, now() + interval '15 minutes', 0)
       ON CONFLICT (user_id) DO UPDATE
         SET code_hash = EXCLUDED.code_hash, expires_at = EXCLUDED.expires_at, attempts = 0`,
      [rows[0].id, hashCode(email, code)]
    );
    await sendResetEmail(email, code);
  } catch (e) {
    console.error("POST /auth/forgot-password failed:", e);
  }
});

app.post("/auth/reset-password", async (req: Request, res: Response) => {
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const code = String(req.body?.code ?? "").trim();
  const password = String(req.body?.password ?? "");
  if (!email || !code || !password) {
    return res.status(400).json({ error: "Email, code and password are required." });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: "Password should be at least 6 characters." });
  }
  try {
    const { rows } = await pool.query(
      `SELECT u.id, r.code_hash
         FROM users u JOIN password_resets r ON r.user_id = u.id
        WHERE u.email = $1 AND r.expires_at > now() AND r.attempts < 5`,
      [email]
    );
    const row = rows[0];
    const expected: string = row?.code_hash ?? "";
    const given = hashCode(email, code);
    const ok =
      Boolean(row) &&
      expected.length === given.length &&
      crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(given));
    if (!ok) {
      if (row) await pool.query("UPDATE password_resets SET attempts = attempts + 1 WHERE user_id = $1", [row.id]);
      return res.status(400).json({ error: "Invalid or expired code" });
    }
    const hash = await bcrypt.hash(password, 10);
    await pool.query("UPDATE users SET password_hash = $1 WHERE id = $2", [hash, row.id]);
    await pool.query("DELETE FROM password_resets WHERE user_id = $1", [row.id]);
    res.json({ ok: true });
  } catch (e) {
    console.error("POST /auth/reset-password failed:", e);
    res.status(500).json({ error: "Server error." });
  }
});

// Errors no handler caught (bad JSON, a body over the size limit, ...): answer in JSON like every other
// error, instead of Express's HTML page with a stack trace. Keep this after every route.
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) return next(err);
  if (err?.type === "entity.parse.failed") return res.status(400).json({ error: "The request body is not valid JSON." });
  if (err?.type === "entity.too.large") return res.status(413).json({ error: "The upload is too large." });
  if (err?.status >= 400 && err.status < 500) {
    return res.status(err.status).json({ error: err.expose ? err.message : "Bad request." });
  }
  console.error(`${req.method} ${req.path} failed:`, err);
  res.status(500).json({ error: "Server error." });
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Server is running on port ${port}`);
});