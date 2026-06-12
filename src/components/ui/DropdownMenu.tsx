'use client';

import { useEffect, useRef, type ReactNode } from 'react';

type DropdownMenuProps = {
  open: boolean;
  onClose?: () => void;
  trigger: ReactNode;
  children: ReactNode;
  align?: 'left' | 'right';
  className?: string;
  dropdownClassName?: string;
};

export function DropdownMenu({
  open,
  onClose,
  trigger,
  children,
  align = 'right',
  className = '',
  dropdownClassName = '',
}: DropdownMenuProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!onClose) return;

    const handleOutsideClick = (event: MouseEvent) => {
      if (!open) return;
      if (containerRef.current?.contains(event.target as Node)) return;
      onClose();
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [open, onClose]);

  const hasWidthOrDisplay = className.includes('w-') || className.includes('flex') || className.includes('block');
  const containerClasses = `relative ${hasWidthOrDisplay ? '' : 'inline-flex'} ${className}`;

  return (
    <div ref={containerRef} className={containerClasses}>
      {trigger}

      <div
        className={`absolute z-50 mt-2 rounded-3xl border border-slate-200/85 bg-white shadow-2xl shadow-slate-950/10 ring-1 ring-slate-900/5 transition-all duration-200 dark:border-slate-700/75 dark:bg-slate-950 ${
          open
            ? 'visible opacity-100 scale-100'
            : 'invisible opacity-0 scale-95 pointer-events-none'
        } ${align === 'left' ? 'left-0' : 'right-0'} ${
          dropdownClassName || 'min-w-[18rem] max-w-sm'
        }`}
      >
        {children}
      </div>
    </div>
  );
}
