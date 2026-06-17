'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export interface SkeletonProps {
  className?: string;
  variant?: 'block' | 'circle' | 'text';
}

/** Shimmer loading placeholder — built on the `--animate-shimmer` token in globals.css. */
export function Skeleton({ className = '', variant = 'block' }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'bg-gradient-to-r from-slate-800 via-slate-700/60 to-slate-800 bg-[length:200%_100%] animate-shimmer',
        variant === 'circle' ? 'rounded-full' : variant === 'text' ? 'rounded-md h-3.5' : 'rounded-xl',
        className,
      )}
    />
  );
}
