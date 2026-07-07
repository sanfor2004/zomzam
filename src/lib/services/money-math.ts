// Pure, DB-free credit-card cycle math. Lives apart from money.ts because that
// module imports mysql2 at the top level (Node-only) — a 'use client' component
// like AccountCard can import from here without dragging the DB driver into the
// browser bundle. Unit-testable in isolation (see money.test.ts).

/** Fraction of a card's limit currently used (0–1, 2dp). Null when no limit. */
export function utilization(balance: number, limit: number | null): number | null {
  if (!limit || limit <= 0) return null;
  return Math.round((Math.abs(balance) / limit) * 100) / 100;
}

/** Days until the next occurrence of `dueDay`, plus that date. Null when unset. */
export function dueInfo(dueDay: number | null, today = new Date()): { days: number; date: Date } | null {
  if (!dueDay) return null;
  const y = today.getFullYear();
  const m = today.getMonth();
  const d = today.getDate();
  const date = dueDay < d ? new Date(y, m + 1, dueDay) : new Date(y, m, dueDay);
  const days = Math.round((date.getTime() - new Date(y, m, d).getTime()) / 86400000);
  return { days, date };
}

/** Day count only — the single source both the card UI and the test share. */
export function daysUntilDue(dueDay: number | null, today = new Date()): number | null {
  return dueInfo(dueDay, today)?.days ?? null;
}
