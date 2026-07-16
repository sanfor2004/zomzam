'use client';

import React, { useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { Search, MessageCircle, Users } from 'lucide-react';
import { Input } from '@/components/ui';
import { usePageEntrance } from '@/hooks/usePageEntrance';
import { useMessages, type ChatContact, type ChatUser } from '@/context/MessagesContext';
import { useMyId } from '@/context/MessagesContext';
import { displayName, relativeTime } from '../home/shared';
import { TypingBadge } from '@/components/chat/TypingDots';

// ──────────────────────────────────────────────────────────
// DEVELOPMENT NAVIGATOR: MESSAGES (MESSENGER HUB)
// Full-page conversations directory. Reuses the global MessagesContext: the
// contact list is the same model that powers the topbar dropdown and presence
// rail. Selecting a person opens a docked chat window (ChatDock) so live
// messaging behaves identically everywhere.
// ──────────────────────────────────────────────────────────
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

export default function MessagesPage() {
  const { contacts, typingContacts, unreadTotal, openChat } = useMessages();
  const myId = useMyId();
  const [search, setSearch] = useState('');
  const pageRef = useRef<HTMLDivElement>(null);
  usePageEntrance(pageRef, [contacts.length]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter(
      (c) => displayName(c).toLowerCase().includes(q) || c.username.toLowerCase().includes(q)
    );
  }, [contacts, search]);

  // Contacts arrive already ordered (chatted-first by recency, then un-chatted
  // alphabetically). Split for clearer section headers.
  const recent = filtered.filter((c) => c.last_message_at);
  const others = filtered.filter((c) => !c.last_message_at);

  return (
    <div ref={pageRef} className="max-w-3xl mx-auto">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-primary-500/15 border border-primary-500/30 flex items-center justify-center">
            <MessageCircle className="w-5 h-5 text-primary-500" />
          </div>
          <div>
            <h1 data-entrance="title" className="text-headline font-black text-white">Messenger</h1>
            <p className="text-xs text-slate-500">
              {unreadTotal > 0 ? `${unreadTotal} unread message${unreadTotal > 1 ? 's' : ''}` : 'All caught up'}
            </p>
          </div>
        </div>
      </div>

      <div data-entrance="card" className="surface-card border border-slate-800/60 rounded-3xl p-5 shadow-apple">
        <Input
          size="md"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search people…"
          leftIcon={<Search className="w-4 h-4" />}
          containerClassName="mb-4"
        />

        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <Users className="w-8 h-8 text-slate-700 mx-auto mb-3" />
            <p className="text-sm text-slate-500">
              {contacts.length === 0
                ? 'Add friends to start messaging.'
                : 'No people match your search.'}
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {recent.length > 0 && (
              <Section title="Recent" rows={recent} myId={myId} typing={typingContacts} onPick={(c) => openChat(toChatUser(c), c.conversation_id)} />
            )}
            {others.length > 0 && (
              <Section title="Friends" rows={others} myId={myId} typing={typingContacts} onPick={(c) => openChat(toChatUser(c), c.conversation_id)} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Section({
  title, rows, myId, typing, onPick,
}: {
  title: string;
  rows: ChatContact[];
  myId: number;
  typing: Set<number>;
  onPick: (c: ChatContact) => void;
}) {
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-600 mb-2 px-1">{title}</p>
      <div className="space-y-1">
        {rows.map((c) => {
          const isTyping = typing.has(c.other_id);
          return (
          <button
            key={c.other_id}
            data-entrance="list-item"
            onClick={() => onPick(c)}
            className="w-full flex items-center gap-3 text-left rounded-2xl px-2.5 py-2.5 hover:bg-white/[0.04] transition-colors cursor-pointer"
          >
            <div className="relative flex-shrink-0">
              <Image
                src={c.avatar || '/Assets/Img/default-avatar.png'}
                alt={displayName(c)}
                width={44}
                height={44}
                className="w-11 h-11 rounded-2xl object-cover border border-slate-800"
              />
              {isTyping ? (
                <TypingBadge />
              ) : (
                <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#1A1D24] ${c.is_online ? (c.is_idle ? 'bg-amber-400' : 'bg-emerald-500') : 'bg-slate-600'}`} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-2">
                <p className={`text-sm truncate ${c.unread_count > 0 ? 'font-bold text-white' : 'font-semibold text-slate-200'}`}>
                  {displayName(c)}
                </p>
                {c.last_message_at && !isTyping && (
                  <span className="text-[10px] text-slate-600 flex-shrink-0">{relativeTime(c.last_message_at)}</span>
                )}
              </div>
              {isTyping ? (
                <p className="text-xs truncate text-primary-400 font-semibold">typing…</p>
              ) : (
                <p className={`text-xs truncate ${c.unread_count > 0 ? 'text-slate-300 font-medium' : 'text-slate-600'}`}>
                  {c.last_message
                    ? `${c.last_sender_id === myId ? 'You: ' : ''}${c.last_message}`
                    : `@${c.username}`}
                </p>
              )}
            </div>
            {c.unread_count > 0 && (
              <span className="flex-shrink-0 min-w-[20px] h-5 px-1.5 rounded-full bg-primary-500 text-white text-[10px] font-bold flex items-center justify-center">
                {c.unread_count}
              </span>
            )}
          </button>
          );
        })}
      </div>
    </div>
  );
}
