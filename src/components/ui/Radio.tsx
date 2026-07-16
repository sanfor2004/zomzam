'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export interface RadioOption<T extends string | number = string> {
  value: T;
  label: React.ReactNode;
  description?: React.ReactNode;
  disabled?: boolean;
}

export interface RadioGroupProps<T extends string | number = string> {
  value: T;
  onChange: (value: T) => void;
  options: RadioOption<T>[];
  orientation?: 'vertical' | 'horizontal';
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
}

export function RadioGroup<T extends string | number = string>({
  value,
  onChange,
  options,
  orientation = 'vertical',
  disabled = false,
  className = '',
  ariaLabel,
}: RadioGroupProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn('flex gap-3', orientation === 'vertical' ? 'flex-col' : 'flex-row flex-wrap', className)}
    >
      {options.map((opt) => {
        const isActive = opt.value === value;
        const isDisabled = disabled || opt.disabled;
        return (
          <button
            key={String(opt.value)}
            type="button"
            role="radio"
            aria-checked={isActive}
            disabled={isDisabled}
            onClick={() => onChange(opt.value)}
            className="group inline-flex items-start gap-2.5 text-left select-none disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span
              className={cn(
                'mt-0.5 w-[18px] h-[18px] shrink-0 rounded-full border flex items-center justify-center transition-colors duration-200',
                isActive ? 'border-primary-500' : 'border-slate-700 group-hover:border-primary-500/50',
              )}
            >
              <span
                className={cn(
                  'w-2 h-2 rounded-full bg-primary-500 transition-transform duration-200',
                  isActive ? 'scale-100' : 'scale-0',
                )}
              />
            </span>

            <span className="flex flex-col">
              <span className="text-sm text-slate-200 font-medium leading-tight">{opt.label}</span>
              {opt.description && <span className="text-xs text-slate-500 mt-0.5">{opt.description}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}
