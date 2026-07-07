'use client';

import React, { useEffect, useState } from 'react';
import { ProLock } from '@/components/ui';
import { useMoney } from '@/context/MoneyContext';

/* ──────────────────────────────────────────────────────────
    DEVELOPMENT NAVIGATOR: CLIENT-PROFITABILITY TEASER — PRO SPOT #1
    Contains: Locked ProLock strip (dashboard), client-count-only sublabel
    ──────────────────────────────────────────────────────────
    CEILING: presentation-gated only, no server `isPro` yet (see
    ProLock.tsx). Fetches /api/money/insights ONLY to read `clients.length`
    for the sublabel copy — the real per-client `ratePerHour` figures the
    route returns are discarded here, never assigned to state or rendered.
    UPGRADE PATH: swap this count-only read for a real `isPro` gate once
    billing exists; the ProLock call site itself doesn't need to change. */

export function ClientProfitabilityTeaser({ className }: { className?: string }) {
  const { displayCurrency } = useMoney();
  const [clientCount, setClientCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/money/insights?display=${displayCurrency}`)
      .then((res) => res.json())
      .then((data) => {
        // Only `.length` is kept. `data.clients[].ratePerHour` is real, Pro-gated
        // money data — it is intentionally never read past this line.
        if (!cancelled && data.success) setClientCount(data.clients.length);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [displayCurrency]);

  return (
    <ProLock
      variant="strip"
      label="See which clients pay you best"
      sublabel={
        clientCount === null
          ? 'Per-client hourly rate — powered by your logged time'
          : `${clientCount} ${clientCount === 1 ? 'client' : 'clients'} tracked`
      }
      blurred={<span>$•••/hr</span>}
      className={className}
    />
  );
}
