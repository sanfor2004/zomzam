'use client';

import React from 'react';

export interface CardProps {
  title?: React.ReactNode;
  headerExtra?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  /** Let child content (popovers, dropdown menus, tooltips) spill past the card
   *  edges instead of being clipped. The ambient corner glow stays clipped to
   *  the card either way — it lives in its own inset overflow-hidden layer. */
  allowOverflow?: boolean;
  children: React.ReactNode;
}

export function Card({
  title,
  headerExtra,
  footer,
  className = '',
  allowOverflow = false,
  children,
}: CardProps) {
  return (
    <div
      className={`surface-card border border-slate-800/60 rounded-3xl p-6 shadow-apple relative ${allowOverflow ? 'overflow-visible' : 'overflow-hidden'} transition-all duration-300 ${className}`}
    >
      {/* Header */}
      {(title || headerExtra) && (
        <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-850">
          {title && (
            <h2 className="text-sm font-black text-slate-300 uppercase tracking-widest">
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
        <div className="mt-6 pt-4 border-t border-slate-850 flex items-center justify-between text-xs text-slate-400 font-semibold relative z-10">
          {footer}
        </div>
      )}
    </div>
  );
}
