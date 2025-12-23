type RateLimitConfig = {
  /** Unique name per endpoint, e.g. "analyze" */
  scope: string;
  /** Max burst tokens */
  capacity: number;
  /** Tokens refilled per second */
  refillPerSecond: number;
  /** If true, treat unknown IPs as a shared bucket */
  fallbackKey?: string;
};

type Bucket = {
  tokens: number;
  lastRefillMs: number;
  lastSeenMs: number;
};

declare global {
  // eslint-disable-next-line no-var
  var __trustcheckIpBuckets: Map<string, Bucket> | undefined;
}

function getStore(): Map<string, Bucket> {
  const g = globalThis as unknown as { __trustcheckIpBuckets?: Map<string, Bucket> };
  if (!g.__trustcheckIpBuckets) g.__trustcheckIpBuckets = new Map();
  return g.__trustcheckIpBuckets;
}

function nowMs(): number {
  return Date.now();
}

function parseFirstIp(xForwardedFor: string): string | null {
  // x-forwarded-for can be: "client, proxy1, proxy2"
  const first = xForwardedFor.split(",")[0]?.trim();
  if (!first) return null;
  // Strip port if present (IPv4:port)
  const withoutPort = first.includes(":") && first.includes(".") ? first.split(":")[0] : first;
  return withoutPort || null;
}

export function getClientIp(req: Request): string | null {
  const h = req.headers;

  // Common proxy/CDN headers
  const cf = h.get("cf-connecting-ip");
  if (cf && cf.trim()) return cf.trim();

  const real = h.get("x-real-ip");
  if (real && real.trim()) return real.trim();

  const vercel = h.get("x-vercel-forwarded-for");
  if (vercel && vercel.trim()) return parseFirstIp(vercel) ?? vercel.trim();

  const xff = h.get("x-forwarded-for");
  if (xff && xff.trim()) return parseFirstIp(xff) ?? xff.trim();

  return null;
}

export type RateLimitResult =
  | { ok: true; limit: number; remaining: number }
  | { ok: false; limit: number; remaining: number; retryAfterSeconds: number };

function pruneIfNeeded(store: Map<string, Bucket>) {
  // Very lightweight cleanup to avoid unbounded growth.
  // Removes buckets not seen for 30 minutes when the map gets large.
  if (store.size < 1500) return;
  const cutoff = nowMs() - 30 * 60 * 1000;
  for (const [k, b] of store) {
    if (b.lastSeenMs < cutoff) store.delete(k);
  }
}

export function checkIpRateLimit(req: Request, config: RateLimitConfig): RateLimitResult {
  const ip = getClientIp(req);
  const key = ip ? `${config.scope}:${ip}` : `${config.scope}:${config.fallbackKey ?? "unknown"}`;

  const store = getStore();
  pruneIfNeeded(store);

  const now = nowMs();
  const capacity = Math.max(1, Math.floor(config.capacity));
  const refillPerSecond = Math.max(0.001, config.refillPerSecond);

  const existing = store.get(key);
  if (!existing) {
    // First request gets charged 1 token.
    store.set(key, {
      tokens: capacity - 1,
      lastRefillMs: now,
      lastSeenMs: now,
    });
    return { ok: true, limit: capacity, remaining: capacity - 1 };
  }

  const elapsedMs = Math.max(0, now - existing.lastRefillMs);
  const refill = (elapsedMs / 1000) * refillPerSecond;
  const tokens = Math.min(capacity, existing.tokens + refill);

  const next: Bucket = {
    tokens,
    lastRefillMs: now,
    lastSeenMs: now,
  };

  if (tokens < 1) {
    store.set(key, next);
    const missing = 1 - tokens;
    const retryAfterSeconds = Math.max(1, Math.ceil(missing / refillPerSecond));
    return { ok: false, limit: capacity, remaining: 0, retryAfterSeconds };
  }

  next.tokens = tokens - 1;
  store.set(key, next);
  return { ok: true, limit: capacity, remaining: Math.max(0, Math.floor(next.tokens)) };
}

export function rateLimitHeaders(result: RateLimitResult): HeadersInit {
  const base: Record<string, string> = {
    "x-ratelimit-limit": String(result.limit),
    "x-ratelimit-remaining": String(result.remaining),
    "cache-control": "no-store",
  };
  if (!result.ok) {
    base["retry-after"] = String(result.retryAfterSeconds);
  }
  return base;
}
