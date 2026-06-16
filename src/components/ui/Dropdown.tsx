'use client';

import React, { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ──────────────────────────────────────────────────────────
    DEVELOPMENT NAVIGATOR: UNIFIED DROPDOWN
    Contains: DropdownItem (shared row), DropdownShell (popover
    primitive / menu mode), DropdownSelect (form picker / select
    mode), Dropdown (mode switch), legacy aliases
    ──────────────────────────────────────────────────────────

    Single source of truth for every dropdown in the app. Two
    behaviours, one shell:
      • mode="menu"   → imperative action menu (open/onClose + children)
      • mode="select" → controlled form picker (value/onChange + options)

    `Select`, `DropdownMenu` and `DropdownItem` are exported as
    ergonomic aliases of this one module so existing call sites keep
    working unchanged. New code should prefer <Dropdown mode="…">. */

export type DropdownAlign = 'left' | 'right';

/* ──────────────────────────────────────────────────────────
    DEVELOPMENT NAVIGATOR: SHARED ITEM ROW
    Contains: leading/trailing slots, active (selected) variant
    ────────────────────────────────────────────────────────── */
export interface DropdownItemProps {
  children: ReactNode;
  onClick?: () => void;
  /** Renders the selected/active styling (used by select mode). */
  active?: boolean;
  disabled?: boolean;
  /** Optional element rendered before the label (icon, color dot…). */
  leading?: ReactNode;
  /** Optional element rendered after the label. Falls back to a check
   *  mark when `active` and no trailing node is supplied. */
  trailing?: ReactNode;
  className?: string;
}

export function DropdownItem({
  children,
  onClick,
  active = false,
  disabled = false,
  leading,
  trailing,
  className = '',
}: DropdownItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-current={active || undefined}
      className={cn(
        'w-full flex items-center gap-2 text-left px-3.5 py-2.5 rounded-sm text-sm transition-colors',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        active
          ? 'bg-primary-500 text-white font-semibold shadow-sm'
          : 'text-slate-300 hover:bg-slate-800/60',
        className,
      )}
    >
      {leading != null && <span className="shrink-0">{leading}</span>}
      <span className="flex-1 truncate">{children}</span>
      {trailing != null ? (
        <span className="shrink-0">{trailing}</span>
      ) : active ? (
        <Check className="w-4 h-4 shrink-0" />
      ) : null}
    </button>
  );
}

/* ──────────────────────────────────────────────────────────
    DEVELOPMENT NAVIGATOR: POPOVER SHELL (MENU MODE)
    Contains: trigger, floating panel, outside-click close
    ────────────────────────────────────────────────────────── */
export interface DropdownMenuProps {
  mode?: 'menu';
  open: boolean;
  onClose?: () => void;
  trigger: ReactNode;
  children: ReactNode;
  align?: DropdownAlign;
  className?: string;
  dropdownClassName?: string;
}

export function DropdownShell({
  open,
  onClose,
  trigger,
  children,
  align = 'right',
  className = '',
  dropdownClassName = '',
}: Omit<DropdownMenuProps, 'mode'>) {
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

  const hasWidthOrDisplay =
    className.includes('w-') || className.includes('flex') || className.includes('block');

  return (
    <div ref={containerRef} className={cn('relative', !hasWidthOrDisplay && 'inline-flex', className)}>
      {trigger}

      <div
        className={cn(
          'absolute z-50 mt-2 rounded-lg border border-slate-700/75 bg-slate-950 shadow-2xl shadow-slate-950/10 ring-1 ring-slate-900/5 transition-all duration-200',
          open
            ? 'visible opacity-100 scale-100'
            : 'invisible opacity-0 scale-95 pointer-events-none',
          align === 'left' ? 'left-0' : 'right-0',
          dropdownClassName || 'min-w-[18rem] max-w-sm',
        )}
      >
        {children}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
    DEVELOPMENT NAVIGATOR: SELECT MODE (FORM PICKER)
    Contains: trigger button, label, value-bound option list
    ────────────────────────────────────────────────────────── */
export interface SelectOption {
  value: string | number;
  label: ReactNode;
}

export interface DropdownSelectProps {
  mode: 'select';
  value: string | number;
  onChange: (value: any) => void;
  options: (SelectOption | string)[];
  label?: string;
  placeholder?: ReactNode;
  align?: DropdownAlign;
  className?: string;
  dropdownClassName?: string;
  disabled?: boolean;
}

export function DropdownSelect({
  value,
  onChange,
  options,
  label,
  placeholder = '',
  align = 'left',
  className = '',
  dropdownClassName = 'w-full max-h-60 overflow-y-auto p-1.5 space-y-0.5',
  disabled = false,
}: Omit<DropdownSelectProps, 'mode'>) {
  const [isOpen, setIsOpen] = useState(false);

  // Normalize options array to always be SelectOption objects
  const normalizedOptions: SelectOption[] = options.map((opt) =>
    typeof opt === 'string' ? { value: opt, label: opt } : opt,
  );

  // Preserve legacy behaviour: fall back to the first option when the
  // current value matches nothing, so the trigger is never empty.
  const selectedOption =
    normalizedOptions.find((opt) => opt.value === value) ?? normalizedOptions[0];

  const handleSelect = (optValue: string | number) => {
    if (disabled) return;
    onChange(optValue);
    setIsOpen(false);
  };

  return (
    <div className={cn('w-full', className)}>
      {label && (
        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">
          {label}
        </label>
      )}

      <DropdownShell
        open={isOpen}
        onClose={() => setIsOpen(false)}
        align={align}
        className="w-full flex"
        dropdownClassName={dropdownClassName}
        trigger={
          <button
            type="button"
            disabled={disabled}
            onClick={() => setIsOpen((prev) => !prev)}
            aria-haspopup="listbox"
            aria-expanded={isOpen}
            className="w-full h-11 flex items-center justify-between px-3.5 bg-slate-900/30 border border-slate-850 rounded-sm text-sm text-white focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed text-left"
          >
            <span className="truncate">{selectedOption?.label ?? placeholder}</span>
            <ChevronDown
              className={cn(
                'w-4 h-4 text-slate-400 transition-transform duration-300',
                isOpen && 'rotate-180',
              )}
            />
          </button>
        }
      >
        {normalizedOptions.map((opt) => (
          <DropdownItem
            key={opt.value}
            active={opt.value === value}
            onClick={() => handleSelect(opt.value)}
          >
            {opt.label}
          </DropdownItem>
        ))}
      </DropdownShell>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
    DEVELOPMENT NAVIGATOR: PUBLIC <Dropdown> (MODE SWITCH)
    Contains: routes to menu shell or select picker via `mode`
    ────────────────────────────────────────────────────────── */
export type DropdownProps = DropdownMenuProps | DropdownSelectProps;

export function Dropdown(props: DropdownProps) {
  if (props.mode === 'select') {
    const { mode: _mode, ...rest } = props;
    return <DropdownSelect {...rest} />;
  }
  const { mode: _mode, ...rest } = props;
  return <DropdownShell {...rest} />;
}

/* Allow `<Dropdown.Item>` ergonomics alongside the named export. */
Dropdown.Item = DropdownItem;

/* ──────────────────────────────────────────────────────────
    DEVELOPMENT NAVIGATOR: LEGACY ALIASES
    Contains: Select (→ DropdownSelect), DropdownMenu (→ DropdownShell)
    ────────────────────────────────────────────────────────── */
export { DropdownShell as DropdownMenu, DropdownSelect as Select };
export type { DropdownSelectProps as SelectProps };