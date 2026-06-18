'use client';

import React from 'react';
import { cn } from '@/lib/utils';

/* ──────────────────────────────────────────────────────────
    DEVELOPMENT NAVIGATOR: SEGMENTED SWITCH
    Contains: track, sliding active-pill indicator, option buttons
    ──────────────────────────────────────────────────────────
    A tablist with one shared indicator that slides between options
    (CSS transform), as opposed to AudienceSwitch's per-button fill.
    The indicator's position is driven purely by `value`, so it
    reacts the instant `value` changes — keep it on a fast-updating
    piece of state if a tab's content swap needs its own slower,
    separately-timed transition (see src/app/sign/page.tsx). */

export interface SegmentedSwitchOption {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
}

export interface SegmentedSwitchProps {
  options: SegmentedSwitchOption[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
}

export function SegmentedSwitch({
  options,
  value,
  onChange,
  disabled = false,
  className = '',
  ariaLabel = 'Switch',
}: SegmentedSwitchProps) {
  const activeIndex = Math.max(0, options.findIndex((option) => option.value === value));

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn('relative flex p-1 bg-[#060709] rounded-2xl border border-white/[0.04]', className)}
    >
      <div
        aria-hidden="true"
        className="absolute top-1 bottom-1 left-1 rounded-xl bg-[#1a1d25] shadow-apple pointer-events-none transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none"
        style={{
          width: `calc((100% - 8px) / ${options.length})`,
          transform: `translateX(${activeIndex * 100}%)`,
        }}
      />
      {options.map((option) => {
        const isActive = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            disabled={disabled || option.disabled}
            onClick={() => onChange(option.value)}
            className={cn(
              'relative z-10 flex-1 py-2.5 text-[13px] font-bold rounded-xl transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed',
              isActive ? 'text-white' : 'text-slate-500 hover:text-slate-300',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
