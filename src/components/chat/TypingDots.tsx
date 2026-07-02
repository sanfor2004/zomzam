'use client';

import React from 'react';
import { cn } from '@/lib/utils';

// ──────────────────────────────────────────────────────────
// DEVELOPMENT NAVIGATOR: TYPING ANIMATION PRIMITIVES
// The three-bouncing-dots "peer is composing" animation, in two forms:
//   • <TypingDots/>  — inline dots for the in-window chat bubble.
//   • <TypingBadge/> — a compact pill that overlays the presence dot on an
//     avatar, so "typing…" surfaces on the Active-now rail, the chat-dock
//     header, and the messages list — not only inside an open window.
// Both honor prefers-reduced-motion (dots hold static instead of bouncing).
// ──────────────────────────────────────────────────────────

/** Inline three-dot typing animation (chat-bubble sized). */
export function TypingDots({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1', className)} aria-hidden="true">
      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce motion-reduce:animate-none [animation-delay:-0.3s]" />
      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce motion-reduce:animate-none [animation-delay:-0.15s]" />
      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce motion-reduce:animate-none" />
    </span>
  );
}

/**
 * Avatar-overlay typing badge — sits exactly where the presence dot would, so a
 * live "typing…" signal replaces the online icon. `borderClass` matches the
 * surrounding surface so the pill reads as cut into the avatar (mirrors the
 * `border-2` treatment the presence dots use across the app).
 */
export function TypingBadge({ borderClass = 'border-[#1A1D24]' }: { borderClass?: string }) {
  return (
    <span
      role="img"
      aria-label="typing"
      className={cn(
        'absolute -bottom-1 -right-1 inline-flex items-center gap-[2px] px-1 py-[3px] rounded-full bg-primary-500 border-2',
        borderClass,
      )}
    >
      <span className="w-1 h-1 rounded-full bg-white animate-bounce motion-reduce:animate-none [animation-delay:-0.3s]" />
      <span className="w-1 h-1 rounded-full bg-white animate-bounce motion-reduce:animate-none [animation-delay:-0.15s]" />
      <span className="w-1 h-1 rounded-full bg-white animate-bounce motion-reduce:animate-none" />
    </span>
  );
}
