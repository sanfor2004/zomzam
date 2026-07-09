'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Users, X, UserPlus, Check, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui';
import { useMessages, type ChatContact, type ChatUser } from '@/context/MessagesContext';
import { emitSocialUpdate } from '@/lib/social-actions';
import { displayName } from '@/app/(dashboard)/home/shared';
import { cn } from '@/lib/utils';
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

// Apple-style grouped-list card: calm gray group header (icon + label, optional
// count pill + trailing link) over a hairline-divided surface-card — mirrors the
// settings page's SettingsGroup/SettingRow rhythm (spec: hierarchy via size/
// weight, not colour; orange reserved for the interactive/count accent).
function Group({
  icon, title, count, action, actionHref, onAction, children,
}: {
  icon: React.ReactNode;
  title: string;
  count?: number;
  action?: string;
  actionHref?: string;
  onAction?: () => void;
  children: React.ReactNode;
}) {
  const actionEl = action ? (
    <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-primary-500 hover:text-primary-400 transition-colors">
      {action}
      <ChevronRight className="w-3 h-3" />
    </span>
  ) : null;

  return (
    <section>
      <div className="flex items-center gap-2 px-1 mb-2">
        <span className="[&>svg]:w-4 [&>svg]:h-4 text-slate-500">{icon}</span>
        <h3 className="text-[13px] font-semibold tracking-tight text-slate-400">{title}</h3>
        {typeof count === 'number' && count > 0 && (
          <span className="text-[10px] font-bold tabular-nums bg-emerald-500/15 text-emerald-400 px-1.5 py-0.5 rounded-full">
            {count}
          </span>
        )}
        <div className="flex-1" />
        {actionHref && actionEl && (
          <Link href={actionHref} onClick={onAction}>{actionEl}</Link>
        )}
      </div>
      <div className="surface-card rounded-2xl divide-y divide-slate-800/60 overflow-hidden shadow-apple">
        {children}
      </div>
    </section>
  );
}

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
    <div className="space-y-5">
      {/* ── Active now (connections presence) ── */}
      <Group icon={<Users />} title="Active now" count={onlineCount} action="View all" actionHref="/community/connections" onAction={onNavigate}>
        {friends.length === 0 ? (
          <p className="text-xs text-slate-600 text-center py-6 px-4">
            No connections yet — discover people below.
          </p>
        ) : (
          friends.map((c) => {
            const bucket = bucketOf(c);
            const isTyping = typingContacts.has(c.other_id);
            return (
              <button
                key={c.other_id}
                onClick={() => pick(c)}
                className="w-full min-h-[52px] flex items-center gap-3 text-left px-3 py-2 hover:bg-white/[0.03] active:bg-white/[0.05] transition-colors"
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
                  <p className={`text-[13px] truncate ${bucket === 'offline' && !isTyping ? 'text-slate-400' : 'font-semibold text-slate-200'}`}>
                    {displayName(c)}
                  </p>
                  <p className={`text-[11px] truncate ${isTyping ? 'text-primary-400 font-semibold' : 'text-slate-600'}`}>
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
          })
        )}
      </Group>

      {/* ── Suggested connects ── */}
      {suggestions.length > 0 && (
        <Group icon={<UserPlus />} title="Suggested connects" action="See all" actionHref="/community/discover" onAction={onNavigate}>
          {suggestions.map((u) => (
            <div key={u.id} className="min-h-[52px] flex items-center gap-3 px-3 py-2">
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
                  <p className="text-[13px] font-semibold text-slate-200 truncate hover:text-white transition-colors">
                    {displayName(u)}
                  </p>
                </Link>
                <p className="text-[11px] text-slate-600 truncate">@{u.username}</p>
              </div>
              <Button
                variant="unstyled"
                onClick={() => connect(u.id)}
                disabled={sent.has(u.id)}
                title={sent.has(u.id) ? 'Request sent — you follow them until they accept' : 'Connect'}
                className={cn(
                  'flex-shrink-0 flex items-center gap-1 min-h-[32px] px-2.5 py-1.5 rounded-full text-[11px] font-semibold transition-all active:scale-95 disabled:cursor-default motion-reduce:transition-none',
                  sent.has(u.id)
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'bg-primary-500/10 text-primary-500 hover:bg-primary-500/20',
                )}
              >
                {sent.has(u.id)
                  ? <><Check className="w-3 h-3" /> Sent</>
                  : <><UserPlus className="w-3 h-3" /> Connect</>}
              </Button>
            </div>
          ))}
        </Group>
      )}
    </div>
  );
}

