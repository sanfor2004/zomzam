'use client';

import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface AccordionItemData {
  value: string;
  title: React.ReactNode;
  content: React.ReactNode;
  disabled?: boolean;
}

export interface AccordionProps {
  items: AccordionItemData[];
  /** "single" closes the previous panel when a new one opens. */
  type?: 'single' | 'multiple';
  defaultValue?: string[];
  className?: string;
}

export function Accordion({ items, type = 'single', defaultValue = [], className = '' }: AccordionProps) {
  const [open, setOpen] = useState<string[]>(defaultValue);

  const toggle = (value: string) => {
    setOpen((prev) => {
      const isOpen = prev.includes(value);
      if (type === 'single') return isOpen ? [] : [value];
      return isOpen ? prev.filter((v) => v !== value) : [...prev, value];
    });
  };

  return (
    <div className={cn('divide-y divide-slate-800/60 border border-slate-800/60 rounded-2xl overflow-hidden surface-card', className)}>
      {items.map((item) => {
        const isOpen = open.includes(item.value);
        return (
          <div key={item.value}>
            <button
              type="button"
              disabled={item.disabled}
              aria-expanded={isOpen}
              onClick={() => toggle(item.value)}
              className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left text-sm font-bold text-slate-200 hover:bg-slate-800/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>{item.title}</span>
              <ChevronDown className={cn('w-4 h-4 text-slate-400 shrink-0 transition-transform duration-300', isOpen && 'rotate-180')} />
            </button>

            <div
              className={cn(
                'grid transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]',
                isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
              )}
            >
              <div className="overflow-hidden">
                <div className="px-5 pb-4 text-sm text-slate-400 leading-relaxed">{item.content}</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
