'use client';

import React from 'react';
import { Check, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Renders a dash instead of a check — for "some selected" parent states. */
  indeterminate?: boolean;
  disabled?: boolean;
  label?: React.ReactNode;
  description?: React.ReactNode;
  className?: string;
  id?: string;
}

export function Checkbox({
  checked,
  onChange,
  indeterminate = false,
  disabled = false,
  label,
  description,
  className = '',
  id,
}: CheckboxProps) {
  const isFilled = checked || indeterminate;

  return (
    <button
      type="button"
      id={id}
      role="checkbox"
      aria-checked={indeterminate ? 'mixed' : checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'group flex w-full items-start gap-2.5 text-left select-none disabled:opacity-50 disabled:cursor-not-allowed',
        className,
      )}
    >
      <span
        className={cn(
          'mt-0.5 w-[18px] h-[18px] shrink-0 rounded-md border flex items-center justify-center transition-colors duration-200',
          isFilled ? 'bg-primary-500 border-primary-500' : 'bg-slate-900/30 border-slate-700 group-hover:border-primary-500/50',
        )}
      >
        {indeterminate ? (
          <Minus className="w-3 h-3 text-white" strokeWidth={3} />
        ) : checked ? (
          <Check className="w-3 h-3 text-white" strokeWidth={3} />
        ) : null}
      </span>

      {(label || description) && (
        <span className="flex flex-col">
          {label && <span className="text-sm text-slate-200 font-medium leading-tight">{label}</span>}
          {description && <span className="text-xs text-slate-500 mt-0.5">{description}</span>}
        </span>
      )}
    </button>
  );
}
