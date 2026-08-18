'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export type ProgressVariant = 'primary' | 'success' | 'danger' | 'warning';

export interface ProgressProps {
  value: number;
  max?: number;
  label?: React.ReactNode;
  showValue?: boolean;
  variant?: ProgressVariant;
  size?: 'sm' | 'md';
  className?: string;
}

const VARIANTS: Record<ProgressVariant, string> = {
  primary: 'bg-primary-500',
  success: 'bg-emerald-500',
  danger: 'bg-rose-500',
  warning: 'bg-amber-500',
};

export function Progress({ value, max = 100, label, showValue = false, variant = 'primary', size = 'md', className = '' }: ProgressProps) {
  const percent = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div className={cn('w-full', className)}>
      {(label || showValue) && (
        <div className="flex justify-between items-center mb-1.5">
          {label && <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</span>}
          {showValue && <span className="text-xs font-black text-slate-300">{Math.round(percent)}%</span>}
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        className={cn('w-full bg-slate-850 rounded-full overflow-hidden', size === 'sm' ? 'h-1.5' : 'h-2.5')}
      >
        <div
          className={cn('h-full rounded-full transition-[width] duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]', VARIANTS[variant])}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
