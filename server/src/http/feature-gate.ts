import type { Request, Response, NextFunction } from "express";

/**
 * Blocks a route when its feature is disabled. Returns 404 — not 403 — so a disabled feature
 * is indistinguishable from one that was never built: it does not advertise that the endpoint
 * exists and is merely switched off.
 *
 * Mount it BEFORE any role check, so the answer is the same for every caller (state assessor,
 * Centre, anonymous). A disabled feature is disabled for everyone.
 */
export function requireFeature(enabled: boolean) {
  return (_req: Request, res: Response, next: NextFunction): void => {
    if (!enabled) {
      res.status(404).json({ error: "Not found." });
      return;
    }
    next();
  };
}
