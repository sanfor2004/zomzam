'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Users, X, MessagesSquare, MessageSquarePlus, Search, UserPlus, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button, Input, Tooltip } from '@/components/ui';
import { useMessages, useMyId, type ChatContact, type ChatUser } from '@/context/MessagesContext';
import { displayName, relativeTime } from '@/app/(dashboard)/home/shared';

// ──────────────────────────────────────────────────────────
// DEVELOPMENT NAVIGATOR: RIGHT SIDEBAR (global)
// The persistent right navbar for the whole dashboard (rendered by the shell,
// not by any page). Consolidates what used to be the /home right column +
// the old presence rail into one place: Messages, Active Now (friends presence),
// and Suggested people. Self-contained — reads contacts from MessagesContext and
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
  };
}

interface SuggestedUser {
  id: number;
  username: string;
  first_name: string | null;
  last_name: string | null;
  avatar: string;
}

const CARD = 'bg-[#1A1D24] border border-slate-800/60 rounded-3xl p-5 shadow-apple';

/** The shared content — used by both the desktop column and the mobile drawer.
 *  `onNavigate` lets the drawer close itself once the user opens a chat. */
function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
  const { contacts, openChat } = useMessages();
  const myId = useMyId();
  const router = useRouter();
  const [search, setSearch] = useState('');
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

  // Recent conversations (friends we already share a thread with), already ordered
  // most-recent-first by the API.
  const threads = contacts.filter((c) => c.conversation_id);
  const filteredThreads = threads.filter((c) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return displayName(c).toLowerCase().includes(q) || c.username.toLowerCase().includes(q);
  });

  // All friends, ordered online → away → offline for the "Active Now" list.
  const friends = useMemo(
    () => [...contacts].sort((a, b) => {
      const r = RANK[bucketOf(a)] - RANK[bucketOf(b)];
      return r !== 0 ? r : displayName(a).localeCompare(displayName(b));
    }),
    [contacts]
  );
  const onlineCount = contacts.filter((c) => c.is_online).length;
  const unreadThreads = threads.reduce((sum, c) => sum + c.unread_count, 0);

  const pick = (c: ChatContact) => {
    openChat(toChatUser(c), c.conversation_id);
    onNavigate?.();
  };

  const addFriend = async (userId: number) => {
    setSent((prev) => new Set(prev).add(userId));
    try {
      await fetch('/api/social', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'friend_request', user_id: userId }),
      });
    } catch { /* non-blocking */ }
  };

  return (
    <div className="space-y-4">
      {/* ── Messages ── */}
      <div className={CARD}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <MessagesSquare className="w-4 h-4 text-slate-400" />
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Messages</h3>
            {unreadThreads > 0 && (
              <span className="text-[10px] font-bold bg-primary-500 text-white px-1.5 py-0.5 rounded-full">
                {unreadThreads}
              </span>
            )}
          </div>
          <Tooltip content="Open Messenger">
            <Button
              variant="unstyled"
              onClick={() => { onNavigate?.(); router.push('/messages'); }}
              aria-label="Open Messenger"
              className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-primary-400 hover:bg-white/[0.04] transition-colors"
            >
              <MessageSquarePlus className="w-4 h-4" />
            </Button>
          </Tooltip>
        </div>

        {threads.length > 0 && (
          <Input
            size="sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search messages..."
            leftIcon={<Search className="w-3.5 h-3.5" />}
            containerClassName="mb-3"
          />
        )}

        {threads.length === 0 ? (
          <p className="text-xs text-slate-600 text-center py-4">
            No conversations yet — start one from your friends below.
          </p>
        ) : (
          <div className="space-y-1 -mx-1.5">
            {filteredThreads.map((c) => (
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
                  <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#1A1D24] ${c.is_online ? 'bg-emerald-500' : 'bg-slate-600'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className={`text-xs truncate ${c.unread_count > 0 ? 'font-bold text-white' : 'font-semibold text-slate-300'}`}>
                      {displayName(c)}
                    </p>
                    {c.last_message_at && (
                      <span className="text-[10px] text-slate-600 flex-shrink-0">{relativeTime(c.last_message_at)}</span>
                    )}
                  </div>
                  {c.last_message && (
                    <p className={`text-[11px] truncate ${c.unread_count > 0 ? 'text-slate-300 font-medium' : 'text-slate-600'}`}>
                      {c.last_sender_id === myId ? 'You: ' : ''}{c.last_message}
                    </p>
                  )}
                </div>
                {c.unread_count > 0 && (
                  <span className="flex-shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-primary-500 text-white text-[10px] font-bold flex items-center justify-center">
                    {c.unread_count}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Active Now (friends presence) ── */}
      <div className={CARD}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-slate-400" />
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Active Now</h3>
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
            No friends yet — discover people below.
          </p>
        ) : (
          <div className="space-y-1 -mx-1.5">
            {friends.map((c) => {
              const bucket = bucketOf(c);
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
      </div>

      {/* ── Suggested For You ── */}
      {suggestions.length > 0 && (
        <div className={CARD}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Suggested For You</h3>
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
                  onClick={() => addFriend(u.id)}
                  disabled={sent.has(u.id)}
                  title={sent.has(u.id) ? 'Request sent' : 'Add friend'}
                  className={`flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[10px] font-bold transition-all disabled:cursor-default ${
                    sent.has(u.id)
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : 'bg-primary-500/10 text-primary-500 hover:bg-primary-500/20'
                  }`}
                >
                  {sent.has(u.id)
                    ? <><Check className="w-3 h-3" /> Sent</>
                    : <><UserPlus className="w-3 h-3" /> Add</>}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Collapsed mode: a slim strip of avatars — people you're chatting with, then
 *  online friends. Click opens a chat. */
function CollapsedRail() {
  const { contacts, openChat } = useMessages();
  const router = useRouter();

  const threads = contacts.filter((c) => c.conversation_id);
  const online = contacts.filter((c) => c.is_online && !c.conversation_id);
  const shown = [...threads, ...online].slice(0, 16);

  return (
    <div className="flex flex-col items-center gap-2 py-2">
      <button
        type="button"
        onClick={() => router.push('/messages')}
        title="Open Messenger"
        aria-label="Open Messenger"
        className="w-10 h-10 rounded-2xl bg-white/[0.05] hover:bg-primary-500/15 text-slate-400 hover:text-primary-400 flex items-center justify-center transition-colors"
      >
        <MessagesSquare className="w-4 h-4" />
      </button>
      {shown.length > 0 && <div className="w-8 h-px bg-slate-800/80 my-1" />}
      {shown.map((c) => (
        <button
          key={c.other_id}
          type="button"
          onClick={() => openChat(toChatUser(c), c.conversation_id)}
          title={`${displayName(c)}${c.is_online ? (c.is_idle ? ' · Away' : ' · Active now') : ''}`}
          className="relative"
        >
          <Image
            src={c.avatar || '/Assets/Img/default-avatar.png'}
            alt={displayName(c)}
            width={40}
            height={40}
            className="w-10 h-10 rounded-2xl object-cover border border-slate-800 hover:border-primary-500/40 transition-colors"
          />
          <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-surface-dark ${DOT[bucketOf(c)]}`} />
          {c.unread_count > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-primary-500 text-white text-[9px] font-bold flex items-center justify-center border-2 border-surface-dark">
              {c.unread_count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

export function RightSidebar() {
  const { unreadTotal, windows } = useMessages();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Collapsible (icon/avatar-only) — persisted like the left rail.
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    try { setCollapsed(localStorage.getItem('zz-right-collapsed') === '1'); } catch {}
  }, []);
  const toggle = () => setCollapsed((v) => {
    const next = !v;
    try { localStorage.setItem('zz-right-collapsed', next ? '1' : '0'); } catch {}
    return next;
  });

  return (
    <>
      {/* ── Desktop column ── */}
      <aside className={`hidden lg:flex flex-col ${collapsed ? 'w-[76px]' : 'w-72'} h-[calc(100vh-20px)] flex-shrink-0 my-2.5 mr-2.5 relative z-10 transition-all duration-300`}>
        <div className="flex-1 overflow-y-auto no-scrollbar">
          {collapsed ? <CollapsedRail /> : <SidebarBody />}
        </div>

        {/* Collapse toggle */}
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand' : 'Collapse'}
          className={`mt-1 flex items-center gap-2 rounded-xl px-3 py-2 text-slate-500 hover:text-white hover:bg-white/[0.05] transition-colors ${collapsed ? 'justify-center' : 'justify-start'}`}
        >
          {collapsed ? (
            <ChevronLeft className="w-5 h-5" />
          ) : (
            <>
              <ChevronRight className="w-5 h-5" />
              <span className="text-xs font-semibold">Collapse</span>
            </>
          )}
        </button>
      </aside>

      {/* ── Mobile toggle (FAB) — hidden while a chat window occupies the corner ── */}
      <button
        type="button"
        onClick={() => setDrawerOpen(true)}
        aria-label="Show messages & friends"
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
