'use client';

import React from 'react';
import { CheckCircle, AlertCircle, AlertTriangle, Info, X, type LucideIcon } from 'lucide-react';

export type AlertVariant = 'error' | 'success' | 'warn' | 'info';

export interface AlertProps {
  variant: AlertVariant;
  title?: string;
  children: React.ReactNode;
  onDismiss?: () => void;
  className?: string;
  animate?: boolean;
}

const VARIANT_STYLES: Record<AlertVariant, string> = {
  error:   'bg-red-500/10 border-red-500/20 text-red-500 dark:text-red-400',
  success: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
  warn:    'bg-amber-500/10 border-amber-500/20 text-amber-400',
  info:    'bg-blue-500/10 border-blue-500/20 text-blue-400',
};

const ICONS: Record<AlertVariant, LucideIcon> = {
  error:   AlertCircle,
  success: CheckCircle,
  warn:    AlertTriangle,
  info:    Info,
};

export function Alert({ variant, title, children, onDismiss, className = '', animate = false }: AlertProps) {
  const Icon = ICONS[variant];
  const hasTitle = Boolean(title);

  return (
    <div
      role="alert"
      className={[
        'p-4 rounded-2xl border text-xs flex gap-3',
        hasTitle ? 'items-start' : 'items-center',
        VARIANT_STYLES[variant],
        animate ? 'animate-in slide-in-from-top duration-300' : '',
        className,
      ].join(' ')}
    >
      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: ALERT ICON
          Contains: Variant icon (error/success/warn/info)
          ────────────────────────────────────────────────────────── */}
      <Icon className={`flex-shrink-0 ${hasTitle ? 'w-5 h-5 mt-0.5' : 'w-4 h-4'}`} aria-hidden="true" />

      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: ALERT BODY
          Contains: Optional title, message text, optional dismiss button
          ────────────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0">
        {title && <p className="font-bold text-sm mb-0.5">{title}</p>}
        <p className={title ? 'opacity-90' : ''}>{children}</p>
      </div>

      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
