'use client';

import React, { type ReactNode } from 'react';

type Props = {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
};

export function DropdownItem({ children, onClick, className = '' }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left px-4 py-2 text-sm text-slate-200 hover:bg-slate-800/40 transition-colors${className}`}
    >
      {children}
    </button>
  );
}
