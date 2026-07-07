'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Users, X, UserPlus, Check } from 'lucide-react';
import { Button } from '@/components/ui';
import { useMessages, type ChatContact, type ChatUser } from '@/context/MessagesContext';
import { emitSocialUpdate } from '@/lib/social-actions';
import { displayName } from '@/app/(dashboard)/home/shared';
import { TypingBadge } from './TypingDots';

// ──────────────────────────────────────────────────────────
// DEVELOPMENT NAVIGATOR: RIGHT SIDEBAR (global)
// The persistent right navbar for the whole dashboard (rendered by the shell,
// not by any page). Consolidates what used to be the /home right column +
// the old presence rail into one place: Active now (connections presence) and
// Suggested connects. Self-contained — reads contacts from MessagesContext and
// fetches its own suggestions. Desktop = sticky column; mobile = FAB + drawer.
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
    is_idle: c.is_idle,
  };
}

interface SuggestedUser {
  id: number;
  username: string;
  first_name: string | null;
  last_name: string | null;
  avatar: string;
}

const CARD = 'surface-card border border-slate-800/60 rounded-3xl p-5 shadow-apple';

/** The shared content — used by the desktop column, the tablet drawer, and the
 *  phone Menu sheet (folded in there instead of a separate FAB).
 *  `onNavigate` lets the host close itself once the user opens a chat/link. */
