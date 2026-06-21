// In-memory sliding-window rate limiter. State is per-process — adequate for the
// single persistent VPS deploy (there is no Redis in the stack). If this ever
// scales to multiple instances, the store moves behind a shared backend.

const hits = new Map<string, number[]>();
let lastSweep = Date.now();

// Drop keys whose every recorded attempt has aged out, so the map can't grow
// unbounded from one-off IPs. Runs at most once per window.
function sweepStale(now: number, windowMs: number): void {
  if (now - lastSweep < windowMs) return;
  lastSweep = now;
  for (const [key, times] of hits) {
    if (times.every((t) => now - t >= windowMs)) hits.delete(key);
  }
}

/**
 * Record an attempt for `key` and report whether it is still within the limit.
 * Returns true when allowed (<= max attempts in the window), false once exceeded.
 */
export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  sweepStale(now, windowMs);
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  recent.push(now);
  hits.set(key, recent);
  return recent.length <= max;
}

/** Best-effort client IP from proxy headers (the deploy sits behind one front proxy). */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip') || 'unknown';
}
