'use client';

import React, { useId } from 'react';
import { cn } from '@/lib/utils';

export type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';

export interface TooltipProps {
  content: React.ReactNode;
  position?: TooltipPosition;
  /** A single focusable/hoverable element (button, icon, link…). */
  children: React.ReactElement<{ 'aria-describedby'?: string }>;
  className?: string;
}

const POSITIONS: Record<TooltipPosition, string> = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  left: 'right-full top-1/2 -translate-y-1/2 mr-2',
  right: 'left-full top-1/2 -translate-y-1/2 ml-2',
};

export function Tooltip({ content, position = 'top', children, className = '' }: TooltipProps) {
  const id = useId();

  return (
    <span className="relative inline-flex group/tooltip">
      {React.cloneElement(children, { 'aria-describedby': id })}
      <span
        id={id}
        role="tooltip"
        className={cn(
          'absolute z-50 px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-semibold text-slate-200 whitespace-nowrap shadow-lg',
          'opacity-0 scale-95 pointer-events-none transition-all duration-150 ease-[cubic-bezier(0.4,0,0.2,1)]',
          'group-hover/tooltip:opacity-100 group-hover/tooltip:scale-100 group-focus-within/tooltip:opacity-100 group-focus-within/tooltip:scale-100',
          POSITIONS[position],
          className,
        )}
      >
        {content}
      </span>
    </span>
  );
}
