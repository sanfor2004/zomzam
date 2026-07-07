'use client';

import React, { useState } from 'react';
import { AlertTriangle, Settings2 } from 'lucide-react';
import { Modal, NumberInput, Button, CountUp, useToast } from '@/components/ui';
import { useMoney, type Bucket } from '@/context/MoneyContext';
import { cn } from '@/lib/utils';

/* ──────────────────────────────────────────────────────────
    DEVELOPMENT NAVIGATOR: NESTED ACTIVITY-RING BUDGET VIEW
    Contains: N concentric SVG rings (one per budget bucket, each filled by
    % of its OWN limit spent), center safe-to-spend CountUp, legend, and an
    "edit split" affordance (Modal + per-bucket NumberInput)
    ──────────────────────────────────────────────────────────
    Current-month only (free tier — spec §7). Rings animate via
    stroke-dashoffset only (compositor-safe CSS transition, disabled under
    prefers-reduced-motion); over-limit rings shift to a warning colour AND
    show a warning glyph so colour is never the sole signal. */

// Fixed palette (Zomzam tokens) — plain hex so the colour can be applied via
// an SVG `stroke` attribute / inline style without depending on Tailwind's
// JIT picking up a dynamically-built class name.
const RING_PALETTE = ['#EE5712', '#22c68d', '#882adc', '#38bdf8'];
const WARNING_COLOR = '#f75872';

const SIZE = 200;
const CENTER = SIZE / 2;
const STROKE_WIDTH = 14;
const RING_GAP = 8;
const OUTER_RADIUS = 84;

export interface BudgetRingsProps {
  className?: string;
}

