'use client';

import React, { useId } from 'react';
import { cn } from '@/lib/utils';

/* ──────────────────────────────────────────────────────────
    DEVELOPMENT NAVIGATOR: INPUT — UNIVERSAL TEXT FIELD
    Contains: label, left/right icon slots, error/hint footer
    ──────────────────────────────────────────────────────────
    The styled replacement for the raw <input> markup repeated
    across settings/CRM pages (bg-slate-900/30, border-slate-850,
    focus:border-primary-500). One field, every text-input need. */

export type InputSize = 'sm' | 'md' | 'lg';

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  size?: InputSize;
  containerClassName?: string;
}

const SIZES: Record<InputSize, string> = {
  sm: 'h-9 text-xs rounded-lg',
  md: 'h-11 text-sm rounded-xl',
  lg: 'h-12 text-base rounded-xl',
};

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    label,
    hint,
    error,
    leftIcon,
    rightIcon,
    size = 'md',
    className = '',
    containerClassName = '',
    id,
    ...props
  },
  ref,
) {
  const reactId = useId();
  const inputId = id ?? reactId;
  // Screen readers announce the error/hint footer as the input's description.
  const describedById = `${inputId}-desc`;
  const hasFooter = Boolean(error || hint);

  return (
    <div className={cn('w-full', containerClassName)}>
      {label && (
        <label htmlFor={inputId} className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">
          {label}
        </label>
      )}

      <div className="relative">
        {leftIcon && (
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
            {leftIcon}
          </span>
        )}

        <input
          ref={ref}
          id={inputId}
          aria-invalid={!!error || undefined}
          aria-describedby={hasFooter ? describedById : undefined}
          className={cn(
            'w-full bg-slate-900/30 border text-white outline-none transition-colors placeholder-slate-500',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            error ? 'border-red-500/60 focus:border-red-500' : 'border-slate-850 focus:border-primary-500',
            SIZES[size],
            leftIcon ? 'pl-10' : 'pl-3.5',
            rightIcon ? 'pr-10' : 'pr-3.5',
            className,
          )}
          {...props}
        />

        {rightIcon && (
          <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400">
            {rightIcon}
          </span>
        )}
      </div>

      {error ? (
        <p id={describedById} className="mt-1.5 text-[11px] font-semibold text-red-400">{error}</p>
      ) : hint ? (
        <p id={describedById} className="mt-1.5 text-[11px] text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
});
