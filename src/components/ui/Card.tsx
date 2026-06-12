'use client';

import React from 'react';

export interface CardProps {
  title?: React.ReactNode;
  headerExtra?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

export function Card({
  title,
  headerExtra,
  footer,
  className = '',
  children,
}: CardProps) {
  return (
    <div
      className={`bg-white dark:bg-[#1A1D24] border border-slate-100 dark:border-slate-800/60 rounded-3xl p-6 shadow-apple relative overflow-hidden transition-all duration-300 ${className}`}
    >
      {/* Glow Effect */}
      <div className="absolute top-0 right-0 w-40 h-40 bg-primary-500/5 rounded-full -mr-16 -mt-16 blur-2xl pointer-events-none"></div>

      {/* Header */}
      {(title || headerExtra) && (
        <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-100 dark:border-slate-850">
          {title && (
            <h2 className="text-sm font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">
              {title}
            </h2>
          )}
          {headerExtra && <div>{headerExtra}</div>}
        </div>
      )}

      {/* Body Content */}
      <div className="relative z-10">{children}</div>

      {/* Footer */}
      {footer && (
        <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-850 flex items-center justify-between text-xs text-slate-400 font-semibold relative z-10">
          {footer}
        </div>
      )}
    </div>
  );
}
