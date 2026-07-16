'use client';

import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import Link from 'next/link';
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
  /** Optional CTA — wraps title/description in a Link and dismisses on click. Omit for a plain message toast. */
  href?: string;
}

interface ToastEntry extends ToastOptions {
  id: string;
  leaving?: boolean;
}

// Matches --animate-out: fadeOut 0.3s ease-in (globals.css) — the beat we hold
// the toast mounted for after dismiss() so the exit actually plays instead of
// the entry vanishing from the array instantly.
const EXIT_DURATION = 300;

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
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    // Mark it leaving so the exit animation plays, then remove after it
    // settles — skip if it's already leaving (auto-dismiss + a manual click
    // racing each other shouldn't double-schedule the removal).
    let alreadyLeaving = false;
    setToasts((prev) => prev.map((t) => {
      if (t.id !== id) return t;
      if (t.leaving) alreadyLeaving = true;
      return { ...t, leaving: true };
    }));
    if (alreadyLeaving) return;
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, EXIT_DURATION);
  }, []);

  // Hover/focus pauses auto-dismiss (a toast must not vanish mid-read).
  const schedule = useCallback(
    (id: string, duration: number) => {
      const existing = timers.current.get(id);
      if (existing) clearTimeout(existing);
      // ponytail: unpause restarts the full duration; remaining-time bookkeeping when someone complains
      timers.current.set(id, setTimeout(() => dismiss(id), duration));
    },
    [dismiss],
  );

  const pause = useCallback((id: string) => {
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
      schedule(id, options.duration ?? 4000);
    },
    [schedule],
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}

      {/* Persistent polite live region (announcements are reliable only when
          the region exists before content lands) + device safe-area offsets. */}
      <div
        aria-live="polite"
        className="fixed bottom-[calc(1.5rem+env(safe-area-inset-bottom))] right-[calc(1.5rem+env(safe-area-inset-right))] z-[100] flex flex-col gap-2.5 w-full max-w-sm pointer-events-none"
      >
        {toasts.map((t) => {
          const Icon = ICONS[t.variant ?? 'info'];
          return (
            <div
              key={t.id}
              role="status"
              onMouseEnter={() => pause(t.id)}
              onMouseLeave={() => schedule(t.id, t.duration ?? 4000)}
              onFocus={() => pause(t.id)}
              onBlur={() => schedule(t.id, t.duration ?? 4000)}
              className={cn(
                'pointer-events-auto flex gap-3 items-start p-4 rounded-2xl border surface-card shadow-2xl duration-300',
                t.leaving ? 'animate-out pointer-events-none' : 'animate-in slide-in-from-top',
                VARIANT_STYLES[t.variant ?? 'info'],
              )}
            >
              <Icon className="w-5 h-5 mt-0.5 shrink-0" aria-hidden="true" />
              {t.href ? (
                <Link href={t.href} onClick={() => dismiss(t.id)} className="flex-1 min-w-0 hover:opacity-90 transition-opacity">
                  {t.title && <p className="text-sm font-bold text-white mb-0.5">{t.title}</p>}
                  <p className="text-xs text-slate-400">{t.description}</p>
                </Link>
              ) : (
                <div className="flex-1 min-w-0">
                  {t.title && <p className="text-sm font-bold text-white mb-0.5">{t.title}</p>}
                  <p className="text-xs text-slate-400">{t.description}</p>
                </div>
              )}
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss"
                className="text-slate-500 hover:text-slate-200 active:scale-90 transition-[color,transform]"
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
