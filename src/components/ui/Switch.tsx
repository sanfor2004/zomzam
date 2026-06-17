'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
}

export function Switch({
  checked,
  onChange,
  disabled = false,
  className = '',
  ariaLabel = 'Toggle switch',
}: SwitchProps) {
  const handleToggle = () => {
    if (disabled) return;
    onChange(!checked);
  };

  return (
    <button
      type="button"
      role="switch"
      onClick={handleToggle}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-checked={checked}
      className={cn(
        'inline-flex w-11 h-6 shrink-0 items-center rounded-full transition-colors duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#111318]',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        checked
          ? 'bg-primary-500 hover:bg-primary-600'
          : 'bg-slate-700 hover:bg-slate-600 shadow-inner shadow-black/30',
        className,
      )}
    >
      <span
        className={cn(
          'inline-block w-4 h-4 rounded-full bg-white transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]',
          'shadow-[0_1px_2px_rgba(0,0,0,0.3),0_2px_5px_rgba(0,0,0,0.2)]',
          checked ? 'translate-x-6' : 'translate-x-1',
        )}
      />
    </button>
  );
}