export function RightSidebar() {
  const { unreadTotal, windows } = useMessages();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Swipe-right-to-dismiss for the tablet sheet — mirrors the bottom nav
  // sheet's swipe-to-dismiss in DashboardShell (only downward there, only
  // rightward here) so the two sheet gestures feel like one system.
  const [dragX, setDragX] = useState(0);
  const drag = useRef<{ startX: number; active: boolean }>({ startX: 0, active: false });
  const DISMISS_THRESHOLD = 80;

  const handlePointerDown = (e: React.PointerEvent) => {
    drag.current = { startX: e.clientX, active: true };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!drag.current.active) return;
    const dx = e.clientX - drag.current.startX;
    setDragX(dx > 0 ? dx : 0); // only rightward drags count
  };
  const handlePointerUp = () => {
    if (!drag.current.active) return;
    drag.current.active = false;
    if (dragX > DISMISS_THRESHOLD) setDrawerOpen(false);
    setDragX(0);
  };

  return (
    <>
      {/* ── Desktop column (lg+); below lg it hides and folds into the tablet
            sheet / phone Menu sheet — purely breakpoint-responsive. ── */}
      <aside className="hidden lg:flex flex-col w-72 h-[calc(100vh-95px)] flex-shrink-0 my-2.5 mr-2.5 ml-3 relative z-10">
        <div className="flex-1 overflow-y-auto no-scrollbar">
          <SidebarBody />
        </div>
      </aside>

      {/* ── Tablet toggle (FAB) — md→lg only. On phone (<md) presence is folded
            into the Menu sheet (DashboardShell), so no FAB there; on desktop
            (lg+) the column above replaces it. Hidden while a chat window
            occupies the corner. Glass pill with an inset top highlight, same
            physical-depth language as the phone Create button. ── */}
      <button
        type="button"
        onClick={() => setDrawerOpen(true)}
        aria-label="Show messages & friends"
        aria-expanded={drawerOpen}
        className={cn(
          windows.length > 0 ? 'hidden' : 'hidden md:flex lg:hidden',
          'fixed bottom-5 right-5 z-[80] w-14 h-14 rounded-full items-center justify-center',
          'bg-primary-500 hover:bg-primary-600 text-white',
          'shadow-[0_8px_24px_-4px_rgba(238,87,18,0.45),inset_0_1px_1px_rgba(255,255,255,0.25)]',
          'transition-all duration-150 active:scale-95 motion-reduce:transition-none',
        )}
      >
        <Users className="w-5 h-5" />
        {unreadTotal > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-white text-primary-600 text-[10px] font-bold flex items-center justify-center border-2 border-primary-500">
            {unreadTotal > 99 ? '99+' : unreadTotal}
          </span>
        )}
      </button>

      {/* ── Tablet sheet — always mounted (lg:hidden) so open/close animate via
            CSS transform alone, matching the phone nav sheet's pattern. Slides
            in from the right edge; rounded left corners + backdrop blur read as
            a native iOS card modal rather than a flat drawer. ── */}
      <div
        aria-hidden={!drawerOpen}
        onClick={() => setDrawerOpen(false)}
        className={cn(
          'lg:hidden fixed inset-0 z-[81] bg-slate-900/60 backdrop-blur-sm transition-opacity duration-300 motion-reduce:transition-none',
          drawerOpen ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Messages & friends"
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'lg:hidden fixed inset-y-0 right-0 z-[82] flex flex-col w-80 max-w-[88vw]',
          'bg-surface-dark/95 backdrop-blur-xl border-l border-slate-800 rounded-l-[28px] shadow-2xl',
          'transition-transform duration-300 ease-out motion-reduce:transition-none',
          drawerOpen ? 'translate-x-0' : 'translate-x-full',
        )}
        style={
          dragX > 0
            ? { transform: `translateX(${dragX}px)`, transition: 'none' }
            : undefined
        }
      >
        {/* Header — title + circular close button, iOS modal-nav convention */}
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="flex-shrink-0 flex items-center justify-between px-4 pt-[calc(env(safe-area-inset-top)+1rem)] pb-3 border-b border-slate-800/60 touch-none"
        >
          <h2 className="text-[15px] font-bold text-white">Messages & friends</h2>
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            aria-label="Close"
            className="w-8 h-8 rounded-full bg-slate-800/70 text-slate-400 hover:text-white hover:bg-slate-700/70 flex items-center justify-center transition-colors active:scale-95"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <SidebarBody onNavigate={() => setDrawerOpen(false)} />
        </div>
      </div>
    </>
  );
}
