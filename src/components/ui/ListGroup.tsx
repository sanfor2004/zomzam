'use client';

import React from 'react';

export interface ListGroupProps {
  title: string;
  count?: number;
  children: React.ReactNode;
}

/**
 * Calm gray group header (label + optional green count pill) over an inset,
 * hairline-divided card — the iOS grouped-list rhythm shared by Settings,
 * Connections, Discover, and Requests. No overflow-hidden: it would clip a
 * row's ••• context-menu popover.
 */
export function ListGroup({ title, count, children }: ListGroupProps) {
  return (
    <section data-entrance="card">
      <div className="flex items-center gap-2 px-1 mb-2">
        <h2 className="text-[13px] font-semibold tracking-tight text-slate-400">{title}</h2>
        {typeof count === 'number' && count > 0 && (
          <span className="text-[10px] font-bold tabular-nums bg-emerald-500/15 text-emerald-400 px-1.5 py-0.5 rounded-full">
            {count}
          </span>
        )}
      </div>
      <div className="surface-card rounded-2xl border border-slate-800/60 divide-y divide-slate-800/60 shadow-apple">
        {children}
      </div>
    </section>
  );
}
