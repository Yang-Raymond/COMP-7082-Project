import bcrypt from "bcryptjs";
import cors from "cors";
import "dotenv/config"; // must stay first so db.ts can read process.env
import type { Request, Response } from "express";
import express from "express";
import jwt from "jsonwebtoken";
import { pool } from "./db";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not set. Add it to server/.env, then restart the server.");
}

const app = express();
const port = Number(process.env.PORT) || 4000;

app.use(cors());
app.use(express.json());

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

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});