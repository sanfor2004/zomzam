// Shared-backend (MySQL) sliding-window rate limiter.
//
// The previous implementation kept the window in a process-local Map. That is
// correct only for a single long-lived Node process — but this app runs on
// Vercel's serverless runtime, where each invocation may hit a *different*
// instance and instances are recycled on cold starts. There, an in-memory
// counter resets constantly and is never shared, so it cannot actually throttle
// a brute-force / enumeration attack. We persist attempts in the DB instead, so
// the window is consistent across every instance.
//
// Append-only: one row per attempt, keyed by an opaque `bucket` string. Counting
// rows within the window IS the sliding window; stale rows are purged opportun-
// istically so the table can't grow unbounded.

import { execute, queryOne } from './db';

// Abandoned buckets (an IP that hits once and never returns) leave rows the
// per-bucket purge never revisits. A rare global sweep drops anything older than
// this — comfortably above every window the app actually uses (minutes).
const MAX_RETENTION_MS = 24 * 60 * 60 * 1000;

/**
 * Record an attempt for `key` and report whether it is still within the limit.
 * Returns true when allowed (<= `max` attempts in the window), false once
 * exceeded.
 *
 * Fails OPEN: if the DB is unreachable we allow the request rather than lock
 * every user out of login over a transient database hiccup. The throttle is a
 * mitigation layer, not the primary auth control.
 */
export async function rateLimit(key: string, max: number, windowMs: number): Promise<boolean> {
  const now = Date.now();
  const cutoff = now - windowMs;
  try {
    await execute(
      `INSERT INTO rate_limit_events (bucket, created_at_ms) VALUES (?, ?)`,
      [key, now]
    );

    const row = await queryOne<{ c: number }>(
      `SELECT COUNT(*) AS c FROM rate_limit_events WHERE bucket = ? AND created_at_ms >= ?`,
      [key, cutoff]
    );

    // Drop this bucket's aged-out rows so a steadily-hit key stays small.
    await execute(
      `DELETE FROM rate_limit_events WHERE bucket = ? AND created_at_ms < ?`,
      [key, cutoff]
    );

    // Occasionally sweep globally to reclaim rows from buckets never hit again.
    if (Math.random() < 0.02) {
      await execute(
        `DELETE FROM rate_limit_events WHERE created_at_ms < ?`,
        [now - MAX_RETENTION_MS]
      ).catch(() => {});
    }

    return (row?.c ?? 0) <= max;
  } catch (err) {
    console.error('rateLimit DB error (failing open):', err);
    return true;
  }
}

/** Best-effort client IP from proxy headers (the deploy sits behind one front proxy). */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip') || 'unknown';
}
