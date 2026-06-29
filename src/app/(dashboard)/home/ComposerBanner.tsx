'use client';

import React from 'react';
import Image from 'next/image';
import { Image as ImageIcon, HelpCircle, Trophy } from 'lucide-react';
import { displayName, type CurrentUser, type PostType } from './shared';

// ──────────────────────────────────────────────────────────
// DEVELOPMENT NAVIGATOR: COMPOSER BANNER (resting-state trigger)
// Contains: author avatar, "What's on your mind?" pill (opens the composer
// modal), and Photo / Ask / Win quick-action chips (open it pre-configured)
// ──────────────────────────────────────────────────────────
export function ComposerBanner({
  currentUser,
  onOpen,
}: {
  currentUser: CurrentUser | null;
  onOpen: (type?: PostType, photo?: boolean) => void;
}) {
  return (
    <div
      id="post-composer"
      className="relative bg-white/[0.04] backdrop-blur-xl border border-white/[0.07] rounded-2xl sm:rounded-3xl p-3 sm:p-4 shadow-apple-lg"
    >
      {/* Top-edge highlight */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-px rounded-t-2xl sm:rounded-t-3xl bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none"
      />
      <div className="flex items-center gap-3">
        <Image
          src={currentUser?.avatar || '/Assets/Img/default-avatar.png'}
          alt=""
          width={44}
          height={44}
          className="w-11 h-11 rounded-full object-cover border border-slate-800 flex-shrink-0"
        />
        <button
          type="button"
          onClick={() => onOpen()}
          className="flex-1 text-left px-4 py-2.5 rounded-full bg-[#111318] border border-slate-800/60 text-sm text-slate-500 hover:border-primary-500/40 hover:text-slate-400 transition-colors"
        >
          {currentUser ? `What's on your mind, ${displayName(currentUser).split(' ')[0]}?` : "What's on your mind?"}
        </button>
      </div>
      <div className="flex items-center gap-1 mt-3 pt-3 border-t border-slate-800/60">
        <BannerAction icon={<ImageIcon className="w-4 h-4 text-emerald-400" />} label="Photo" onClick={() => onOpen('status', true)} />
        <BannerAction icon={<HelpCircle className="w-4 h-4 text-sky-400" />} label="Ask" onClick={() => onOpen('ask')} />
        <BannerAction icon={<Trophy className="w-4 h-4 text-amber-400" />} label="Win" onClick={() => onOpen('win')} />
      </div>
    </div>
  );
}

function BannerAction({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors active:scale-[0.98]"
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
