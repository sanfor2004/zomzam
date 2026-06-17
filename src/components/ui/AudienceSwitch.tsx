'use client';

import React from 'react';
import { Users, Globe, Lock, type LucideIcon } from 'lucide-react';

/* ──────────────────────────────────────────────────────────
    DEVELOPMENT NAVIGATOR: AUDIENCE SWITCH — POST VISIBILITY CONTROL
    Contains: segmented radiogroup of audience options
    ──────────────────────────────────────────────────────────
    A reusable segmented control for choosing who can see a post.
    'exclusive' is opt-in via `includeExclusive` so the composer can
    hide it while other surfaces (e.g. settings, edit) can expose it. */

export type PostVisibility = 'friends' | 'public' | 'exclusive';

interface AudienceOption {
  value: PostVisibility;
  label: string;
  icon: LucideIcon;
  hint: string;
}

const ALL_OPTIONS: AudienceOption[] = [
  { value: 'friends', label: 'Friends', icon: Users, hint: 'Friends only — your mutual connections' },
  { value: 'public', label: 'Public', icon: Globe, hint: 'Public — everyone can see this' },
  { value: 'exclusive', label: 'Exclusive', icon: Lock, hint: 'Exclusive — a restricted circle' },
];

export interface AudienceSwitchProps {
  value: PostVisibility;
  onChange: (value: PostVisibility) => void;
  /** Include the 'exclusive' option (hidden by default). */
  includeExclusive?: boolean;
  /** Hide the text labels, leaving icon-only chips. */
  iconOnly?: boolean;
  disabled?: boolean;
  className?: string;
  /** Accessible group label. */
  ariaLabel?: string;
}

export function AudienceSwitch({
  value,
  onChange,
  includeExclusive = false,
  iconOnly = false,
  disabled = false,
  className = '',
  ariaLabel = 'Who can see this post',
}: AudienceSwitchProps) {
  const options = includeExclusive
    ? ALL_OPTIONS
    : ALL_OPTIONS.filter((o) => o.value !== 'exclusive');

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={`flex items-center gap-0.5 bg-[#111318] border border-slate-800/60 rounded-xl p-0.5 ${className}`}
    >
      {options.map(({ value: optionValue, label, icon: Icon, hint }) => {
        const isActive = value === optionValue;
        return (
          <button
            key={optionValue}
            type="button"
            role="radio"
            aria-checked={isActive}
            disabled={disabled}
            title={hint}
            onClick={() => onChange(optionValue)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed ${
              isActive
                ? 'bg-primary-500 text-white shadow-md shadow-primary-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {!iconOnly && <span className="hidden sm:inline">{label}</span>}
          </button>
        );
      })}
    </div>
  );
}
