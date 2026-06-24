'use client';

import React, { useMemo, useState } from 'react';
import Image from 'next/image';
import { Users, X } from 'lucide-react';
import { useMessages, type ChatContact, type ChatUser } from '@/context/MessagesContext';
import { displayName } from '@/app/(dashboard)/home/shared';

// ──────────────────────────────────────────────────────────
// DEVELOPMENT NAVIGATOR: PRESENCE RAIL
// Right-hand "Active Now" rail listing the user's friends with live
// online / away / offline status (polled via MessagesContext.contacts every 20s).
// Persistent column on desktop; a toggle-able drawer on mobile. Clicking a friend
// opens a docked chat window. Friends are ordered online → away → offline.
// ──────────────────────────────────────────────────────────

type Bucket = 'online' | 'away' | 'offline';

function bucketOf(c: ChatContact): Bucket {
  if (c.is_online) return c.is_idle ? 'away' : 'online';
  return 'offline';
}

const RANK: Record<Bucket, number> = { online: 0, away: 1, offline: 2 };
const DOT: Record<Bucket, string> = {
  online: 'bg-emerald-500',
  away: 'bg-amber-400',
  offline: 'bg-slate-600',
};

function toChatUser(c: ChatContact): ChatUser {
  return {
    id: c.other_id,
    username: c.username,
    first_name: c.first_name,
    last_name: c.last_name,
    avatar: c.avatar,
    online_label: c.online_label,
    is_online: c.is_online,
  };
}

function RailBody({ onPick }: { onPick: (c: ChatContact) => void }) {
  const { contacts } = useMessages();

  const sorted = useMemo(
    () =>
      [...contacts].sort((a, b) => {
        const r = RANK[bucketOf(a)] - RANK[bucketOf(b)];
        return r !== 0 ? r : displayName(a).localeCompare(displayName(b));
      }),
    [contacts]
  );

  const onlineCount = useMemo(() => contacts.filter((c) => c.is_online).length, [contacts]);

  return (
    <>
      <div className="flex items-center gap-2 mb-4">
        <Users className="w-4 h-4 text-slate-400" />
        <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Active Now</h3>
        {onlineCount > 0 && (
          <span className="text-[10px] font-bold bg-emerald-500/15 text-emerald-400 px-1.5 py-0.5 rounded-full">
            {onlineCount}
          </span>
        )}
      </div>

      {sorted.length === 0 ? (
        <p className="text-xs text-slate-600 text-center py-6">
          No friends yet — connect with people to see them here.
        </p>
      ) : (
        <div className="space-y-1 -mx-1.5">
          {sorted.map((c) => {
            const bucket = bucketOf(c);
            return (
              <button
                key={c.other_id}
                onClick={() => onPick(c)}
                className="w-full flex items-center gap-3 text-left rounded-xl px-1.5 py-1.5 hover:bg-white/[0.04] transition-colors cursor-pointer"
              >
                <div className="relative flex-shrink-0">
                  <Image
                    src={c.avatar || '/Assets/Img/default-avatar.png'}
                    alt={displayName(c)}
                    width={36}
                    height={36}
                    className="w-9 h-9 rounded-xl object-cover border border-slate-800"
                  />
                  <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#1A1D24] ${DOT[bucket]}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs truncate ${bucket === 'offline' ? 'text-slate-400' : 'font-semibold text-slate-200'}`}>
                    {displayName(c)}
                  </p>
                  <p className="text-[10px] text-slate-600 truncate">
                    {bucket === 'online' ? 'Active now' : bucket === 'away' ? 'Away' : c.online_label || 'Offline'}
                  </p>
                </div>
                {c.unread_count > 0 && (
                  <span className="flex-shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-primary-500 text-white text-[10px] font-bold flex items-center justify-center">
                    {c.unread_count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}

export function PresenceRail() {
  const { openChat, unreadTotal, windows } = useMessages();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const pick = (c: ChatContact) => {
    openChat(toChatUser(c), c.conversation_id);
    setDrawerOpen(false);
  };

  return (
    <>
      {/* ── Desktop rail ── */}
      <aside className="hidden lg:block w-64 flex-shrink-0 m-2.5 relative z-10">
        <div className="h-[calc(100vh-20px)] bg-surface-dark/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-5 overflow-y-auto">
          <RailBody onPick={pick} />
        </div>
      </aside>

      {/* ── Mobile toggle (FAB) — hidden while a chat window occupies the corner ── */}
      <button
        type="button"
        onClick={() => setDrawerOpen(true)}
        aria-label="Show active friends"
        className={`${windows.length > 0 ? 'hidden' : 'lg:hidden'} fixed bottom-5 right-5 z-[80] w-12 h-12 rounded-full bg-primary-500 hover:bg-primary-600 text-white shadow-2xl shadow-primary-500/30 flex items-center justify-center transition-colors`}
      >
        <Users className="w-5 h-5" />
        {unreadTotal > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-red-500 border-2 border-[#111318]" />
        )}
      </button>

      {/* ── Mobile drawer ── */}
      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-[81] bg-slate-900/50 backdrop-blur-sm" onClick={() => setDrawerOpen(false)}>
          <div
            className="absolute top-0 right-0 h-full w-72 max-w-[85vw] bg-surface-dark border-l border-slate-800 p-5 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-end mb-1">
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close"
                className="text-slate-500 hover:text-white transition-colors p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <RailBody onPick={pick} />
          </div>
        </div>
      )}
    </>
  );
}
