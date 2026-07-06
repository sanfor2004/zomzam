/* ──────────────────────────────────────────────────────────
    DEVELOPMENT NAVIGATOR: DREAM-THREAD HELPERS
    Contains: filterQueueByHorizon, isDreamComplete
    ──────────────────────────────────────────────────────────

    Pure decisions for the Planning⇄Execution dream round-trip,
    kept out of page.tsx so they're unit-testable. */

export interface HorizonTask {
  horizon_id: number | null;
  status: string;
}

/** The pending tasks belonging to a horizon, in the caller's order.
 *  activeHorizonId null → return the input unchanged (no filter active). */
export function filterQueueByHorizon<T extends HorizonTask>(
  pending: T[],
  activeHorizonId: number | null,
): T[] {
  if (activeHorizonId == null) return pending;
  return pending.filter((t) => t.horizon_id === activeHorizonId);
}

/** True when horizonId has ≥1 linked task and every one of them is
 *  completed — i.e. the task just finished was the dream's last step. */
export function isDreamComplete(tasks: HorizonTask[], horizonId: number | null): boolean {
  if (horizonId == null) return false;
  const linked = tasks.filter((t) => t.horizon_id === horizonId);
  return linked.length > 0 && linked.every((t) => t.status === 'completed');
}
