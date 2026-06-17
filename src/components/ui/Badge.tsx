'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps {
  variant?: 'success' | 'warning' | 'error' | 'neutral' | 'info' | 'primary';
  pulse?: boolean;
  className?: string;
  children: React.ReactNode;
}

const VARIANTS: Record<NonNullable<BadgeProps['variant']>, string> = {
  success: 'bg-green-500/10 border-green-500/20 text-green-500 dark:bg-green-500/10 dark:border-green-500/20 dark:text-green-400',
  warning: 'bg-amber-500/10 border-amber-500/20 text-amber-500 dark:bg-amber-500/10 dark:border-amber-500/20 dark:text-amber-400',
  error: 'bg-red-500/10 border-red-500/20 text-red-500 dark:bg-red-500/10 dark:border-red-500/20 dark:text-red-400',
  info: 'bg-blue-500/10 border-blue-500/20 text-blue-500 dark:bg-blue-500/10 dark:border-blue-500/20 dark:text-blue-400',
  primary: 'bg-primary-500/10 border-primary-500/20 text-primary-500 dark:bg-primary-500/10 dark:border-primary-500/20 dark:text-primary-400',
  neutral: 'bg-slate-100 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400',
};

const DOTS: Record<NonNullable<BadgeProps['variant']>, string> = {
  success: 'bg-green-500 dark:bg-green-400',
  warning: 'bg-amber-400 dark:bg-amber-400',
  error: 'bg-red-500 dark:bg-red-400',
  info: 'bg-blue-500 dark:bg-blue-400',
  primary: 'bg-primary-500 dark:bg-primary-400',
  neutral: 'bg-slate-400 dark:bg-slate-600',
};

export function Badge({
  variant = 'neutral',
  pulse = false,
  className = '',
  children,
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-wider transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]',
        VARIANTS[variant],
        className,
      )}
    >
      {pulse && <span className={cn('w-1.5 h-1.5 rounded-full animate-pulse', DOTS[variant])} />}
      {children}
    </span>
  );
}
