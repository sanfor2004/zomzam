'use client';

import React, { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Modal, Button, NumberInput, Badge, useToast } from '@/components/ui';
import { useMoney } from '@/context/MoneyContext';
import { CURRENCIES, type Currency } from '@/lib/fx';

/* ──────────────────────────────────────────────────────────
    DEVELOPMENT NAVIGATOR: RATES MODAL — FX RATE MANAGEMENT
    Contains: live-refresh button, per-currency editable rate rows
              (EGP pivot fixed at 1), source badges (api/manual/fallback)
    ──────────────────────────────────────────────────────────
    Surfaces the per-user FX cache (money_fx_rates) to the user. Every
    rate is expressed as "EGP per 1 unit" — the single pivot the whole
    money suite converts through (see src/lib/fx.ts). Editing a row is an
    optimistic manual override; "Refresh live" pulls fresh rates from the
    keyless provider (or the offline fallback if it's unreachable). */

const SOURCE_META: Record<string, { label: string; variant: 'success' | 'primary' | 'warning' | 'neutral' }> = {
  api: { label: 'Live', variant: 'success' },
  manual: { label: 'Manual', variant: 'primary' },
  fallback: { label: 'Offline', variant: 'warning' },
};

export interface RatesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function RatesModal({ isOpen, onClose }: RatesModalProps) {
  const { rates, rateSources, homeCurrency, refreshFxRates, setFxRate } = useMoney();
  const { toast } = useToast();
  // `drafts` holds ONLY in-progress edits — an input with no draft renders the
  // committed rate straight from context, so there's no effect syncing the two
  // (avoids the cascading-render trap of seeding state from props).
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [refreshing, setRefreshing] = useState(false);

  const clearDraft = (currency: Currency) =>
    setDrafts((d) => {
      if (!(currency in d)) return d;
      const next = { ...d };
      delete next[currency];
      return next;
    });

  const handleRefresh = async () => {
    setRefreshing(true);
    const res = await refreshFxRates();
    setRefreshing(false);
    if (!res.ok) return; // context already toasts the failure
    setDrafts({}); // committed rates changed — drop any stale in-progress edits
    toast({
      variant: res.source === 'api' ? 'success' : 'warn',
      title: res.source === 'api' ? 'Live rates updated' : 'Using offline rates',
      description:
        res.source === 'api'
          ? 'Fetched the latest exchange rates.'
          : 'The rate provider was unreachable — kept the offline fallback.',
    });
  };

  // Commit a single row only when it parses to a positive number that actually
  // differs from the stored rate. Either way the draft is cleared, so the input
  // snaps back to the committed rate from context (invalid/unchanged = no-op).
  const commit = (currency: Currency) => {
    const draft = drafts[currency];
    if (draft === undefined) return; // untouched
    const parsed = parseFloat(draft);
    if (Number.isFinite(parsed) && parsed > 0 && parsed !== rates[currency]) {
      void setFxRate(currency, parsed);
    }
    clearDraft(currency);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Exchange rates"
      description="Rates are EGP per 1 unit — the pivot every conversion runs through."
      size="md"
      fullWidthMobile
    >
      <div className="space-y-5">
        {/* ──────────────────────────────────────────────────────────
            DEVELOPMENT NAVIGATOR: LIVE REFRESH
            Contains: pull-live-rates action + home-currency hint
            ────────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-slate-400">
            Home currency: <span className="font-black text-slate-200">{homeCurrency}</span>
          </p>
          <Button
            variant="soft"
            size="sm"
            onClick={handleRefresh}
            loading={refreshing}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Refresh live
          </Button>
        </div>

        {/* ──────────────────────────────────────────────────────────
            DEVELOPMENT NAVIGATOR: PER-CURRENCY RATE ROWS
            Contains: EGP pivot (fixed), USD/EUR/GBP editable rate + source badge
            ────────────────────────────────────────────────────────── */}
        <div className="space-y-3">
          {CURRENCIES.map((currency) => {
            const isPivot = currency === 'EGP';
            const meta = SOURCE_META[rateSources[currency]] ?? SOURCE_META.fallback;
            return (
              <div key={currency} className="flex items-center gap-3">
                <div className="w-14 shrink-0">
                  <span className="text-sm font-black text-white tracking-tight">{currency}</span>
                </div>
                {isPivot ? (
                  <div className="flex-1 flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-300 tabular-nums">1.00</span>
                    <Badge variant="neutral">Pivot</Badge>
                  </div>
                ) : (
                  <>
                    <NumberInput
                      value={drafts[currency] ?? String(rates[currency])}
                      onChange={(v) => setDrafts((d) => ({ ...d, [currency]: v }))}
                      onBlur={() => commit(currency)}
                      min={0}
                      step={0.1}
                      prefix="EGP"
                      ariaLabel={`${currency} rate in EGP`}
                      className="flex-1"
                    />
                    <Badge variant={meta.variant}>{meta.label}</Badge>
                  </>
                )}
              </div>
            );
          })}
        </div>

        <p className="text-[11px] text-slate-500 leading-relaxed">
          Editing a rate sets a manual override. Past transactions keep the rate that was
          in effect when you logged them — changing a rate never rewrites your history.
        </p>
      </div>
    </Modal>
  );
}
