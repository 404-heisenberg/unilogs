import type { Request, Response, NextFunction } from 'express';

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 60;
const SWEEP_THRESHOLD = 10_000;

type Bucket = {
  count: number;
  resetAt: number;
};

// Keyed by share token, not IP: a leaked token should be slow to burn no matter
// which addresses it is replayed from. In-memory and per-instance, which is
// proportionate for a link a supervisor opens by hand - not a defence against a
// distributed attacker.
const buckets = new Map<string, Bucket>();

function sweep(now: number) {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
}

export function shareRateLimit(req: Request, res: Response, next: NextFunction) {
  const token = req.params.token;
  const key = typeof token === 'string' ? token : (req.ip ?? 'unknown');
  const now = Date.now();

  if (buckets.size > SWEEP_THRESHOLD) {
    sweep(now);
  }

  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return next();
  }

  if (bucket.count >= MAX_REQUESTS) {
    res.setHeader('Retry-After', String(Math.ceil((bucket.resetAt - now) / 1000)));
    return res.status(429).json({ error: 'Too many requests' });
  }

  bucket.count += 1;
  next();
}
