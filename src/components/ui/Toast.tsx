'use client';

import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { CheckCircle, AlertCircle, AlertTriangle, Info, X, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ──────────────────────────────────────────────────────────
    DEVELOPMENT NAVIGATOR: TOAST NOTIFICATION SYSTEM
    Contains: ToastProvider (context + viewport), useToast hook
    ──────────────────────────────────────────────────────────
    Self-contained — mount <ToastProvider> around any subtree
    that needs to call toast(). Not wired into the app's global
    providers.tsx; opt in where it's actually needed. */

export type ToastVariant = 'success' | 'error' | 'warn' | 'info';

export interface ToastOptions {
  title?: string;
  description: string;
  variant?: ToastVariant;
  /** Auto-dismiss delay in ms. Defaults to 4000. */
  duration?: number;
}

interface ToastEntry extends ToastOptions {
  id: string;
}

interface ToastContextValue {
  toast: (options: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const ICONS: Record<ToastVariant, LucideIcon> = {
  success: CheckCircle,
  error: AlertCircle,
  warn: AlertTriangle,
  info: Info,
};

const VARIANT_STYLES: Record<ToastVariant, string> = {
  success: 'border-emerald-500/20 text-emerald-400',
  error: 'border-red-500/20 text-red-400',
  warn: 'border-amber-500/20 text-amber-400',
  info: 'border-blue-500/20 text-blue-400',
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const toast = useCallback(
    (options: ToastOptions) => {
      const id = Math.random().toString(36).slice(2);
      setToasts((prev) => [...prev, { id, variant: 'info', duration: 4000, ...options }]);
      const timer = setTimeout(() => dismiss(id), options.duration ?? 4000);
      timers.current.set(id, timer);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}

      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2.5 w-full max-w-sm pointer-events-none">
        {toasts.map((t) => {
          const Icon = ICONS[t.variant ?? 'info'];
          return (
            <div
              key={t.id}
              role="status"
              className={cn(
                'pointer-events-auto flex gap-3 items-start p-4 rounded-2xl border bg-[#1A1D24] shadow-2xl animate-in slide-in-from-top duration-300',
                VARIANT_STYLES[t.variant ?? 'info'],
              )}
            >
              <Icon className="w-5 h-5 mt-0.5 shrink-0" aria-hidden="true" />
              <div className="flex-1 min-w-0">
                {t.title && <p className="text-sm font-bold text-white mb-0.5">{t.title}</p>}
                <p className="text-xs text-slate-400">{t.description}</p>
              </div>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss"
                className="text-slate-500 hover:text-slate-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a <ToastProvider>');
  return ctx;
}
