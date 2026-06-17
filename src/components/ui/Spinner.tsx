'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg';

export interface SpinnerProps {
  size?: SpinnerSize;
  label?: React.ReactNode;
  className?: string;
}

const SIZES: Record<SpinnerSize, string> = {
  xs: 'w-3.5 h-3.5',
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-9 h-9',
};

export function Spinner({ size = 'md', label, className = '' }: SpinnerProps) {
  return (
    <span role="status" className={cn('inline-flex items-center gap-2 text-primary-500', className)}>
      <Loader2 className={cn('animate-spin', SIZES[size])} />
      {label && <span className="text-xs font-semibold text-slate-400">{label}</span>}
    </span>
  );
}
