'use client';

import React, { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { CountUp } from './CountUp';

/* ──────────────────────────────────────────────────────────
    DEVELOPMENT NAVIGATOR: SECTION HEADER — CARD/SECTION TITLE PRIMITIVE
    Contains: accent icon tile, title, optional CountUp count pill,
              optional right-actions slot
    ──────────────────────────────────────────────────────────
    Replaces the bare uppercase <h2> repeated on every Time page (rule-of-
    three ×5 → one primitive, per Section 2.0). The suite accent lives HERE
    (icon tile + count pill), not on the row edges — depth carries the rows.
    Colour = meaning (spec-11 §5): chrome is orange or neutral only, so the
    accent collapsed from a 5-hue rainbow to primary|neutral. Data hues live on
    the row edges (priorityEdge / horizonEdge), never on the section chrome. */

export type SectionHeaderAccent = 'primary' | 'neutral';

const ACCENT_TILE: Record<SectionHeaderAccent, string> = {
  primary: 'bg-primary-500/15 text-primary-500',
  neutral: 'bg-slate-800/70 text-slate-300',
};

const ACCENT_PILL: Record<SectionHeaderAccent, string> = {
  primary: 'bg-primary-500/10 text-primary-500',
  neutral: 'bg-slate-800/70 text-slate-300',
};

export interface SectionHeaderProps {
  /** Lucide icon (or any node) shown in the accent tile. */
  icon?: React.ReactNode;
  /** Accent colour for the tile + count pill. Restricted to the theme ramp. */
  accent?: SectionHeaderAccent;
  title: string;
  /** When provided, renders a count pill that counts up once on mount. */
  count?: number;
  /** Suffix inside the count pill, e.g. "open" → "12 open". */
  countLabel?: string;
  /** Right-aligned slot: legends, sync buttons, date pills — never lost. */
  actions?: React.ReactNode;
  className?: string;
}

/* Count pill: CountUp animates 0→count ONCE on mount, then live list mutations
   (add / complete / delete) update a plain number — so the pill never re-fires
   its 0→N sweep and flickers on every optimistic change (spec 10 §7). */
function CountPill({ count, label, accent }: { count: number; label?: string; accent: SectionHeaderAccent }) {
  const initial = useRef(count);
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    // Hand off from the mount tween to the live value once it has run (~CountUp
    // default duration). Reduced-motion CountUp resolves instantly; the swap is
    // harmless there too.
    const timer = setTimeout(() => setSettled(true), 1400);
    return () => clearTimeout(timer);
  }, []);

  return (
    <span className={cn('text-xs font-bold px-2.5 py-1 rounded-full tabular-nums', ACCENT_PILL[accent])}>
      {settled ? count : <CountUp value={initial.current} />}
      {label ? <span className="ml-1 opacity-70 font-semibold">{label}</span> : null}
    </span>
  );
}

export function SectionHeader({
  icon,
  accent = 'primary',
  title,
  count,
  countLabel,
  actions,
  className = '',
}: SectionHeaderProps) {
  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-3', className)}>
      <div className="flex items-center gap-2.5 min-w-0">
        {icon && (
          <span className={cn('w-8 h-8 rounded-xl flex items-center justify-center shrink-0 [&>svg]:w-4 [&>svg]:h-4', ACCENT_TILE[accent])}>
            {icon}
          </span>
        )}
        <h2 className="text-sm font-bold text-slate-200 tracking-tight truncate">{title}</h2>
        {typeof count === 'number' && <CountPill count={count} label={countLabel} accent={accent} />}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}
