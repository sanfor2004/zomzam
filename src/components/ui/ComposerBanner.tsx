'use client';

import React from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

/* ──────────────────────────────────────────────────────────
    DEVELOPMENT NAVIGATOR: COMPOSER BANNER (resting-state trigger)
    Contains: author avatar + a "What's on your mind?" pill that
    opens the full PostComposer (typically in a Modal)
    ──────────────────────────────────────────────────────────
    The calm resting state of the post composer: a glass card that
    signals "you can post here" without the weight of the full
    editor. All it does is call `onOpen` — the host decides how the
    composer itself is presented (see /home and /ui-kit). */

export interface ComposerBannerProps {
  /** Author avatar URL; falls back to the default avatar. */
  avatarSrc?: string | null;
  /** Opens the full composer. */
  onOpen: () => void;
  /** Invitation copy inside the pill. */
  prompt?: string;
  className?: string;
}

export function ComposerBanner({
  avatarSrc,
  onOpen,
  prompt = "What's on your mind?",
  className,
}: ComposerBannerProps) {
  return (
    <div
      className={cn(
        'relative bg-white/[0.04] backdrop-blur-xl border border-white/[0.07] rounded-2xl sm:rounded-3xl p-3 sm:p-4 shadow-apple-lg',
        className,
      )}
    >
      {/* Top-edge highlight */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-px rounded-t-2xl sm:rounded-t-3xl bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none"
      />
      <div className="flex items-center gap-3">
        <Image
          src={avatarSrc || '/Assets/Img/default-avatar.png'}
          alt=""
          width={44}
          height={44}
          className="w-11 h-11 rounded-full object-cover border border-slate-800 flex-shrink-0"
        />
        <button
          type="button"
          onClick={onOpen}
          className="flex-1 text-left px-4 py-2.5 rounded-full bg-[#111318] border border-slate-800/60 text-sm text-slate-500 hover:border-primary-500/40 hover:text-slate-400 transition-colors"
        >
          {prompt}
        </button>
      </div>
    </div>
  );
}
