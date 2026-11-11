import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

/**
 * Lets a request through only with a valid "Authorization: Bearer <token>" header from /auth/login or /auth/signup.
 * Puts the signed-in user's id in res.locals.userId for the handler.
 */
export function requireUser(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET ?? "") as unknown as { sub: number };
    res.locals.userId = Number(payload.sub);
    next();
  } catch {
    // Same message as /auth/me, so the app treats it as "signed out"
    res.status(401).json({ error: "Invalid login credentials" });
  }
}
