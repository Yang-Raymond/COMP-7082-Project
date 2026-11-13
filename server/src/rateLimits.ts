import type { RequestHandler } from "express";
import { createHash } from "node:crypto";

// Consts for login
const LOGIN_WINDOW_MS = 1 * 60 * 1000;
const MAX_LOGIN_FAILURES_PER_EMAIL = 5;
const LOGIN_EMAIL_COOLDOWN_MS = 1 * 60 * 1000;

// Consts for password reset
const RESET_EMAIL_WINDOW_MS = 1 * 60 * 1000;
const MAX_RESET_REQUESTS_PER_EMAIL = 3;
const RESET_EMAIL_COOLDOWN_MS = 1 * 60 * 1000;

const CLEANUP_INTERVAL_MS = 60 * 1000;

type RateLimitState = {
  count: number;
  expiresAt: number;
  blockedUntil: number;
};

const loginEmailFailures = new Map<string, RateLimitState>();
const resetRequestEmailAttempts = new Map<string, RateLimitState>();

// Remove exired entries to free up memory.
function cleanExpiredCounters(attempts: Map<string, RateLimitState>, now: number): void {
  for (const [key, state] of attempts) {
    if (state.expiresAt <= now) {
      attempts.delete(key);
    }
  }
}

// Clean maps on a timer.
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  cleanExpiredCounters(loginEmailFailures, now);
  cleanExpiredCounters(resetRequestEmailAttempts, now);
}, CLEANUP_INTERVAL_MS);
cleanupTimer.unref();


// Normalize email addresses before counting them to keep them obscured
function emailKey(email: unknown): string {
  const normalized = String(email ?? "").trim().toLowerCase();
  return createHash("sha256").update(normalized).digest("hex");
}

// Return the number of seconds left in a cooldown.
function retryAfterSeconds(blockedUntil: number, now: number): number {
  return Math.max(1, Math.ceil((blockedUntil - now) / 1000));
}

// Apply the window and cooldown to one counter map.
function checkAndCount(attempts: Map<string, RateLimitState>, key: string, maxAttempts: number, windowMs: number, cooldownMs: number, now: number): number | null {
  const current = attempts.get(key);

  // Start a new window for a new key, an expired window, or an ended cooldown.
  if (!current || current.expiresAt <= now || (current.blockedUntil > 0 && current.blockedUntil <= now)) {
    attempts.set(key, {
      count: 1,
      expiresAt: now + windowMs,
      blockedUntil: 0,
    });
    return null;
  }

  // Cooldown is not extended by more requests when already blocked.
  if (current.blockedUntil > now) {
    return retryAfterSeconds(current.blockedUntil, now);
  }

  current.count += 1;
  if (current.count >= maxAttempts) {
    current.blockedUntil = now + cooldownMs;
    current.expiresAt = Math.max(current.expiresAt, current.blockedUntil);
  }

  return null;
}

// Check whether an email's failed-login cooldown is still active.
function checkEmailCooldown(key: string, now: number): number | null {
  const current = loginEmailFailures.get(key);
  if (!current) {
    return null;
  }

  if (current.expiresAt <= now) {
    loginEmailFailures.delete(key);
    return null;
  }

  if (current.blockedUntil > now) {
    return retryAfterSeconds(current.blockedUntil, now);
  }

  if (current.blockedUntil > 0) {
    loginEmailFailures.delete(key);
  }

  return null;
}

// Count a failed login attempt.
export function recordLoginFailure(email: unknown): void {
  const key = emailKey(email);
  const now = Date.now();
  checkAndCount(
    loginEmailFailures,
    key,
    MAX_LOGIN_FAILURES_PER_EMAIL,
    LOGIN_WINDOW_MS,
    LOGIN_EMAIL_COOLDOWN_MS,
    now
  );
}

// A successful login clears that email's failure counter.
export function clearLoginFailures(email: unknown): void {
  loginEmailFailures.delete(emailKey(email));
}

// Check the failed-login cooldown for the email entered on the login form.
export const loginRateLimit: RequestHandler = (req, res, next) => {
  const now = Date.now();
  const email = emailKey(req.body?.email);
  const emailRetryAfter = checkEmailCooldown(email, now);
  if (emailRetryAfter !== null) {
    res.setHeader("Retry-After", String(emailRetryAfter));
    res.status(429).json({ error: "Too many login attempts. Please wait and try again." });
    return;
  }

  next();
};

// Limit reset email requests by the email address entered.
export const passwordResetRequestRateLimit: RequestHandler = (req, res, next) => {
  const now = Date.now();
  const email = emailKey(req.body?.email);

  const emailRetryAfter = checkAndCount(
    resetRequestEmailAttempts,
    email,
    MAX_RESET_REQUESTS_PER_EMAIL,
    RESET_EMAIL_WINDOW_MS,
    RESET_EMAIL_COOLDOWN_MS,
    now
  );

  if (emailRetryAfter !== null) {
    res.setHeader("Retry-After", String(emailRetryAfter));
    res.status(429).json({ error: "Too many reset code requests. Please wait and try again." });
    return;
  }

  next();
};
