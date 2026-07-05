'use client';

import React from 'react';
import Link from 'next/link';
import { Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ──────────────────────────────────────────────────────────
    DEVELOPMENT NAVIGATOR: PROLOCK — PRO UPSELL / LOCKED-SURFACE PRIMITIVE
    Contains: 'strip' (full-width money panel) + 'inline' (wraps a
              gated control), blurred value mask, lock glyph, Pro CTA
    ──────────────────────────────────────────────────────────
    One primitive, two call sites (money strip + Notion sync button).
    Colour = meaning: orange appears ONLY on the CTA — it names "this is
    a Zomzam upgrade", nothing else on the surface competes for it.

    ⚠ CEILING — presentation only, NOT a gate. There is no `isPro` on the
    session and no billing yet (`/pricing` records intent; Stripe is a later
    step). ProLock hides a number behind a blur and routes to the upgrade
    funnel — a determined user is NOT blocked at the API. That is acceptable
    pre-Stripe. UPGRADE PATH: when billing lands, add a real server-side
    `isPro` check on the gated action/value; these call sites stay unchanged. */

export type ProLockVariant = 'strip' | 'inline';

export interface ProLockProps {
  /** 'strip' = full-width bordered panel; 'inline' = overlay a wrapped control. */
  variant?: ProLockVariant;
  /** Plain-spoken feature name, e.g. "See what your time earns". */
  label: string;
  /** Optional real-data line, shown clear (strip only). e.g. "This week — 12h focused". */
  sublabel?: string;
  /** The gated value, rendered under a static blur mask (strip only). aria-hidden. */
  blurred?: React.ReactNode;
  /** Where the CTA routes. Defaults to the pricing page. */
  href?: string;
  /** The control being gated (inline only) — rendered blurred behind the Pro overlay. */
  children?: React.ReactNode;
  className?: string;
}

export function ProLock({
  variant = 'strip',
  label,
  sublabel,
  blurred,
  href = '/pricing',
  children,
  className = '',
}: ProLockProps) {
  // ── inline: a self-sized "🔒 label · Pro" pill that routes to `href`. The
  //    `label · Pro` text sits in normal flow so it sizes the pill; any `children`
  //    (e.g. the gated control's icon) render as a faint clipped ghost behind it —
  //    a hint of what's locked, never a legible duplicate of the label.
  if (variant === 'inline') {
    return (
      <Link
        href={href}
        aria-label={`${label} — upgrade to Pro`}
        className={cn(
          'group relative inline-flex h-9 items-center gap-1.5 overflow-hidden rounded-xl border border-slate-800/60 bg-surface-dark px-4 text-xs font-semibold text-slate-300 transition-colors hover:border-primary-500/40',
          className,
        )}
      >
        {children != null && (
          <span aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-25 blur-[1px]">
            {children}
          </span>
        )}
        <Lock className="relative h-3.5 w-3.5 text-primary-500" />
        <span className="relative">{label} · <span className="text-primary-500">Pro</span></span>
      </Link>
    );
  }

  // ── strip: calm neutral panel — clear sublabel + blurred value + Pro CTA.
  return (
    <Link
      href={href}
      aria-label={`${label} — upgrade to Pro`}
      className={cn(
        'group flex min-h-[56px] items-center justify-between gap-4 rounded-2xl border border-slate-800/60 surface-base px-5 py-4 transition-colors hover:border-primary-500/40',
        className,
      )}
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-200">{label}</p>
        {sublabel && <p className="mt-0.5 truncate text-xs text-slate-400">{sublabel}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {blurred != null && (
          <span aria-hidden className="select-none text-lg font-black text-slate-200 blur-sm">
            {blurred}
          </span>
        )}
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-500/10 px-3 py-1.5 text-xs font-semibold text-primary-500">
          <Lock className="h-3.5 w-3.5" />
          Pro
        </span>
      </div>
    </Link>
  );
}