export function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
  const { contacts, typingContacts, openChat } = useMessages();
  const [suggestions, setSuggestions] = useState<SuggestedUser[]>([]);
  const [sent, setSent] = useState<Set<number>>(new Set());

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/social?action=discover');
        const data = await res.json();
        if (data.success) setSuggestions((data.users || []).slice(0, 5));
      } catch { /* non-blocking */ }
    })();
  }, []);

  // Live: any social-graph change involving a suggested user retires their
  // card — they connected with us (or we with them elsewhere), so they no
  // longer belong under "Suggested connects".
  useEffect(() => {
    const onSocial = (e: Event) => {
      const { from_user_id } = (e as CustomEvent).detail || {};
      if (!from_user_id) return;
      setSuggestions((prev) => prev.filter((u) => u.id !== from_user_id));
    };
    window.addEventListener('zz-social-update', onSocial);
    return () => window.removeEventListener('zz-social-update', onSocial);
  }, []);

  // All connections, ordered online → away → offline for the "Active now" list.
  const friends = useMemo(
    () => [...contacts].sort((a, b) => {
      const r = RANK[bucketOf(a)] - RANK[bucketOf(b)];
      return r !== 0 ? r : displayName(a).localeCompare(displayName(b));
    }),
    [contacts]
  );
  const onlineCount = contacts.filter((c) => c.is_online).length;

  const pick = (c: ChatContact) => {
    openChat(toChatUser(c), c.conversation_id);
    onNavigate?.();
  };

  // Connect (LinkedIn-style): one action sends the request and follows them
  // until they connect back — see /api/social friend_request. The button flips
  // to "Sent" as instant feedback, then the card retires from the list — a
  // pending person is no longer a suggestion. On failure the card stays.
  const connect = async (userId: number) => {
    setSent((prev) => new Set(prev).add(userId));
    try {
      const res = await fetch('/api/social', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'friend_request', user_id: userId }),
      });
      const data = await res.json();
      if (!data.success) {
        setSent((prev) => { const next = new Set(prev); next.delete(userId); return next; });
        return;
      }
      // Let the "Sent" state register (feedback), then retire the card. The
      // echo also reloads the contacts roster — if they had already requested
      // us, the server auto-accepted and they belong in "Active now" NOW.
      setTimeout(() => {
        setSuggestions((prev) => prev.filter((u) => u.id !== userId));
        emitSocialUpdate('friend_request', userId);
      }, 1200);
    } catch {
      setSent((prev) => { const next = new Set(prev); next.delete(userId); return next; });
    }
  };

  return (
    <div className="space-y-4">
      {/* ── Active now (connections presence) ── */}
      <div className={CARD}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-slate-400" />
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Active now</h3>
            {onlineCount > 0 && (
              <span className="text-[10px] font-bold bg-emerald-500/15 text-emerald-400 px-1.5 py-0.5 rounded-full">
                {onlineCount}
              </span>
            )}
          </div>
          <Link
            href="/community/friends"
            onClick={onNavigate}
            className="text-[10px] font-bold uppercase tracking-wider text-primary-500 hover:text-primary-400 transition-colors"
          >
            View All
          </Link>
        </div>

        {friends.length === 0 ? (
          <p className="text-xs text-slate-600 text-center py-4">
            No connections yet — discover people below.
          </p>
        ) : (
          <div className="space-y-1 -mx-1.5">
            {friends.map((c) => {
              const bucket = bucketOf(c);
              const isTyping = typingContacts.has(c.other_id);
              return (
                <button
                  key={c.other_id}
                  onClick={() => pick(c)}
                  className="w-full flex items-center gap-3 text-left rounded-xl px-1.5 py-1.5 hover:bg-white/[0.03] transition-colors"
                >
                  <div className="relative flex-shrink-0">
                    <Image
                      src={c.avatar || '/Assets/Img/default-avatar.png'}
                      alt={displayName(c)}
                      width={36}
                      height={36}
                      className="w-9 h-9 rounded-xl object-cover border border-slate-800"
                    />
                    {isTyping ? (
                      <TypingBadge />
                    ) : (
                      <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#1A1D24] ${DOT[bucket]}`} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs truncate ${bucket === 'offline' && !isTyping ? 'text-slate-400' : 'font-semibold text-slate-200'}`}>
                      {displayName(c)}
                    </p>
                    <p className={`text-[10px] truncate ${isTyping ? 'text-primary-400 font-semibold' : 'text-slate-600'}`}>
                      {isTyping ? 'typing…' : bucket === 'online' ? 'Active now' : bucket === 'away' ? 'Away' : c.online_label || 'Offline'}
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
      </div>

      {/* ── Suggested connects ── */}
      {suggestions.length > 0 && (
        <div className={CARD}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Suggested connects</h3>
            <Link
              href="/community/discover"
              onClick={onNavigate}
              className="text-[10px] font-bold uppercase tracking-wider text-primary-500 hover:text-primary-400 transition-colors"
            >
              See all
            </Link>
          </div>

          <div className="space-y-3">
            {suggestions.map((u) => (
              <div key={u.id} className="flex items-center gap-3">
                <Link href={`/u/${u.username}`} onClick={onNavigate} className="flex-shrink-0">
                  <Image
                    src={u.avatar || '/Assets/Img/default-avatar.png'}
                    alt=""
                    width={36}
                    height={36}
                    className="w-9 h-9 rounded-xl object-cover border border-slate-800 hover:border-primary-500/30 transition-colors"
                  />
                </Link>
                <div className="flex-1 min-w-0">
                  <Link href={`/u/${u.username}`} onClick={onNavigate}>
                    <p className="text-xs font-bold text-slate-200 truncate hover:text-white transition-colors">
                      {displayName(u)}
                    </p>
                  </Link>
                  <p className="text-[10px] text-slate-600 truncate">@{u.username}</p>
                </div>
                <Button
                  variant="unstyled"
                  onClick={() => connect(u.id)}
                  disabled={sent.has(u.id)}
                  title={sent.has(u.id) ? 'Request sent — you follow them until they accept' : 'Connect'}
                  className={`flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[10px] font-bold transition-all disabled:cursor-default ${
                    sent.has(u.id)
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : 'bg-primary-500/10 text-primary-500 hover:bg-primary-500/20'
                  }`}
                >
                  {sent.has(u.id)
                    ? <><Check className="w-3 h-3" /> Sent</>
                    : <><UserPlus className="w-3 h-3" /> Connect</>}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function RightSidebar() {
  const { unreadTotal, windows } = useMessages();
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      {/* ── Desktop column (lg+); below lg it hides and folds into the tablet
            FAB drawer / phone Menu sheet — purely breakpoint-responsive. ── */}
      <aside className="hidden lg:flex flex-col w-72 h-[calc(100vh-95px)] flex-shrink-0 my-2.5 mr-2.5 ml-3 relative z-10">
        <div className="flex-1 overflow-y-auto no-scrollbar">
          <SidebarBody />
        </div>
      </aside>

      {/* ── Tablet toggle (FAB) — md→lg only. On phone (<md) presence is folded
            into the Menu sheet (DashboardShell), so no FAB there; on desktop
            (lg+) the column above replaces it. Hidden while a chat window
            occupies the corner. ── */}
      <button
        type="button"
        onClick={() => setDrawerOpen(true)}
        aria-label="Show messages & friends"
        className={`${windows.length > 0 ? 'hidden' : 'hidden md:flex lg:hidden'} fixed bottom-5 right-5 z-[80] w-12 h-12 rounded-full bg-primary-500 hover:bg-primary-600 text-white shadow-2xl shadow-primary-500/30 items-center justify-center transition-colors`}
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
            className="absolute top-0 right-0 h-full w-80 max-w-[88vw] bg-surface-dark border-l border-slate-800 p-4 overflow-y-auto"
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
            <SidebarBody onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
