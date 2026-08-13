import type { Request, Response, NextFunction } from "express";

// A tiny in-memory fixed-window rate limiter — enough to blunt password guessing on a
// single-instance NIC deployment without an external dependency. For a multi-instance
// deployment, move this to Postgres or Redis.
interface Bucket {
  count: number;
  resetAt: number;
}

export function rateLimit(opts: { windowMs: number; max: number }) {
  const buckets = new Map<string, Bucket>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();
    const key = req.ip ?? "unknown";
    let b = buckets.get(key);
    if (!b || now >= b.resetAt) {
      b = { count: 0, resetAt: now + opts.windowMs };
      buckets.set(key, b);
    }
    b.count += 1;
    if (b.count > opts.max) {
      const retry = Math.ceil((b.resetAt - now) / 1000);
      res.setHeader("Retry-After", String(retry));
      res.status(429).json({ error: "Too many attempts. Try again shortly." });
      return;
    }
    // Opportunistic cleanup so the map does not grow unbounded.
    if (buckets.size > 5000) {
      for (const [k, v] of buckets) if (now >= v.resetAt) buckets.delete(k);
    }
    next();
  };
}