export function BudgetRings({ className }: BudgetRingsProps) {
  const { budget, displayCurrency, formatAmount, updateBudget } = useMoney();
  const { toast } = useToast();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [draftBuckets, setDraftBuckets] = useState<Bucket[]>(budget.buckets);

  const openEdit = () => {
    setDraftBuckets(budget.buckets.map((b) => ({ ...b })));
    setIsEditOpen(true);
  };

  const draftTotal = draftBuckets.reduce((sum, b) => sum + (Number(b.percent) || 0), 0);

  const handleSaveSplit = async () => {
    if (draftTotal > 100) {
      toast({ variant: 'error', description: "Bucket percentages can't add up to more than 100%." });
      return;
    }
    const ok = await updateBudget(draftBuckets);
    if (ok) setIsEditOpen(false);
  };

  // Reuse the exact Intl currency formatting formatAmount is built on, split
  // into a symbol + number so CountUp can animate the number while the
  // symbol/decimals still trace back to the single formatAmount source.
  const currencySymbol =
    new Intl.NumberFormat('en-US', { style: 'currency', currency: displayCurrency })
      .formatToParts(0)
      .find((p) => p.type === 'currency')?.value ?? '';
  const isNegative = budget.safeToSpend < 0;

  return (
    <div
      data-entrance="card"
      className={cn('surface-card border border-slate-800/60 rounded-3xl p-6 shadow-apple', className)}
    >
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xs font-black text-slate-450 uppercase tracking-widest">This Month&apos;s Budget</h2>
        <Button variant="ghost" size="icon-sm" aria-label="Edit budget split" onClick={openEdit}>
          <Settings2 className="w-4 h-4" />
        </Button>
      </div>

      {/* Nested rings + center safe-to-spend */}
      <div className="relative w-48 h-48 mx-auto mb-6">
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full h-full -rotate-90">
          {budget.allocation.map((row, i) => {
            const radius = OUTER_RADIUS - i * (STROKE_WIDTH + RING_GAP);
            const circumference = 2 * Math.PI * radius;
            // No income yet (limit === 0) but something was spent still reads
            // as fully over — an empty ring next to an "Over" glyph would be
            // a Gulf-of-Evaluation mismatch (CLAUDE.md §3).
            const pct = row.limit > 0 ? Math.min(row.spent / row.limit, 1) : row.spent > 0 ? 1 : 0;
            const color = row.over ? WARNING_COLOR : RING_PALETTE[i % RING_PALETTE.length];
            return (
              <g key={row.key}>
                <circle cx={CENTER} cy={CENTER} r={radius} strokeWidth={STROKE_WIDTH} fill="transparent" className="stroke-slate-850" />
                <circle
                  cx={CENTER}
                  cy={CENTER}
                  r={radius}
                  strokeWidth={STROKE_WIDTH}
                  fill="transparent"
                  strokeDasharray={circumference}
                  strokeDashoffset={circumference * (1 - pct)}
                  strokeLinecap="round"
                  stroke={color}
                  className="transition-[stroke-dashoffset] duration-700 ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none"
                />
              </g>
            );
          })}
        </svg>

        {/* Warning glyphs on over-limit rings — colour is never the only signal */}
        {budget.allocation.map((row, i) => {
          if (!row.over) return null;
          const radius = OUTER_RADIUS - i * (STROKE_WIDTH + RING_GAP);
          const topPercent = ((CENTER - radius) / SIZE) * 100;
          return (
            <span
              key={row.key}
              aria-hidden="true"
              title={`${row.label} is over budget`}
              className="absolute left-1/2 w-4 h-4 -translate-x-1/2 -translate-y-1/2 rounded-full flex items-center justify-center ring-2 ring-surface-dark"
              style={{ top: `${topPercent}%`, backgroundColor: WARNING_COLOR }}
            >
              <AlertTriangle className="w-2.5 h-2.5 text-white" strokeWidth={3} />
            </span>
          );
        })}

        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
          <CountUp
            value={Math.abs(budget.safeToSpend)}
            prefix={isNegative ? `-${currencySymbol}` : currencySymbol}
            decimals={2}
            className="text-lg font-black text-white tabular-nums leading-none"
          />
          <span className="text-[8px] font-bold text-slate-450 uppercase tracking-tight mt-1.5">Safe to spend</span>
        </div>
      </div>

      {/* Legend */}
      <div className="space-y-2.5">
        {budget.allocation.map((row, i) => (
          <div key={row.key} className="flex items-center justify-between text-[11px] gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: row.over ? WARNING_COLOR : RING_PALETTE[i % RING_PALETTE.length] }}
              />
              <span className="font-bold text-slate-300 truncate">{row.label}</span>
              <span className="text-slate-500 shrink-0">{row.percent}%</span>
              {row.over && (
                <span className="inline-flex items-center gap-1 text-rose-450 font-black uppercase tracking-wide text-[9px] shrink-0">
                  <AlertTriangle className="w-3 h-3" /> Over
                </span>
              )}
            </div>
            <span className="font-black text-slate-300 tabular-nums shrink-0">
              {formatAmount(row.spent)} / {formatAmount(row.limit)}
            </span>
          </div>
        ))}
      </div>

      {/* Edit split */}
      <Modal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        title="Edit budget split"
        description="Percent of monthly income allocated to each bucket."
      >
        <div className="space-y-4">
          {draftBuckets.map((b, i) => (
            <div key={b.key}>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">{b.label}</label>
              <NumberInput
                size="sm"
                min={0}
                max={100}
                step={1}
                value={b.percent}
                onChange={(v) =>
                  setDraftBuckets((prev) => prev.map((x, xi) => (xi === i ? { ...x, percent: Number(v) || 0 } : x)))
                }
              />
            </div>
          ))}
          <p className={cn('text-xs font-bold', draftTotal > 100 ? 'text-rose-450' : 'text-slate-450')}>
            Total: {draftTotal}% {draftTotal > 100 && '— reduce to 100% or less'}
          </p>
          <Button variant="primary" fullWidth className="h-11" disabled={draftTotal > 100} onClick={handleSaveSplit}>
            Save split
          </Button>
        </div>
      </Modal>
    </div>
  );
}
