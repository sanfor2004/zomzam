'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export interface DividerProps {
  label?: React.ReactNode;
  orientation?: 'horizontal' | 'vertical';
  className?: string;
}

export function Divider({ label, orientation = 'horizontal', className = '' }: DividerProps) {
  if (orientation === 'vertical') {
    return <span className={cn('inline-block w-px h-full bg-slate-800/60', className)} />;
  }

  if (!label) {
    return <hr className={cn('border-slate-800/60', className)} />;
  }

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <span className="flex-1 h-px bg-slate-800/60" />
      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{label}</span>
      <span className="flex-1 h-px bg-slate-800/60" />
    </div>
  );
}
