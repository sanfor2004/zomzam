'use client';

import React, { useMemo } from 'react';
import { ProLock } from '@/components/ui';
import { useMoney } from '@/context/MoneyContext';

/* ──────────────────────────────────────────────────────────
    DEVELOPMENT NAVIGATOR: CLIENT-PROFITABILITY TEASER — PRO SPOT #1
    Contains: Locked ProLock strip (dashboard), client-count-only sublabel
    ──────────────────────────────────────────────────────────
    CEILING: presentation-gated only, no server `isPro` yet (see ProLock.tsx).
    The real per-client rate lives behind /api/money/insights — a Pro route we
    deliberately DO NOT call while locked, so those figures never cross the wire
    to a free user (spec §7). The "N clients tracked" count is derived locally
    from the already-loaded tagged transactions — a harmless count, not a rate.
    UPGRADE PATH: once billing exists, gate the real insights fetch on `isPro`;
    this locked call site doesn't change. */

export function ClientProfitabilityTeaser({ className }: { className?: string }) {
  const { transactions } = useMoney();

  const clientCount = useMemo(() => {
    const tagged = new Set<number>();
    for (const t of transactions) {
      if (t.lead_id != null) tagged.add(t.lead_id);
    }
    return tagged.size;
  }, [transactions]);

  return (
    <ProLock
      variant="strip"
      label="See which clients pay you best"
      sublabel={
        clientCount === 0
          ? 'Per-client hourly rate — powered by your logged time'
          : `${clientCount} ${clientCount === 1 ? 'client' : 'clients'} tracked`
      }
      blurred={<span>$•••/hr</span>}
      className={className}
    />
  );
}
