import { Router } from "express";
import type { RequestHandler } from "express";

/**
 * Express 4 does not catch rejected promises from async handlers: an unhandled rejection
 * escapes the request and (under Node's default) takes the whole process down. A single
 * malformed id (e.g. an invalid uuid reaching Postgres) could therefore log every user out.
 *
 * `wrapRouterAsync` patches a Router's method functions so every handler registered on it is
 * wrapped: a rejection is forwarded to `next(err)` and handled by the app's error middleware
 * (500), leaving the server up. Apply it once per router, after the routes are defined.
 *
 * This is belt-and-braces alongside the process-level handlers in index.ts — the wrapper
 * turns a crash into a clean 500 response; the process handlers are the last resort.
 */
const METHODS = ["get", "post", "put", "patch", "delete", "all", "use"] as const;

function wrapHandler(fn: unknown): unknown {
  if (typeof fn !== "function") return fn;
  const handler = fn as RequestHandler;
  // Error-handling middleware has arity 4 and must keep its signature.
  if (handler.length >= 4) return handler;
  const wrapped: RequestHandler = (req, res, next) => {
    try {
      const out = (handler as (...a: unknown[]) => unknown)(req, res, next);
      if (out && typeof (out as Promise<unknown>).catch === "function") {
        (out as Promise<unknown>).catch(next);
      }
    } catch (err) {
      next(err as Error);
    }
  };
  return wrapped;
}

/**
 * Create a Router whose handlers are automatically async-safe. Use this instead of
 * `Router()` in every route module — new routes then inherit the protection by default.
 */
export function asyncRouter(): Router {
  return wrapRouterAsync(Router());
}

export function wrapRouterAsync<T extends Router>(router: T): T {
  for (const method of METHODS) {
    const original = router[method] as unknown as (...args: unknown[]) => unknown;
    if (typeof original !== "function") continue;
    (router as unknown as Record<string, unknown>)[method] = function patched(...args: unknown[]) {
      return original.apply(router, args.map(wrapHandler));
    };
  }
  return router;
}
