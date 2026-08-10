import type { Request, Response, NextFunction } from "express";
import * as cookie from "cookie";
import { session as sessionCfg } from "../config.js";
import {
  sessionResolve,
  sessionCreate,
  sessionDestroy,
  type ResolvedSession,
} from "../db/index.js";
import type { RlsContext } from "../db/rls.js";

export interface RequestAuth {
  sessionId: string;
  ctx: RlsContext;
  profile: { name: string; email: string; designation: string | null };
  expiresAt: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth: RequestAuth | null;
    }
  }
}

/** Resolve the session cookie (if any) into req.auth. Missing/invalid -> anonymous. */
export async function attachSession(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  req.auth = null;
  try {
    const header = req.headers.cookie;
    if (header) {
      const sid = cookie.parse(header)[sessionCfg.cookieName];
      if (sid) {
        const s = await sessionResolve(sid);
        if (s) req.auth = toAuth(s);
      }
    }
  } catch {
    // Malformed cookie -> treat as anonymous.
  }
  next();
}

function toAuth(s: ResolvedSession): RequestAuth {
  return {
    sessionId: s.session_id,
    ctx: { userId: s.user_id, role: s.role, stateId: s.state_id },
    profile: { name: s.name, email: s.email, designation: s.designation },
    expiresAt: s.expires_at,
  };
}

function cookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true, // not readable by JavaScript — no tokens in localStorage
    secure: sessionCfg.cookieSecure, // HTTPS-only in production
    sameSite: sessionCfg.sameSite,
    path: "/",
    maxAge: maxAgeSeconds,
  } as const;
}

export async function startSession(res: Response, userId: string): Promise<void> {
  const s = await sessionCreate(userId, sessionCfg.ttlHours);
  res.setHeader(
    "Set-Cookie",
    cookie.serialize(sessionCfg.cookieName, s.id, cookieOptions(sessionCfg.ttlHours * 3600)),
  );
}

export async function endSession(req: Request, res: Response): Promise<void> {
  if (req.auth) await sessionDestroy(req.auth.sessionId);
  res.setHeader(
    "Set-Cookie",
    cookie.serialize(sessionCfg.cookieName, "", cookieOptions(0)),
  );
}
