'use client';

import React, { type ReactNode } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ──────────────────────────────────────────────────────────
    DEVELOPMENT NAVIGATOR: NUMBER INPUT
    Contains: numeric <input> with a left adornment slot and a
    stacked up/down stepper on the right edge
    ──────────────────────────────────────────────────────────

    A polished replacement for raw `<input type="number">`. The
    native browser spinners are hidden and replaced with a custom
    glass stepper (▲ / ▼). `onChange` emits a string so it is a
    drop-in for the existing string-state handlers across the app. */

export interface NumberInputProps {
  value: string | number;
  /** Emits the raw string value (drop-in for `setX(e.target.value)`). */
  onChange: (value: string) => void;
  /** Fires when the field loses focus — for commit-on-blur validation. */
  onBlur?: () => void;
  min?: number;
  max?: number;
  /** Stepper increment. Defaults to 1. */
  step?: number;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  /** Left adornment (e.g. "$", "EGP"). */
  prefix?: ReactNode;
  /** Visual size. `lg` matches the big money amount fields. */
  size?: 'sm' | 'lg';
  /** Focus + stepper hover colour. */
  accent?: 'primary' | 'emerald';
  /** Extra classes for the wrapper (e.g. width overrides). */
  className?: string;
  id?: string;
  name?: string;
  ariaLabel?: string;
}

const ACCENTS = {
  primary: {
    focus: 'focus:border-primary-500',
    hover: 'hover:bg-primary-500/15 hover:text-primary-400',
  },
  emerald: {
    focus: 'focus:border-emerald-500',
    hover: 'hover:bg-emerald-500/15 hover:text-emerald-400',
  },
} as const;

const SIZES = {
  sm: {
    input: 'h-11 text-sm rounded-xl',
    /** 6px gap + 28px stepper (w-7) + 6px right inset — same 6px rhythm on every side. */
    pad: 'pr-10',
    /** Sized for a 3-letter currency code ("USD") at text-sm bold — pl-9 clipped it. */
    padPrefix: 'pl-12',
    pad0: 'pl-3.5',
    /** Prefix matches the field's own text size/weight for a cohesive look. */
    prefix: 'left-3.5 text-sm font-bold',
    stepper: 'w-7',
    stepperIcon: 'w-3 h-3',
  },
  lg: {
    input: 'h-12 text-xl font-black rounded-2xl',
    /** 6px gap + 32px stepper (w-8) + 6px right inset — same 6px rhythm on every side. */
    pad: 'pr-11',
    padPrefix: 'pl-16',
    pad0: 'pl-4',
    prefix: 'left-4 text-xl font-black',
    stepper: 'w-8',
    stepperIcon: 'w-3.5 h-3.5',
  },
} as const;

export function NumberInput({
  value,
  onChange,
  onBlur,
  min,
  max,
  step = 1,
  placeholder,
  disabled = false,
  required = false,
  prefix,
  size = 'sm',
  accent = 'primary',
  className = '',
  id,
  name,
  ariaLabel,
}: NumberInputProps) {
  const accentCls = ACCENTS[accent];
  const sizeCls = SIZES[size];

  const clamp = (n: number) => {
    if (min !== undefined) n = Math.max(min, n);
    if (max !== undefined) n = Math.min(max, n);
    return n;
  };

  const stepBy = (direction: 1 | -1) => {
    if (disabled) return;
    const current = parseFloat(String(value));
    const base = Number.isNaN(current) ? (min ?? 0) : current;
    const next = clamp(base + direction * step);
    // Trim floating-point noise from fractional steps.
    onChange(Number.isInteger(step) ? String(next) : String(parseFloat(next.toFixed(6))));
  };

  return (
    <div className={cn('relative w-full', className)}>
      {prefix != null && (
        <span
          className={cn(
            'absolute top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none select-none',
            sizeCls.prefix,
          )}
        >
          {prefix}
        </span>
      )}

      <input
        id={id}
        name={name}
        type="number"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        min={min}
        max={max}
        step={step}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        aria-label={ariaLabel}
        className={cn(
          'w-full bg-slate-900/30 border border-slate-850 text-white outline-none transition-colors placeholder-slate-500',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          // Hide the native number spinners — we render our own.
          '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-inner-spin-button]:m-0',
          sizeCls.input,
          sizeCls.pad,
          prefix != null ? sizeCls.padPrefix : sizeCls.pad0,
          accentCls.focus,
        )}
      />

      {/* Stacked up/down stepper */}
      <div
        className={cn(
          'absolute right-1.5 top-1.5 bottom-1.5 flex flex-col rounded-lg overflow-hidden border border-slate-700/50 bg-slate-800/40 divide-y divide-slate-700/50',
          sizeCls.stepper,
        )}
      >
        <button
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          disabled={disabled || (max !== undefined && parseFloat(String(value)) >= max)}
          onClick={() => stepBy(1)}
          className={cn(
            'flex-1 flex items-center justify-center text-slate-400 transition-colors active:scale-95 disabled:opacity-40 disabled:pointer-events-none',
            accentCls.hover,
          )}
        >
          <ChevronUp className={sizeCls.stepperIcon} strokeWidth={2.5} />
        </button>
        <button
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          disabled={disabled || (min !== undefined && parseFloat(String(value)) <= min)}
          onClick={() => stepBy(-1)}
          className={cn(
            'flex-1 flex items-center justify-center text-slate-400 transition-colors active:scale-95 disabled:opacity-40 disabled:pointer-events-none',
            accentCls.hover,
          )}
        >
          <ChevronDown className={sizeCls.stepperIcon} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}
