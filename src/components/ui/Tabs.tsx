'use client';

import React, { useState } from 'react';
import { cn } from '@/lib/utils';

/* ──────────────────────────────────────────────────────────
    DEVELOPMENT NAVIGATOR: TABS
    Contains: tab list (underline/pill variant), active panel
    ──────────────────────────────────────────────────────────
    Controlled via `value`/`onChange`, or self-managed via
    `defaultValue` when those are omitted. */

export interface TabItem {
  value: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
  disabled?: boolean;
  content: React.ReactNode;
}

export interface TabsProps {
  items: TabItem[];
  value?: string;
  onChange?: (value: string) => void;
  defaultValue?: string;
  variant?: 'underline' | 'pill';
  className?: string;
}

export function Tabs({ items, value, onChange, defaultValue, variant = 'underline', className = '' }: TabsProps) {
  const [internal, setInternal] = useState(defaultValue ?? items[0]?.value);
  const active = value ?? internal;
  const activeItem = items.find((item) => item.value === active);

  const setActive = (next: string) => {
    if (onChange) onChange(next);
    else setInternal(next);
  };

  return (
    <div className={cn('w-full', className)}>
      <div
        role="tablist"
        className={cn(
          'flex items-center gap-1',
          variant === 'underline'
            ? 'border-b border-slate-800/60'
            : 'bg-[#111318] border border-slate-800/60 rounded-xl p-1 w-fit',
        )}
      >
        {items.map((item) => {
          const isActive = item.value === active;
          return (
            <button
              key={item.value}
              type="button"
              role="tab"
              aria-selected={isActive}
              disabled={item.disabled}
              onClick={() => setActive(item.value)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed',
                variant === 'underline'
                  ? cn(
                      'border-b-2 -mb-px',
                      isActive ? 'border-primary-500 text-white' : 'border-transparent text-slate-400 hover:text-slate-200',
                    )
                  : cn(
                      'rounded-lg',
                      isActive
                        ? 'bg-primary-500 text-white shadow-md shadow-primary-500/20'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/50',
                    ),
              )}
            >
              {item.icon}
              {item.label}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" className="pt-5">
        {activeItem?.content}
      </div>
    </div>
  );
}
