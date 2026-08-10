import type { Request, Response, NextFunction } from "express";
import type { Role } from "../db/rls.js";

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.auth) {
    res.status(401).json({ error: "Not authenticated." });
    return;
  }
  next();
}

export function requireRole(role: Role) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.auth) {
      res.status(401).json({ error: "Not authenticated." });
      return;
    }
    if (req.auth.ctx.role !== role) {
      res.status(403).json({ error: "Forbidden." });
      return;
    }
    next();
  };
}
