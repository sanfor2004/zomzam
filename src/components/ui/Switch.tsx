'use client';

import React from 'react';

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
}

export function Switch({
  checked,
  onChange,
  disabled = false,
  className = '',
  ariaLabel = 'Toggle switch',
}: SwitchProps) {
  
  const handleToggle = () => {
    if (disabled) return;
    onChange(!checked);
  };

  return (
    <button
      type="button"
      role="switch"
      onClick={handleToggle}
      disabled={disabled}
      className={`w-11 h-6 rounded-full transition-colors duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] relative flex items-center disabled:opacity-50 disabled:cursor-not-allowed ${
        checked ? 'bg-primary-500' : 'bg-[#eee] dark:bg-slate-700'
      } ${className}`}
      aria-label={ariaLabel}
      aria-checked={checked}
    >
      <span
        className={`w-4 h-4 bg-white rounded-full absolute shadow-sm transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}
