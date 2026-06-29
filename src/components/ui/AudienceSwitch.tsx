'use client';

import React, { useState } from 'react';
import { Users, Globe, Lock, Check, ChevronDown, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DropdownShell } from './Dropdown';

/* ──────────────────────────────────────────────────────────
    DEVELOPMENT NAVIGATOR: AUDIENCE SWITCH — POST VISIBILITY CONTROL
    Contains: a compact trigger chip (current audience: icon + label +
    chevron) that opens a rich popover — each option a row with icon,
    label, description, and a check on the active one
    ──────────────────────────────────────────────────────────
    Not the generic two-button segmented switch: a single chip that
    expands to a descriptive menu, so the audience hints (who exactly
    sees this) are surfaced inline instead of buried in tooltips, and
    it scales cleanly to 3+ options. 'exclusive' is opt-in via
    `includeExclusive`. Drop-in API (value / onChange / includeExclusive). */

export type PostVisibility = 'friends' | 'public' | 'exclusive';

interface AudienceOption {
  value: PostVisibility;
  label: string;
  icon: LucideIcon;
  hint: string;
}

const ALL_OPTIONS: AudienceOption[] = [
  { value: 'friends', label: 'Friends', icon: Users, hint: 'Your mutual connections' },
  { value: 'public', label: 'Public', icon: Globe, hint: 'Everyone can see this' },
  { value: 'exclusive', label: 'Exclusive', icon: Lock, hint: 'A restricted circle' },
];

export interface AudienceSwitchProps {
  value: PostVisibility;
  onChange: (value: PostVisibility) => void;
  /** Include the 'exclusive' option (hidden by default). */
  includeExclusive?: boolean;
  /** Trigger shows only the icon (no current-audience label). */
  iconOnly?: boolean;
  disabled?: boolean;
  className?: string;
  /** Accessible group label. */
  ariaLabel?: string;
  /** Which edge the popover aligns to. Default 'right'. */
  align?: 'left' | 'right';
}

export function AudienceSwitch({
  value,
  onChange,
  includeExclusive = false,
  iconOnly = false,
  disabled = false,
  className = '',
  ariaLabel = 'Who can see this post',
  align = 'right',
}: AudienceSwitchProps) {
  const [open, setOpen] = useState(false);

  const options = includeExclusive
    ? ALL_OPTIONS
    : ALL_OPTIONS.filter((o) => o.value !== 'exclusive');
  const current = options.find((o) => o.value === value) ?? options[0];
  const CurrentIcon = current.icon;

  const select = (next: PostVisibility) => {
    onChange(next);
    setOpen(false);
  };

  return (
    <DropdownShell
      open={open}
      onClose={() => setOpen(false)}
      align={align}
      className={cn('inline-flex', className)}
      dropdownClassName="w-72 p-1.5"
      trigger={
        <button
          type="button"
          disabled={disabled}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={ariaLabel}
          onClick={() => setOpen((p) => !p)}
          className={cn(
            'group inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-bold transition-all active:scale-[0.97]',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            open
              ? 'border-primary-500/40 bg-primary-500/10 text-primary-400'
              : 'border-slate-800/60 bg-[#111318] text-slate-300 hover:border-slate-700 hover:text-white',
          )}
        >
          <CurrentIcon className="w-3.5 h-3.5 text-primary-500" />
          {!iconOnly && <span>{current.label}</span>}
          <ChevronDown
            className={cn('w-3.5 h-3.5 text-slate-500 transition-transform duration-200', open && 'rotate-180')}
          />
        </button>
      }
    >
      <div role="menu" aria-label={ariaLabel}>
        <p className="px-2.5 pt-1.5 pb-1 text-[10px] font-black uppercase tracking-wider text-slate-500">
          Who can see this?
        </p>
        {options.map((opt) => {
          const Icon = opt.icon;
          const active = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              role="menuitemradio"
              aria-checked={active}
              onClick={() => select(opt.value)}
              className={cn(
                'w-full flex items-center gap-3 px-2.5 py-2 rounded-lg text-left transition-colors',
                active ? 'bg-primary-500/10 ring-1 ring-primary-500/25' : 'hover:bg-slate-800/60',
              )}
            >
              <span
                className={cn(
                  'flex items-center justify-center w-8 h-8 rounded-lg shrink-0',
                  active ? 'bg-primary-500/15 text-primary-400' : 'bg-slate-800/60 text-slate-400',
                )}
              >
                <Icon className="w-4 h-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn('block text-xs font-bold', active ? 'text-white' : 'text-slate-200')}>
                  {opt.label}
                </span>
                <span className="block text-[11px] text-slate-500 truncate">{opt.hint}</span>
              </span>
              {active && <Check className="w-4 h-4 text-primary-500 shrink-0" />}
            </button>
          );
        })}
      </div>
    </DropdownShell>
  );
}
