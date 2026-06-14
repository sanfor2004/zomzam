'use client';

import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { DropdownMenu } from './DropdownMenu';

export interface SelectOption {
  value: string | number;
  label: React.ReactNode;
}

export interface SelectProps {
  value: string | number;
  onChange: (value: any) => void;
  options: (SelectOption | string)[];
  label?: string;
  className?: string;
  disabled?: boolean;
}

export function Select({
  value,
  onChange,
  options,
  label,
  className = '',
  disabled = false,
}: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Normalize options array to always be SelectOption objects
  const normalizedOptions: SelectOption[] = options.map((opt) =>
    typeof opt === 'string' ? { value: opt, label: opt } : opt
  );

  const selectedOption = normalizedOptions.find((opt) => opt.value === value) || normalizedOptions[0];

  const handleSelect = (optValue: string | number) => {
    if (disabled) return;
    onChange(optValue);
    setIsOpen(false);
  };

  return (
    <div className={`w-full${className}`}>
      {label && (
        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">
          {label}
        </label>
      )}
      
      <DropdownMenu
        open={isOpen}
        onClose={() => setIsOpen(false)}
        className="w-full flex"
        dropdownClassName="w-full max-h-60 overflow-y-auto p-1.5 space-y-0.5"
        trigger={
          <button
            type="button"
            disabled={disabled}
            onClick={() => setIsOpen((prev) => !prev)}
            className="w-full h-11 flex items-center justify-between px-3.5 bg-slate-900/30 border border-slate-850 rounded-xl text-sm text-white focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed text-left"
          >
            <span className="truncate">{selectedOption?.label || ''}</span>
            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-300${isOpen ? 'rotate-180' : ''}`} />
          </button>
        }
      >
        {normalizedOptions.map((opt) => {
          const isSelected = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleSelect(opt.value)}
              className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-colors${
                isSelected
                  ? 'bg-primary-500 text-white shadow-sm'
                  : 'text-slate-350 hover:bg-slate-900'
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </DropdownMenu>
    </div>
  );
}
