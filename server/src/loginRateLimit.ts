import type { RequestHandler } from "express";
import { createHash } from "node:crypto";

// Rate limits might need to change later for prod
const WINDOW_MS = 1 * 60 * 1000;
const MAX_IP_ATTEMPTS = 5;
const IP_COOLDOWN_MS = 60 * 1000;
const MAX_EMAIL_FAILURES = 5;
const EMAIL_COOLDOWN_MS = 60 * 1000;
const CLEANUP_INTERVAL_MS = 60 * 1000;

type AttemptWindow = { count: number; expiresAt: number };
type IpAttempts = AttemptWindow & { blockedUntil: number };
type EmailFailures = AttemptWindow & { blockedUntil: number };

// Temp maps to save attempts. They aren't shared between multiple servers so this'll need to be redone for a scaled prod deployment
const ipAttempts = new Map<string, IpAttempts>();
const emailFailures = new Map<string, EmailFailures>();


function emailKey(email: unknown): string {
  const normalized = String(email ?? "").trim().toLowerCase();
  return createHash("sha256").update(normalized).digest("hex");
}

// Remove expired entries
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of ipAttempts) {
    if (entry.expiresAt <= now) ipAttempts.delete(key);
  }
  for (const [key, entry] of emailFailures) {
    if (entry.expiresAt <= now) emailFailures.delete(key);
  }
}, CLEANUP_INTERVAL_MS);
cleanupTimer.unref();

function retryAfterSeconds(expiresAt: number, now: number): number {
  return Math.max(1, Math.ceil((expiresAt - now) / 1000));
}

// Count login requests for each IP and start a separate cooldown after the limit
function checkIpLimit(ip: string, now: number): number | null {
  const current = ipAttempts.get(ip);
  if (!current || current.expiresAt <= now || (current.blockedUntil > 0 && current.blockedUntil <= now)) {

    ipAttempts.set(ip, { count: 1, expiresAt: now + WINDOW_MS, blockedUntil: 0 });
    return null;
  }
  if (current.blockedUntil > now) return retryAfterSeconds(current.blockedUntil, now);

  current.count += 1;
  if (current.count >= MAX_IP_ATTEMPTS) {
    // The request that reaches the limit is allowed; later requests wait for the cooldown.
    current.blockedUntil = now + IP_COOLDOWN_MS;
    current.expiresAt = Math.max(current.expiresAt, current.blockedUntil);
  }
  return null;
}

// Block an email briefly after repeated failures
function checkEmailCooldown(key: string, now: number): number | null {
  const current = emailFailures.get(key);
  if (!current) return null;
  if (current.expiresAt <= now) {
    emailFailures.delete(key);
    return null;
  }
  if (current.blockedUntil > now) return retryAfterSeconds(current.blockedUntil, now);
  if (current.blockedUntil > 0) emailFailures.delete(key);
  return null;
}

// Record a failed login attempt
export function recordLoginFailure(email: unknown): void {
  const key = emailKey(email);
  const now = Date.now();
  const current = emailFailures.get(key);
  const next = !current || current.expiresAt <= now
    ? { count: 0, expiresAt: now + WINDOW_MS, blockedUntil: 0 }
    : current;

  next.count += 1;
  if (next.count >= MAX_EMAIL_FAILURES) {
    next.blockedUntil = now + EMAIL_COOLDOWN_MS;
    next.expiresAt = Math.max(next.expiresAt, next.blockedUntil);
  }
  emailFailures.set(key, next);
}

// A successful login clears the emails failure counter
export function clearLoginFailures(email: unknown): void {
  emailFailures.delete(emailKey(email));
}

// Runs before the login handler.
// Check if an IP or email limit has been hit and respond with 429; otherwise pass to the next handler
export const loginRateLimit: RequestHandler = (req, res, next) => {
  const now = Date.now();
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const ipRetryAfter = checkIpLimit(ip, now);
  const key = emailKey(req.body?.email);
  const emailRetryAfter = checkEmailCooldown(key, now);
  const retryAfter = Math.max(ipRetryAfter ?? 0, emailRetryAfter ?? 0);

  if (retryAfter > 0) {
    res.setHeader("Retry-After", String(retryAfter));
    res.status(429).json({ error: "Too many login attempts. Please wait and try again." });
    return;
  }

  next();
};
